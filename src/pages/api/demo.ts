/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from "next";
import { askGemini } from "../../lib/gemini";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end();
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: "missing text" });

  try {
    const systemPrompt = `You are a helpful Mongolian receptionist. Answer concisely in Mongolian. If user asks to book, ask for date, time, name, and phone. Use only info given.`;
    const reply = await askGemini(`${systemPrompt}\nUser: ${text}`);
    return res.status(200).json({ reply });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message || "server" });
  }
}
