import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "../../lib/mongo";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end();
  const { name, phone, date, service } = req.body || {};
  if (!name || !phone || !date)
    return res.status(400).json({ error: "missing" });
  const db = await getDb();
  const booking = {
    name,
    phone,
    date: new Date(date),
    service,
    status: "confirmed",
    createdAt: new Date(),
  };
  await db.collection("bookings").insertOne(booking);
  return res.status(201).json({ ok: true });
}
