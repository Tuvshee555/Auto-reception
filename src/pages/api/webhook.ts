/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { getDb } from "../../lib/mongo";
import { askGemini } from "../../lib/gemini";
import { sendTextMessage, sendTypingOn } from "../../lib/messenger";
import { rateLimit } from "../../lib/rateLimit";

const VERIFY = process.env.FACEBOOK_VERIFY_TOKEN;
const APP_SECRET = process.env.FACEBOOK_APP_SECRET;
if (!APP_SECRET) {
  console.error(
    "FACEBOOK_APP_SECRET not set — webhook POSTs will be rejected to avoid insecure signature verification",
  );
}

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req: NextApiRequest) {
  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === "GET") {
    const mode = req.query["hub.mode"] as string;
    const token = req.query["hub.verify_token"] as string;
    const challenge = req.query["hub.challenge"] as string;

    if (!VERIFY) return res.status(503).send("Server misconfigured");

    console.log("VERIFY REQUEST:", { mode, token, challenge, VERIFY });

    if (mode === "subscribe" && token === VERIFY) {
      return res.status(200).send(challenge);
    }

    return res.status(403).send("Verification failed");
  }

  if (req.method === "POST") {
    try {
      if (!APP_SECRET || !VERIFY) {
        console.error(
          "Refusing to process POST: FACEBOOK_APP_SECRET or VERIFY token missing.",
        );
        return res.status(503).send("Server misconfigured");
      }
      // Read raw body to verify signature
      const raw = await getRawBody(req);
      const sigHeader = (req.headers["x-hub-signature-256"] || "") as string;
      if (!sigHeader || !sigHeader.startsWith("sha256=")) {
        console.warn("Missing or malformed x-hub-signature-256 header");
        return res.status(403).send("Forbidden");
      }

      const expected =
        crypto.createHmac("sha256", APP_SECRET).update(raw).digest("hex");
      const provided = sigHeader.replace("sha256=", "");

      let signatureValid = false;
      try {
        const a = Buffer.from(expected);
        const b = Buffer.from(provided);
        if (a.length === b.length && crypto.timingSafeEqual(a, b))
          signatureValid = true;
      } catch {
        signatureValid = false;
      }
      if (!signatureValid) {
        console.warn("Invalid webhook signature");
        return res.status(403).send("Forbidden");
      }

      // parse body after verification
      let body: any = {};
      try {
        body = JSON.parse(raw.toString("utf8"));
      } catch {
        console.warn("Invalid JSON body");
        return res.status(400).send("Bad Request");
      }

      // Respond quickly to Facebook and process asynchronously (best-effort)
      res.status(200).json({ ok: true });

      (async () => {
        try {
          if (body.object === "page") {
            for (const entry of body.entry || []) {
              for (const event of entry.messaging || []) {
                if (event.message && event.sender) {
                  const senderId = event.sender.id;
                  const text = event.message.text || "";

                  const limit = rateLimit(`fb:${senderId}`, 20, 10 * 60 * 1000); // 20 msgs per 10 minutes
                  if (!limit.allowed) {
                    await sendTextMessage(
                      senderId,
                      "Таны хүсэлт түр хугацаанд хязгаарлагдлаа. Дараа дахин оролдоорой.",
                    ).catch(() => {});
                    continue;
                  }

                  await sendTypingOn(senderId).catch(() => {});

                  let aiReply = "Сайн байна уу! Түр хүлээнэ үү.";

                  try {
                    const db = await getDb();
                    const settings =
                      (await db.collection("settings").findOne({})) || {};
                    const systemPrompt = `You are a Mongolian receptionist for ${
                      (settings as any).name || "the clinic"
                    }.`;
                    aiReply = await askGemini(`${systemPrompt}\nUser: ${text}`);
                  } catch (aiErr) {
                    console.error("AI error:", aiErr);
                  }

                  await sendTextMessage(senderId, aiReply).catch(() => {});
                }
              }
            }
          }
        } catch (err) {
          console.error("Background webhook processing error:", err);
        }
      })();
    } catch (err) {
      console.error("Webhook crash:", err);
      // If we haven't responded yet, respond gracefully
      if (!res.writableEnded) {
        return res.status(200).json({ ok: true }); // NEVER 500 for webhook
      }
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
