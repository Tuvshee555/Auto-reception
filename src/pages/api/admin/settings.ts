import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "../../../lib/mongo";
import { checkAdminAuth } from "../../../lib/adminAuth";

type SettingsInput = {
  name?: unknown;
  address?: unknown;
  hours?: unknown;
  services?: unknown;
};

function normalizeSettings(body: SettingsInput) {
  const services =
    Array.isArray(body?.services) &&
    body.services.every((s: unknown) => typeof s === "string")
      ? (body.services as string[])
      : [];
  return {
    name: typeof body?.name === "string" ? body.name.trim() : "",
    address: typeof body?.address === "string" ? body.address.trim() : "",
    hours: typeof body?.hours === "string" ? body.hours.trim() : "",
    services,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!checkAdminAuth(req, res)) return;

  const db = await getDb();
  if (req.method === "GET") {
    const settings = await db.collection("settings").findOne({});
    return res.status(200).json(settings || {});
  }
  if (req.method === "POST") {
    const normalized = normalizeSettings(req.body);
    const errors = [];
    if (!normalized.name) errors.push("name");
    if (!normalized.address) errors.push("address");
    if (!normalized.hours) errors.push("hours");
    if (normalized.services.length === 0) errors.push("services");
    if (errors.length) return res.status(400).json({ error: "missing_fields", fields: errors });

    await db.collection("settings").replaceOne({}, normalized, { upsert: true });
    return res.status(200).json({ ok: true });
  }
  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
