import { db, TASKS, parse, newId, cleanTask, ids, send, fail } from "./_lib.js";

// POST /api/tasks  { action: "create" | "createMany" | "update" | "updateMany" | "delete" | "deleteMany", ... }
export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
  try {
    const body = req.body || {};
    const r = db();

    if (body.action === "create" || body.action === "createMany") {
      const list = body.action === "create" ? [body.task] : body.tasks;
      if (!Array.isArray(list) || !list.length || list.length > 100) return send(res, 400, { error: "Send 1 to 100 tasks." });
      const now = Date.now();
      const fields = {};
      const created = [];
      list.forEach((t, i) => {
        const task = cleanTask(t || {}, { done: false, note: "", start: null, end: null, assignee: "", clientId: "", priority: "medium", board: "aleah" });
        if (!task.title) return;
        task.id = newId() + i;
        task.createdAt = now + i;
        fields[task.id] = JSON.stringify(task);
        created.push(task);
      });
      if (!created.length) return send(res, 400, { error: "Tasks need a title." });
      await r.hset(TASKS, fields);
      return send(res, 200, { tasks: created });
    }

    if (body.action === "update") {
      const id = String(body.id || "");
      const current = parse(await r.hget(TASKS, id));
      if (!current) return send(res, 404, { error: "That task no longer exists." });
      const next = cleanTask(body.patch || {}, current);
      if (!next.title) next.title = current.title;
      next.doneAt = next.done ? current.doneAt || Date.now() : null;
      await r.hset(TASKS, { [id]: JSON.stringify(next) });
      return send(res, 200, { task: next });
    }

    if (body.action === "updateMany") {
      const list = ids(body.ids);
      if (!list.length) return send(res, 400, { error: "Pick at least one task." });
      const patch = body.patch || {};
      const fields = {};
      const updated = [];
      for (const id of list) {
        const current = parse(await r.hget(TASKS, id));
        if (!current) continue;
        const next = cleanTask(patch, current);
        if (!next.title) next.title = current.title;
        next.doneAt = next.done ? current.doneAt || Date.now() : null;
        fields[id] = JSON.stringify(next);
        updated.push(next);
      }
      if (updated.length) await r.hset(TASKS, fields);
      return send(res, 200, { tasks: updated });
    }

    if (body.action === "deleteMany") {
      const list = ids(body.ids);
      if (!list.length) return send(res, 400, { error: "Pick at least one task." });
      await r.hdel(TASKS, ...list);
      return send(res, 200, { deleted: list.length });
    }

    if (body.action === "delete") {
      await r.hdel(TASKS, String(body.id || ""));
      return send(res, 200, { ok: true });
    }

    send(res, 400, { error: "Unknown action." });
  } catch (e) {
    fail(res, e);
  }
}
