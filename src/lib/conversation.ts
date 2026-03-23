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
const MAX_MESSAGES = 20;
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

function buildSystemPrompt(options: {
  systemPrompt: string;
  business: {
    name?: string;
    phone?: string;
    address?: string;
    hours?: string;
    services?: string;
    products?: string;
    sizes?: string;
    shipping?: string;
    returns?: string;
    prices?: string;
    links?: string;
  };
}): string {
  const { systemPrompt, business } = options;
  const lines: string[] = [];

  lines.push(systemPrompt.trim());
  lines.push("");
  lines.push("Rules:");
  lines.push("- Always answer in Mongolian (Монгол хэлээр хариул).");
  lines.push("- Be friendly, natural, and conversational — like a real shop assistant chatting on Messenger.");
  lines.push("- Keep replies concise but complete. Do not cut off a useful answer just to be short.");
  lines.push("- Use correct Mongolian spelling and grammar.");
  lines.push("- Only state facts supported by the business info or the conversation history.");
  lines.push("- Never invent prices, availability, policies, links, addresses, or delivery times.");
  lines.push("- Use business info when answering about products, prices, sizes, shipping, returns, or contact.");
  lines.push("- Mention the website or social link only if the user asks where to find products or more info.");
  lines.push("- Do not repeat the same greeting or the same information twice.");
  lines.push("- If info is missing from the business data, say you are not sure and offer to connect with a human.");
  lines.push('- When unsure, say: "Энэ мэдээлэл одоогоор тодорхойгүй байна. Хүний ажилтантай холбож өгье."');
  lines.push("- If the user wants to book or reserve, collect: date, time, name, and phone number.");
  lines.push("- If the user only greets, respond with one short greeting and offer to help.");
  lines.push("- Ask at most one follow-up question per message.");
  lines.push("");
  lines.push("Business info:");
  lines.push(`Name: ${business?.name || "N/A"}`);
  lines.push(`Phone: ${business?.phone || "N/A"}`);
  lines.push(`Address: ${business?.address || "N/A"}`);
  lines.push(`Hours: ${business?.hours || "N/A"}`);
  lines.push(`Services: ${business?.services || "N/A"}`);
  lines.push(`Products: ${business?.products || "N/A"}`);
  lines.push(`Sizes: ${business?.sizes || "N/A"}`);
  lines.push(`Shipping: ${business?.shipping || "N/A"}`);
  lines.push(`Returns: ${business?.returns || "N/A"}`);
  lines.push(`Prices: ${business?.prices || "N/A"}`);
  lines.push(`Links: ${business?.links || "N/A"}`);

  return lines.join("\n");
}

export function buildMessages(options: {
  systemPrompt: string;
  business: {
    name?: string;
    phone?: string;
    address?: string;
    hours?: string;
    services?: string;
    products?: string;
    sizes?: string;
    shipping?: string;
    returns?: string;
    prices?: string;
    links?: string;
  };
  history: ChatMessage[];
  userText: string;
}): {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
} {
  const { history, userText } = options;

  const system = buildSystemPrompt({
    systemPrompt: options.systemPrompt,
    business: options.business,
  });

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of history) {
    messages.push({ role: m.role, content: m.text });
  }
  messages.push({ role: "user", content: userText });

  return { system, messages };
}
