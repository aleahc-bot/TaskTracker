import { db, CLIENTS, readAll, newId, str, send, fail } from "./_lib.js";

// POST /api/clients  { action: "create", client: {name, platform, logo} } | { action: "delete", id }
export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
  try {
    const body = req.body || {};
    const r = db();

    if (body.action === "create") {
      const c = body.client || {};
      const name = str(c.name, 80);
      if (!name) return send(res, 400, { error: "Add a client name." });
      const existing = await readAll(CLIENTS);
      const order = existing.reduce((m, x) => Math.max(m, x.order || 0), 0) + 1;
      const logo = typeof c.logo === "string" && (/^https:\/\//.test(c.logo) || /^\/logos\//.test(c.logo)) ? c.logo.slice(0, 500) : null;
      const client = { id: newId(), name, platform: str(c.platform, 40) || "Other", logo, order, createdAt: Date.now() };
      await r.hset(CLIENTS, { [client.id]: JSON.stringify(client) });
      return send(res, 200, { client });
    }

    if (body.action === "delete") {
      await r.hdel(CLIENTS, String(body.id || ""));
      return send(res, 200, { ok: true });
    }

    send(res, 400, { error: "Unknown action." });
  } catch (e) {
    fail(res, e);
  }
}
