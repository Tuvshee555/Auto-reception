import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "../../../lib/mongo";
import { checkAdminAuth } from "../../../lib/adminAuth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!checkAdminAuth(req, res)) return;

  const db = await getDb();

  if (req.method === "GET") {
    const settings = (await db.collection("settings").findOne({})) || {};
    return res.status(200).json(settings);
  }

  if (req.method === "POST") {
    const data = req.body;

    await db
      .collection("settings")
      .updateOne({}, { $set: data }, { upsert: true });

    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
