/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { getDb } from "../../lib/mongo";
import { askGemini } from "../../lib/gemini";
import { sendTextMessage, sendTypingOn } from "../../lib/messenger";
import { rateLimit } from "../../lib/rateLimit";

const VERIFY = process.env.FACEBOOK_VERIFY_TOKEN;
const APP_SECRET = process.env.FACEBOOK_APP_SECRET;

export const config = {
  api: { bodyParser: false },
};

async function getRawBody(req: NextApiRequest) {
  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // ---------------- VERIFY ----------------
  if (req.method === "GET") {
    const mode = req.query["hub.mode"] as string;
    const token = req.query["hub.verify_token"] as string;
    const challenge = req.query["hub.challenge"] as string;

    if (!VERIFY) return res.status(503).send("Server misconfigured");
    if (mode === "subscribe" && token === VERIFY)
      return res.status(200).send(challenge);

    return res.status(403).send("Verification failed");
  }

  // ---------------- MESSAGE EVENTS ----------------
  if (req.method === "POST") {
    try {
      if (!APP_SECRET || !VERIFY)
        return res.status(503).send("Server misconfigured");

      const raw = await getRawBody(req);

      // --- Signature verification ---
      const sigHeader = (req.headers["x-hub-signature-256"] || "") as string;
      if (!sigHeader.startsWith("sha256="))
        return res.status(403).send("Forbidden");

      const expected = crypto
        .createHmac("sha256", APP_SECRET)
        .update(raw)
        .digest("hex");

      const provided = sigHeader.replace("sha256=", "");
      if (
        expected.length !== provided.length ||
        !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
      ) {
        return res.status(403).send("Forbidden");
      }

      const body = JSON.parse(raw.toString("utf8"));

      // 🚀 RESPOND TO FACEBOOK IMMEDIATELY
      res.status(200).json({ ok: true });

      // 🧠 Process in background (DO NOT TOUCH res after this)
      setImmediate(async () => {
        try {
          if (body.object !== "page") return;

          for (const entry of body.entry || []) {
            for (const event of entry.messaging || []) {
              if (!event.message || !event.sender) continue;

              const senderId = event.sender.id;
              const text = event.message.text || "";

              const limit = rateLimit(`fb:${senderId}`, 20, 10 * 60 * 1000);
              if (!limit.allowed) {
                await sendTextMessage(
                  senderId,
                  "Таны хүсэлт түр хугацаанд хязгаарлагдлаа. Дараа дахин оролдоорой.",
                );
                continue;
              }

              await sendTypingOn(senderId);

              let aiReply = "Сайн байна уу! Түр хүлээнэ үү.";

              try {
                const db = await getDb();
                const settings =
                  (await db.collection("settings").findOne({})) || {};
                const systemPrompt = `You are a Mongolian receptionist for ${
                  (settings as any).name || "the clinic"
                }.`;
                aiReply = await askGemini(`${systemPrompt}\nUser: ${text}`);
              } catch (err) {
                console.error("AI error:", err);
              }

              await sendTextMessage(senderId, aiReply);
            }
          }
        } catch (err) {
          console.error("Background processing error:", err);
        }
      });

      return; // 🔥 CRITICAL: stop execution here
    } catch (err) {
      console.error("Webhook crash:", err);
      if (!res.writableEnded) res.status(200).json({ ok: true });
      return;
    }
  }

  // ---------------- FALLBACK ----------------
  if (!res.writableEnded) {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
