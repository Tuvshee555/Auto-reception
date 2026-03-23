import fetch from "node-fetch";

const IG_TOKEN = process.env.ACCESS_TOKEN;

function requireToken() {
  if (!IG_TOKEN) throw new Error("ACCESS_TOKEN not set");
  return IG_TOKEN;
}

export async function sendTextMessage(recipientId: string, text: string) {
  const token = requireToken();

  const res = await fetch(
    `https://graph.facebook.com/v21.0/me/messages?access_token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_type: "RESPONSE",
        recipient: { id: recipientId },
        message: { text },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Instagram send failed: ${res.status} ${body}`);
  }
}

export async function sendTypingOn(recipientId: string) {
  const token = requireToken();

  const res = await fetch(
    `https://graph.facebook.com/v21.0/me/messages?access_token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        sender_action: "typing_on",
      }),
    },
  );

  if (!res.ok) {
    // Typing indicator failure is non-critical — log and continue
    const body = await res.text().catch(() => "");
    console.warn(`Instagram typing_on failed: ${res.status} ${body}`);
  }
}
