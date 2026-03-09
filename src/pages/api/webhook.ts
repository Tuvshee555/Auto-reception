import type { NextApiRequest, NextApiResponse } from "next";
import { askOpenAI } from "../../lib/openai";
import { sendTextMessage, sendTypingOn } from "../../lib/messenger";
import {
  sendTextMessage as sendIgTextMessage,
  sendTypingOn as sendIgTypingOn,
} from "../../lib/instagram";
import { rateLimit } from "../../lib/rateLimit";
import { readBusinessData } from "../../lib/businessData";
import { appendMessage, buildPrompt, getHistory } from "../../lib/conversation";
import { fixMojibake } from "../../lib/encoding";

const FB_VERIFY = process.env.FACEBOOK_VERIFY_TOKEN;
const IG_VERIFY = process.env.INSTAGRAM_VERIFY_TOKEN;

type Platform = "facebook" | "instagram";

function verifyToken(token: unknown) {
  return token === FB_VERIFY || token === IG_VERIFY;
}

async function handleMessage(
  platform: Platform,
  senderId: string,
  text: string,
) {
  const limit = rateLimit(
    `${platform === "facebook" ? "fb" : "ig"}:${senderId}`,
    20,
    10 * 60 * 1000,
  );
  if (!limit.allowed) {
    const waitMsg = "Түр хүлээнэ үү, дараа оролдоно уу.";
    if (platform === "facebook") await sendTextMessage(senderId, waitMsg);
    else await sendIgTextMessage(senderId, waitMsg);
    return;
  }

  if (platform === "facebook") await sendTypingOn(senderId);
  else await sendIgTypingOn(senderId);

  const { systemPrompt, business } = await readBusinessData();
  const history = getHistory(senderId);
  const prompt = buildPrompt({
    systemPrompt: systemPrompt || "You are a Mongolian AI receptionist.",
    business: business || {},
    history,
    userText: text,
  });

  let aiReply = "Сайн байна уу!";

  try {
    aiReply = await askOpenAI(prompt);
  } catch {
    aiReply = "Уучлаарай, систем түр алдаатай байна.";
  }

  const safeReply = fixMojibake(aiReply);
  appendMessage(senderId, "user", text);
  appendMessage(senderId, "assistant", safeReply);

  if (platform === "facebook") await sendTextMessage(senderId, safeReply);
  else await sendIgTextMessage(senderId, safeReply);
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
    if (mode === "subscribe" && verifyToken(token))
      return res.status(200).send(challenge as string);
    return res.status(403).send("Verification failed");
  }

  // ---------- MESSAGES ----------
  if (req.method === "POST") {
    try {
      const body = req.body;

      if (body.object === "page" || body.object === "instagram") {
        const platform: Platform =
          body.object === "page" ? "facebook" : "instagram";
        for (const entry of body.entry || []) {
          for (const event of entry.messaging || []) {
            if (!event.message || !event.sender) continue;
            if (event.message.is_echo) continue;

            const senderId = event.sender.id;
            const text = (event.message.text || "").trim();
            if (!text) continue;

            await handleMessage(platform, senderId, text);
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
