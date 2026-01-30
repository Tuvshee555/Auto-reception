import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "../../../lib/mongo";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const db = await getDb();
  if (req.method === "GET") {
    const list = await db
      .collection("bookings")
      .find({})
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();
    return res.status(200).json(list);
  }
  res.setHeader("Allow", ["GET"]);
  res.status(405).end();
}
