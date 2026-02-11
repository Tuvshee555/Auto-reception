import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "../../lib/mongo";
import { askGemini } from "../../lib/gemini";
import { sendTextMessage, sendTypingOn } from "../../lib/messenger";
import { rateLimit } from "../../lib/rateLimit";

const VERIFY = process.env.FACEBOOK_VERIFY_TOKEN;

type BookingSession = {
  senderId: string;
  active: boolean;
  name?: string;
  phone?: string;
  date?: string;
  time?: string;
  updatedAt: Date;
};

function extractPhone(text: string) {
  const match = text.match(/(?:\+?\d[\d\s-]{6,15}\d)/);
  return match?.[0]?.replace(/[\s-]+/g, "") || "";
}

function extractTime(text: string) {
  const hhmm = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (hhmm) return `${hhmm[1].padStart(2, "0")}:${hhmm[2]}`;

  const hour = text.match(/\b([01]?\d|2[0-3])\s*(?:цаг|tsag)\b/i);
  if (hour) return `${hour[1].padStart(2, "0")}:00`;

  return "";
}

function extractDate(text: string) {
  const direct = text.match(
    /(маргааш|margaash|өнөөдөр|unuudur|today|tomorrow|даваа|мягмар|лхагва|пүрэв|баасан|бямба|ням)\b/i,
  );
  if (direct) return direct[1];

  const numeric = text.match(/\b(\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)\b/);
  if (numeric) return numeric[1];

  return "";
}

function extractName(text: string, phone: string) {
  const cleaned = text.trim();
  if (!cleaned) return "";

  const labeled = cleaned.match(
    /(?:нэр(?:\s*(?:нь|бол|гээд))?|name(?:\s+is)?|гэдэг|gdg|nertei)\s*[:：-]?\s*([A-Za-zА-Яа-яӨөҮүЁё]{2,})/i,
  );
  if (labeled) return labeled[1];

  const withoutPhone = phone
    ? cleaned.replace(new RegExp(phone.replace("+", "\\+"), "g"), " ")
    : cleaned;
  const tokens = withoutPhone
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => /^[A-Za-zА-Яа-яӨөҮүЁё]{2,}$/.test(token));

  if (tokens.length === 1) return tokens[0];
  if (tokens.length >= 2 && /(?:нер|нэр|name|gdg|гэдэг|nertei)/i.test(cleaned)) {
    return tokens[0];
  }

  return "";
}

function getMissingFields(session: BookingSession) {
  const missing: Array<"date" | "time" | "name" | "phone"> = [];
  if (!session.date) missing.push("date");
  if (!session.time) missing.push("time");
  if (!session.name) missing.push("name");
  if (!session.phone) missing.push("phone");
  return missing;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // ---------- VERIFY ----------
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === VERIFY)
      return res.status(200).send(challenge as string);
    return res.status(403).send("Verification failed");
  }

  // ---------- MESSAGES ----------
  if (req.method === "POST") {
    try {
      const body = req.body;
      const db = await getDb();

      if (body.object === "page") {
        for (const entry of body.entry || []) {
          for (const event of entry.messaging || []) {
            if (!event.message || !event.sender) continue;

            const senderId = event.sender.id;
            const text = event.message.text || "";

            // Save message history
            await db.collection("messages").insertOne({
              senderId,
              text,
              createdAt: new Date(),
            });

            // Rate limit
            const limit = rateLimit(`fb:${senderId}`, 20, 10 * 60 * 1000);
            if (!limit.allowed) {
              await sendTextMessage(senderId, "Түр хүлээнэ үү, дараа оролдоно уу.");
              continue;
            }

            await sendTypingOn(senderId);

            // Detect booking intent and maintain slot state so we don't ask duplicates
            const wantsBooking = /tsag|цаг|book|appointment|захиал/i.test(text);
            const sessions = db.collection<BookingSession>("booking_sessions");
            const existingSession = await sessions.findOne({ senderId });

            const extractedPhone = extractPhone(text);
            const extractedName = extractName(text, extractedPhone);
            const extractedDate = extractDate(text);
            const extractedTime = extractTime(text);

            const shouldHandleBooking = wantsBooking || !!existingSession?.active;
            if (shouldHandleBooking) {
              const session: BookingSession = {
                senderId,
                active: true,
                name: extractedName || existingSession?.name,
                phone: extractedPhone || existingSession?.phone,
                date: extractedDate || existingSession?.date,
                time: extractedTime || existingSession?.time,
                updatedAt: new Date(),
              };

              await sessions.updateOne(
                { senderId },
                { $set: session },
                { upsert: true },
              );

              const missingFields = getMissingFields(session);
              if (!missingFields.length) {
                await db.collection("bookings").insertOne({
                  senderId,
                  name: session.name,
                  phone: session.phone,
                  dateText: session.date,
                  timeText: session.time,
                  message: text,
                  status: "pending",
                  createdAt: new Date(),
                });

                await sessions.updateOne(
                  { senderId },
                  { $set: { active: false, updatedAt: new Date() } },
                );

                await sendTextMessage(
                  senderId,
                  `Баярлалаа, ${session.name}! Таны цаг захиалгын мэдээллийг бүртгэлээ (${session.date} ${session.time}, ${session.phone}). Манай ажилтан удахгүй баталгаажуулж холбогдоно.`,
                );
                continue;
              }

              const labels: Record<string, string> = {
                date: "өдөр",
                time: "цаг",
                name: "нэр",
                phone: "утасны дугаар",
              };
              const missingLabel = missingFields.map((key) => labels[key]).join(", ");

              await sendTextMessage(
                senderId,
                `Мэдээллийг тэмдэглэлээ. Одоогоор ${missingLabel} дутуу байна. Үлдсэн мэдээллээ бичээд өгнө үү.`,
              );
              continue;
            }

            // Load business settings for AI
            const settings =
              ((await db.collection("settings").findOne({})) as {
                name?: string;
                phone?: string;
                address?: string;
                hours?: string;
                services?: string;
                prices?: string;
              }) || {};

            const systemPrompt = `
You are a Mongolian AI receptionist.

Business info:
Name: ${settings.name || "Clinic"}
Phone: ${settings.phone || "N/A"}
Address: ${settings.address || "N/A"}
Hours: ${settings.hours || "N/A"}
Services: ${settings.services || "N/A"}
Prices: ${settings.prices || "N/A"}

Answer in Mongolian. If booking, ask for date, time, name, phone.
`;

            let aiReply = "Сайн байна уу!";

            try {
              aiReply = await askGemini(`${systemPrompt}\nUser: ${text}`);
            } catch {
              aiReply = "Уучлаарай, систем түр алдаатай байна.";
            }

            await sendTextMessage(senderId, aiReply);
          }
        }
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(200).json({ ok: true });
    }
  }

  res.status(405).end();
}
