/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from "next";
import { askOpenAI } from "../../lib/openai";
import { getClientKey, rateLimit } from "../../lib/rateLimit";
import { readBusinessData } from "../../lib/businessData";
import { appendMessage, buildMessages, getHistory } from "../../lib/conversation";
import { fixMojibake } from "../../lib/encoding";
import { sanitizeAssistantReply } from "../../lib/reply";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end();
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: "missing text" });

  const key = `demo:${getClientKey(req)}`;
  const limit = rateLimit(key, 30, 5 * 60 * 1000);
  if (!limit.allowed) {
    return res.status(429).json({ error: "rate_limited", reset: limit.reset });
  }

  try {
    const { systemPrompt, business } = await readBusinessData();
    const sessionId = `demo:${getClientKey(req)}`;
    const history = getHistory(sessionId);
    const { system, messages } = buildMessages({
      systemPrompt: systemPrompt || "You are a friendly Mongolian AI receptionist.",
      business: business || {},
      history,
      userText: text,
    });
    const raw = await askOpenAI(system, messages);
    const reply = sanitizeAssistantReply(fixMojibake(raw));
    appendMessage(sessionId, "user", text);
    appendMessage(sessionId, "assistant", reply);
    return res.status(200).json({ reply });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message || "server" });
  }
}
