// minimal Gemini wrapper — adjust model name in env
import fetch from "node-fetch";

const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "models/text-bison-001";
if (!KEY) throw new Error("GEMINI_API_KEY not set");

export async function askGemini(prompt: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta2/${MODEL}:generateText`;
  const body = {
    prompt: { text: prompt },
    temperature: 0.1,
    maxOutputTokens: 512,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini error: ${res.status} ${txt}`);
  }
  type GeminiResponse = {
    candidates?: { content?: string }[];
    output?: { content?: string }[];
  };
  const data = (await res.json()) as GeminiResponse;
  // attempt to read output text
  const out =
    data?.candidates?.[0]?.content || data?.output?.[0]?.content || "";
  return String(out);
}
