/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "../../lib/mongo";
import { askGemini } from "../../lib/gemini";
import { sendTextMessage, sendTypingOn } from "../../lib/messenger";

const VERIFY = process.env.FACEBOOK_VERIFY_TOKEN || "verify";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === VERIFY)
      return res.status(200).send(String(challenge));
    return res.status(403).send("invalid verify");
  }

  if (req.method === "POST") {
    const body = req.body;
    try {
      if (body.object === "page") {
        for (const entry of body.entry || []) {
          for (const event of entry.messaging || []) {
            if (event.message && event.sender) {
              const senderId = event.sender.id;
              const text = event.message.text || "";
              sendTypingOn(senderId).catch(() => {});
              const db = await getDb();
              const settings =
                (await db.collection("settings").findOne({})) || {};
              const systemPrompt = `You are a Mongolian receptionist for ${(settings as any).name || "the clinic"}. Answer in Mongolian. Use the provided services and hours when relevant. If user wants to book, ask for date, time, name and phone.`;
              const aiReply = await askGemini(`${systemPrompt}\nUser: ${text}`);
              const lower = text.toLowerCase();
              const wantsBooking =
                /tsag|tsag awah|tsag avah|avah|book| захиал|захиалгаа/i.test(
                  lower,
                );
              if (wantsBooking) {
                await db.collection("bookings").insertOne({
                  senderId,
                  rawMessage: text,
                  status: "pending",
                  createdAt: new Date(),
                });
              }
              await sendTextMessage(senderId, aiReply).catch(() => {});
            }
          }
        }
        return res.status(200).json({ ok: true });
      }
      return res.status(404).end();
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "server error" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
