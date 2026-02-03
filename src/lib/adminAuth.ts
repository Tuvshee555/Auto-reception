import type { NextApiRequest, NextApiResponse } from "next";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

export function checkAdminAuth(req: NextApiRequest, res: NextApiResponse) {
  if (!ADMIN_TOKEN) {
    res.status(503).json({ error: "Server misconfigured: ADMIN_TOKEN missing" });
    return false;
  }

  const headerToken = req.headers["x-admin-token"];
  const cookieToken = req.cookies?.admin_auth;

  if (headerToken === ADMIN_TOKEN || cookieToken === ADMIN_TOKEN) {
    return true;
  }

  res.status(401).json({ error: "Unauthorized" });
  return false;
}

export function setAdminCookie(res: NextApiResponse) {
  if (!ADMIN_TOKEN) return;
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  res.setHeader(
    "Set-Cookie",
    `admin_auth=${ADMIN_TOKEN}; HttpOnly; Path=/; SameSite=Lax;${secure}`,
  );
}

export function clearAdminCookie(res: NextApiResponse) {
  res.setHeader(
    "Set-Cookie",
    "admin_auth=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax",
  );
}
