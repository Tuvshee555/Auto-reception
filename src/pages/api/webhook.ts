import type { NextApiRequest, NextApiResponse } from "next";
import { askOpenAI } from "../../lib/openai";
import { sendTextMessage, sendTypingOn } from "../../lib/messenger";
import { sendTextMessage as sendIgTextMessage } from "../../lib/instagram";
import { rateLimit } from "../../lib/rateLimit";
import { readBusinessData } from "../../lib/businessData";
import { appendMessage, buildPrompt, getHistory } from "../../lib/conversation";
import { fixMojibake } from "../../lib/encoding";

const FB_VERIFY = process.env.FACEBOOK_VERIFY_TOKEN;
const IG_VERIFY = process.env.INSTAGRAM_VERIFY_TOKEN;

type Platform = "facebook" | "instagram";

const PROCESSED_EVENT_TTL_MS = 2 * 60 * 1000;
const processedEvents = new Map<string, number>();
const activeConversations = new Set<string>();

function verifyToken(token: unknown) {
  return token === FB_VERIFY || token === IG_VERIFY;
}

function pruneProcessedEvents() {
  const now = Date.now();
  for (const [key, timestamp] of processedEvents.entries()) {
    if (now - timestamp > PROCESSED_EVENT_TTL_MS) {
      processedEvents.delete(key);
    }
  }
}

function buildEventKey(
  platform: Platform,
  senderId: string,
  event: { message?: { mid?: string; text?: string } },
) {
  const mid = event.message?.mid?.trim();
  if (mid) return `${platform}:mid:${mid}`;

  const normalizedText = (event.message?.text || "").trim().toLowerCase();
  return `${platform}:fallback:${senderId}:${normalizedText}`;
}

function markEventProcessed(key: string) {
  pruneProcessedEvents();
  if (processedEvents.has(key)) return false;
  processedEvents.set(key, Date.now());
  return true;
}

async function handleMessage(
  platform: Platform,
  senderId: string,
  text: string,
  igUserId?: string | null,
) {
  const limit = rateLimit(
    `${platform === "facebook" ? "fb" : "ig"}:${senderId}`,
    20,
    10 * 60 * 1000,
  );
  if (!limit.allowed) {
    const waitMsg = "Түр хүлээнэ үү, дараа оролдоно уу.";
    if (platform === "facebook") await sendTextMessage(senderId, waitMsg);
    else await sendIgTextMessage(igUserId || "", senderId, waitMsg);
    return;
  }

  if (platform === "facebook") await sendTypingOn(senderId);

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
  else await sendIgTextMessage(igUserId || "", senderId, safeReply);
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

      console.log("WEBHOOK BODY:", JSON.stringify(body, null, 2));

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
            const eventKey = buildEventKey(platform, senderId, event);
            if (!markEventProcessed(eventKey)) {
              console.log("Skipping duplicate webhook event", { platform, eventKey });
              continue;
            }

            const igUserId = platform === "instagram" ? entry.id : undefined;
            if (platform === "instagram" && !igUserId) {
              console.error("Instagram entry.id missing; cannot reply.");
              continue;
            }

            const conversationKey = `${platform}:${senderId}`;
            if (activeConversations.has(conversationKey)) {
              console.log("Skipping overlapping conversation event", {
                platform,
                senderId,
              });
              continue;
            }

            activeConversations.add(conversationKey);
            try {
              await handleMessage(platform, senderId, text, igUserId);
            } finally {
              activeConversations.delete(conversationKey);
            }
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
