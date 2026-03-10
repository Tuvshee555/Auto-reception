import fetch from "node-fetch";

// const IG_TOKEN = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
const IG_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

function requireToken() {
  if (!IG_TOKEN) throw new Error("INSTAGRAM_PAGE_ACCESS_TOKEN not set");
  return IG_TOKEN;
}

function requireIgUserId(igUserId?: string | null) {
  if (!igUserId) throw new Error("INSTAGRAM_BUSINESS_ID not available");
  return igUserId;
}

export async function sendTextMessage(
  igUserId: string,
  recipientId: string,
  text: string,
) {
  const token = requireToken();
  const id = requireIgUserId(igUserId);
  const res = await fetch(
    `https://graph.facebook.com/v16.0/${id}/messages?access_token=${token}`,
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
