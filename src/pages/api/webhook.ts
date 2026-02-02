/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "../../lib/mongo";
import { askGemini } from "../../lib/gemini";
import { sendTextMessage, sendTypingOn } from "../../lib/messenger";

const VERIFY = process.env.FACEBOOK_VERIFY_TOKEN || "verify";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === "GET") {
    const mode = req.query["hub.mode"] as string;
    const token = req.query["hub.verify_token"] as string;
    const challenge = req.query["hub.challenge"] as string;

    console.log("VERIFY REQUEST:", { mode, token, challenge, VERIFY });

    if (mode === "subscribe" && token === VERIFY) {
      return res.status(200).send(challenge);
    }

    return res.status(403).send("Verification failed");
  }

  if (req.method === "POST") {
    try {
      const body = req.body;

      if (body.object === "page") {
        for (const entry of body.entry || []) {
          for (const event of entry.messaging || []) {
            if (event.message && event.sender) {
              const senderId = event.sender.id;
              const text = event.message.text || "";

              await sendTypingOn(senderId).catch(() => {});

              let aiReply = "Сайн байна уу! Түр хүлээнэ үү.";

              try {
                const db = await getDb();
                const settings =
                  (await db.collection("settings").findOne({})) || {};
                const systemPrompt = `You are a Mongolian receptionist for ${(settings as any).name || "the clinic"}.`;
                aiReply = await askGemini(`${systemPrompt}\nUser: ${text}`);
              } catch (aiErr) {
                console.error("AI error:", aiErr);
              }

              await sendTextMessage(senderId, aiReply).catch(() => {});
            }
          }
        }
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("Webhook crash:", err);
      return res.status(200).json({ ok: true }); // NEVER 500 for webhook
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
