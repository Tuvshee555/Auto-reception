import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "../../lib/mongo";
import { askGemini } from "../../lib/gemini";
import { sendTextMessage, sendTypingOn } from "../../lib/messenger";
import { rateLimit } from "../../lib/rateLimit";

const VERIFY = process.env.FACEBOOK_VERIFY_TOKEN;

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
              await sendTextMessage(
                senderId,
                "Түр хүлээнэ үү, дараа оролдоно уу.",
              );
              continue;
            }

            await sendTypingOn(senderId);

            // Detect booking intent
            const wantsBooking = /tsag|цаг|book|appointment|захиал/i.test(text);
            if (wantsBooking) {
              await db.collection("bookings").insertOne({
                senderId,
                message: text,
                status: "pending",
                createdAt: new Date(),
              });
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
