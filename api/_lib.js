import { Redis } from "@upstash/redis";

// Works with either env var naming Vercel's Upstash integration creates
// (KV_REST_API_URL / KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL / _TOKEN).
let redis = null;
export function db() {
  if (redis) return redis;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    const err = new Error("Database not connected. Add an Upstash Redis store in Vercel → Storage, then redeploy.");
    err.status = 503;
    throw err;
  }
  redis = new Redis({ url, token });
  return redis;
}

export const TASKS = "tracker:tasks";
export const CLIENTS = "tracker:clients";
export const SEEDED = "tracker:seeded";

export const PRIORITIES = ["critical", "high", "medium", "low"];
export const MEMBERS = ["jap", "aleah", ""];

const SEED_CLIENTS = [
  ["minnicks", "Minnicks Concrete", "Squarespace"],
  ["sackett", "Sackett Plumbing", "Squarespace"],
  ["allaround", "All Around Water Service", "Squarespace"],
  ["ajsyacht", "AJ's Yacht Service", "Claude"],
  ["trimviews", "Trimviews", "Claude"],
  ["dglandscaping", "DG Landscaping", "Claude"],
  ["aquamarine", "Aquamarine Construction Inc", "Claude"],
  ["elite", "Elite Electrical", "Claude"],
  ["f3", "F3 Land Services", "Squarespace"],
];

// Adds the starting client list once, the first time the site loads.
export async function seedOnce() {
  const r = db();
  const first = await r.set(SEEDED, "1", { nx: true });
  if (first !== "OK") return;
  const now = Date.now();
  const fields = {};
  SEED_CLIENTS.forEach(([id, name, platform], i) => {
    fields[id] = JSON.stringify({ id, name, platform, logo: `/logos/${id}.png`, order: i + 1, createdAt: now });
  });
  await r.hset(CLIENTS, fields);
}

export function parse(v) {
  if (v == null) return null;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return v;
}

export async function readAll(key) {
  const h = (await db().hgetall(key)) || {};
  return Object.values(h).map(parse).filter(Boolean);
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export const date = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
export const pri = (v) => (PRIORITIES.includes(v) ? v : "medium");
export const who = (v) => (MEMBERS.includes(v) ? v : "");

export function cleanTask(t, base = {}) {
  const out = { ...base };
  if ("title" in t) out.title = str(t.title, 200);
  if ("priority" in t) out.priority = pri(t.priority);
  if ("assignee" in t) out.assignee = who(t.assignee);
  if ("clientId" in t) out.clientId = str(t.clientId, 60);
  if ("start" in t) out.start = date(t.start);
  if ("end" in t) out.end = date(t.end);
  if ("note" in t) out.note = str(t.note, 300);
  if ("done" in t) out.done = !!t.done;
  if ("source" in t) out.source = typeof t.source === "string" && /^https:\/\//.test(t.source) ? t.source.slice(0, 500) : null;
  if ("sourceName" in t) out.sourceName = str(t.sourceName, 160);
  return out;
}

export function send(res, status, body) {
  res.status(status).setHeader("Cache-Control", "no-store");
  res.json(body);
}

export function fail(res, e) {
  console.error(e);
  send(res, e.status || 500, { error: e.status ? e.message : "Something went wrong on the server." });
}
