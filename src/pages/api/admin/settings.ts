import type { NextApiRequest, NextApiResponse } from "next";
import { checkAdminAuth } from "../../../lib/adminAuth";
import { readBusinessData, writeBusinessData } from "../../../lib/businessData";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!checkAdminAuth(req, res)) return;

  if (req.method === "GET") {
    const data = await readBusinessData();
    return res.status(200).json(data.business || {});
  }

  if (req.method === "POST") {
    const data = req.body;
    const current = await readBusinessData();
    await writeBusinessData({
      ...current,
      business: {
        ...(current.business || {}),
        ...(data || {}),
      },
    });

    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
