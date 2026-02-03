import type { NextApiRequest, NextApiResponse } from "next";
import { checkAdminAuth, clearAdminCookie, setAdminCookie } from "../../../lib/adminAuth";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!process.env.ADMIN_TOKEN) {
    return res.status(503).json({ error: "Server misconfigured" });
  }

  if (req.method === "POST") {
    const { token } = req.body || {};
    if (token !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    setAdminCookie(res);
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    clearAdminCookie(res);
    return res.status(200).json({ ok: true });
  }

  if (req.method === "GET") {
    if (checkAdminAuth(req, res)) return res.status(200).json({ ok: true });
    return; // checkAdminAuth already responded
  }

  res.setHeader("Allow", ["POST", "DELETE", "GET"]);
  return res.status(405).end();
}
