import type { NextApiRequest, NextApiResponse } from "next";
import { askGemini } from "../../lib/gemini";
import { sendTextMessage, sendTypingOn } from "../../lib/messenger";
import { rateLimit } from "../../lib/rateLimit";
import { readBusinessData } from "../../lib/businessData";

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
              await sendTextMessage(senderId, "Ð¢Ò¯Ñ€ Ñ…Ò¯Ð»ÑÑÐ½Ñ Ò¯Ò¯, Ð´Ð°Ñ€Ð°Ð° Ð¾Ñ€Ð¾Ð»Ð´Ð¾Ð½Ð¾ ÑƒÑƒ.");
              continue;
            }

            await sendTypingOn(senderId);

            // Load business settings for AI
            const { systemPrompt, business } = await readBusinessData();

            const systemPromptText = `
${systemPrompt || "You are a Mongolian AI receptionist."}

Business info:
Name: ${business?.name || "Clinic"}
Phone: ${business?.phone || "N/A"}
Address: ${business?.address || "N/A"}
Hours: ${business?.hours || "N/A"}
Services: ${business?.services || "N/A"}
Prices: ${business?.prices || "N/A"}
Links: ${business?.links || "N/A"}

Answer in Mongolian.
`;

            let aiReply = "Ð¡Ð°Ð¹Ð½ Ð±Ð°Ð¹Ð½Ð° ÑƒÑƒ!";

            try {
              aiReply = await askGemini(`${systemPromptText}\nUser: ${text}`);
            } catch {
              aiReply = "Ð£ÑƒÑ‡Ð»Ð°Ð°Ñ€Ð°Ð¹, ÑÐ¸ÑÑ‚ÐµÐ¼ Ñ‚Ò¯Ñ€ Ð°Ð»Ð´Ð°Ð°Ñ‚Ð°Ð¹ Ð±Ð°Ð¹Ð½Ð°.";
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
