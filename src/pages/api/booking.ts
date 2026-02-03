import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "../../lib/mongo";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end();
  const { name, phone, date, service } = req.body || {};

  const errors: string[] = [];
  const cleanName = typeof name === "string" ? name.trim() : "";
  const cleanPhone = typeof phone === "string" ? phone.trim() : "";
  const cleanService = typeof service === "string" ? service.trim() : "";
  const parsedDate = date ? new Date(date) : null;

  if (!cleanName) errors.push("name");
  if (!cleanPhone) errors.push("phone");
  if (!parsedDate || isNaN(parsedDate.getTime())) errors.push("date");
  if (!cleanService) errors.push("service");

  // Simple E.164-ish phone validation (basic)
  if (cleanPhone && !/^[+]?\\d[\\d\\s-]{5,15}$/.test(cleanPhone)) {
    errors.push("phone_format");
  }

  if (errors.length) {
    return res.status(400).json({ error: "invalid_fields", fields: errors });
  }

  const db = await getDb();
  const booking = {
    name: cleanName,
    phone: cleanPhone,
    date: parsedDate!,
    service: cleanService,
    status: "confirmed",
    createdAt: new Date(),
  };
  await db.collection("bookings").insertOne(booking);
  return res.status(201).json({ ok: true });
}
