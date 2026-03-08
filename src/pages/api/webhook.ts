import type { NextApiRequest, NextApiResponse } from "next";
import { askGemini } from "../../lib/gemini";
import { sendTextMessage, sendTypingOn } from "../../lib/messenger";
import { rateLimit } from "../../lib/rateLimit";
import { readBusinessData } from "../../lib/businessData";
import { appendMessage, buildPrompt, getHistory } from "../../lib/conversation";
import { fixMojibake } from "../../lib/encoding";

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

      if (body.object === "page") {
        for (const entry of body.entry || []) {
          for (const event of entry.messaging || []) {
            if (!event.message || !event.sender) continue;

            const senderId = event.sender.id;
            const text = event.message.text || "";

            // Rate limit
            const limit = rateLimit(`fb:${senderId}`, 20, 10 * 60 * 1000);
            if (!limit.allowed) {
              await sendTextMessage(senderId, "Түр хүлээнэ үү, дараа оролдоно уу.");
              continue;
            }

            await sendTypingOn(senderId);

            // Load business settings for AI
            const { systemPrompt, business } = await readBusinessData();
            const history = getHistory(senderId);
            const prompt = buildPrompt({
              systemPrompt:
                systemPrompt || "You are a Mongolian AI receptionist.",
              business: business || {},
              history,
              userText: text,
            });

            let aiReply = "Сайн байна уу!";

            try {
              aiReply = await askGemini(prompt);
            } catch {
              aiReply = "Уучлаарай, систем түр алдаатай байна.";
            }

            const safeReply = fixMojibake(aiReply);
            appendMessage(senderId, "user", text);
            appendMessage(senderId, "assistant", safeReply);

            await sendTextMessage(senderId, safeReply);
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
