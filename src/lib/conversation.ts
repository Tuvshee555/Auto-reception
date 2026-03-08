export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  text: string;
};

type ChatSession = {
  messages: ChatMessage[];
  updatedAt: number;
};

const STORE = new Map<string, ChatSession>();
const MAX_MESSAGES = 12;
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

function prune() {
  const now = Date.now();
  for (const [key, session] of STORE.entries()) {
    if (now - session.updatedAt > SESSION_TTL_MS) STORE.delete(key);
  }
}

export function getHistory(id: string): ChatMessage[] {
  prune();
  return STORE.get(id)?.messages || [];
}

export function appendMessage(id: string, role: ChatRole, text: string) {
  prune();
  const session = STORE.get(id) || { messages: [], updatedAt: Date.now() };
  session.messages.push({ role, text });
  if (session.messages.length > MAX_MESSAGES) {
    session.messages = session.messages.slice(-MAX_MESSAGES);
  }
  session.updatedAt = Date.now();
  STORE.set(id, session);
}

export function buildPrompt(options: {
  systemPrompt: string;
  business: {
    name?: string;
    phone?: string;
    address?: string;
    hours?: string;
    services?: string;
    prices?: string;
    links?: string;
  };
  history: ChatMessage[];
  userText: string;
}) {
  const { systemPrompt, business, history, userText } = options;
  const lines: string[] = [];
  lines.push(systemPrompt.trim());
  lines.push("");
  lines.push("Rules:");
  lines.push("- Answer in Mongolian.");
  lines.push("- If the user explicitly asks to book/reserve/appointment, collect date, time, name, and phone.");
  lines.push("- Ask only for missing items and do not repeat the same question if the user has not provided new info.");
  lines.push("- If the user did not ask to book, do not ask for booking details.");
  lines.push("- Use only the business info below when asked about it.");
  lines.push("");
  lines.push("Business info:");
  lines.push(`Name: ${business?.name || "N/A"}`);
  lines.push(`Phone: ${business?.phone || "N/A"}`);
  lines.push(`Address: ${business?.address || "N/A"}`);
  lines.push(`Hours: ${business?.hours || "N/A"}`);
  lines.push(`Services: ${business?.services || "N/A"}`);
  lines.push(`Prices: ${business?.prices || "N/A"}`);
  lines.push(`Links: ${business?.links || "N/A"}`);
  lines.push("");
  if (history.length) {
    lines.push("Conversation so far:");
    for (const m of history) {
      const role = m.role === "user" ? "User" : "Assistant";
      lines.push(`${role}: ${m.text}`);
    }
    lines.push("");
  }
  lines.push(`User: ${userText}`);
  lines.push("Assistant:");
  return lines.join("\n");
}
