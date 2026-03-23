/* eslint-disable @typescript-eslint/no-explicit-any */
import { fixMojibake } from "./encoding";

const KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

if (!KEY) throw new Error("OPENAI_API_KEY not set");

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function askOpenAI(
  system: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string> {
  const payload: ChatMessage[] = [
    { role: "system", content: system },
    ...messages,
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: payload,
      max_tokens: 400,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error("OpenAI error", {
      status: res.status,
      statusText: res.statusText,
      body: txt,
    });
    throw new Error(`OpenAI error: ${res.status} ${txt}`);
  }

  const data: any = await res.json();
  const raw: string = data.choices?.[0]?.message?.content?.trim() || "";
  return fixMojibake(raw);
}
