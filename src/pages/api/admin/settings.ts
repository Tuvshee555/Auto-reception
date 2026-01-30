import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "../../../lib/mongo";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const db = await getDb();
  if (req.method === "GET") {
    const settings = await db.collection("settings").findOne({});
    return res.status(200).json(settings || {});
  }
  if (req.method === "POST") {
    const body = req.body;
    await db.collection("settings").replaceOne({}, body, { upsert: true });
    return res.status(200).json({ ok: true });
  }
  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
