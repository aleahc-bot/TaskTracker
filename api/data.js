import { seedOnce, readAll, TASKS, CLIENTS, send, fail } from "./_lib.js";

// GET /api/data → everything the page needs in one call.
export default async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Use GET." });
  try {
    await seedOnce();
    const [clients, tasks] = await Promise.all([readAll(CLIENTS), readAll(TASKS)]);
    send(res, 200, { clients, tasks, ai: !!process.env.ANTHROPIC_API_KEY });
  } catch (e) {
    fail(res, e);
  }
}
