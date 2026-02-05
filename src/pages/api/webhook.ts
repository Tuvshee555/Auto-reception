/* eslint-disable @typescript-eslint/no-explicit-any */
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
  // ---------------- VERIFY HANDSHAKE ----------------
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY) {
      return res.status(200).send(challenge as string);
    }
    return res.status(403).send("Verification failed");
  }

  // ---------------- MESSAGE EVENTS ----------------
  if (req.method === "POST") {
    try {
      const body = req.body;

      if (body.object === "page") {
        for (const entry of body.entry || []) {
          for (const event of entry.messaging || []) {
            if (!event.message || !event.sender) continue;

            const senderId = event.sender.id;
            const text = event.message.text || "";

            // Rate limit
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
              }. Answer in Mongolian. If user wants to book, ask for date, time, name and phone.`;

              aiReply = await askGemini(`${systemPrompt}\nUser: ${text}`);
            } catch (err) {
              console.error("AI error:", err);
              aiReply =
                "Уучлаарай, систем түр алдаатай байна. Дахин оролдоно уу.";
            }

            await sendTextMessage(senderId, aiReply);
          }
        }
      }

      // Respond AFTER processing (serverless safe)
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("Webhook crash:", err);
      return res.status(200).json({ ok: true }); // never 500 for FB
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
