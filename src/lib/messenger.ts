import fetch from "node-fetch";
const PAGE_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
if (!PAGE_TOKEN) throw new Error("FACEBOOK_PAGE_ACCESS_TOKEN not set");

export async function sendTextMessage(recipientId: string, text: string) {
  await fetch(
    `https://graph.facebook.com/v16.0/me/messages?access_token=${PAGE_TOKEN}`,
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
}

export async function sendTypingOn(recipientId: string) {
  await fetch(
    `https://graph.facebook.com/v16.0/me/messages?access_token=${PAGE_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        sender_action: "typing_on",
      }),
    },
  );
}
