import { send, fail, str, date, pri } from "./_lib.js";

// POST /api/sort { text, fileName, clientName, today } → { tasks: [...] }
// Uses the Anthropic API when ANTHROPIC_API_KEY is set in Vercel. The key never reaches the browser.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return send(res, 501, { error: "Auto-sorting is off. Add ANTHROPIC_API_KEY in Vercel to turn it on." });
  try {
    const b = req.body || {};
    const text = str(b.text, 80000);
    if (text.length < 20) return send(res, 400, { error: "No readable text in that PDF." });
    const today = date(b.today) || new Date().toISOString().slice(0, 10);

    const prompt = `You turn an SOP document into a prioritized checklist for a small web design and SEO agency team (Jap is the SEO Analyst, Aleah is the Web Specialist).
Client: ${str(b.clientName, 80) || "not specified"}. Today's date: ${today}.

Read the document below and extract every concrete, actionable task. Merge duplicates and skip headings, intros and boilerplate. Write each title as a short imperative under 90 characters (for example "Submit XML sitemap to Google Search Console").

Give each task one priority:
- "critical": site down or broken, security, legal or compliance, blocks the client or a launch, due within 2 days, or marked urgent/critical in the document.
- "high": strongly affects rankings, traffic, leads or a launch, or due within about a week.
- "medium": routine optimization, content and maintenance work.
- "low": nice to have, ongoing, or no time pressure.
If the document states a priority or order for a task, follow it.

Dates: if the document gives a start date or a due/end date for a task, give it as YYYY-MM-DD, otherwise null. Resolve relative dates against today's date.
note: one short detail worth keeping (under 120 characters), or "".

Reply with only JSON in this shape, no other text:
{"tasks":[{"title":"...","priority":"critical","start":null,"end":"2026-11-20","note":""}]}

DOCUMENT (${str(b.fileName, 160)}):
"""
${text}
"""`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 8000, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = data?.error?.message || `Anthropic API error ${r.status}`;
      console.error("anthropic", r.status, msg);
      const friendly =
        r.status === 401 ? "The Anthropic API key in Vercel isn't valid." :
        r.status === 429 ? "Claude is busy or the API credit limit was reached. Try again in a minute." :
        /credit|balance/i.test(msg) ? "The Anthropic account is out of credit." :
        "Claude couldn't sort this file right now.";
      return send(res, 502, { error: friendly });
    }

    const out = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
    const json = out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1);
    let parsed;
    try { parsed = JSON.parse(json); } catch { return send(res, 502, { error: "Claude's answer couldn't be read. Try again." }); }
    const tasks = (Array.isArray(parsed.tasks) ? parsed.tasks : [])
      .filter((t) => t && typeof t.title === "string" && t.title.trim())
      .slice(0, 80)
      .map((t) => ({ title: str(t.title, 200), priority: pri(String(t.priority || "").toLowerCase()), start: date(t.start), end: date(t.end), note: str(t.note, 300) }));
    send(res, 200, { tasks });
  } catch (e) {
    fail(res, e);
  }
}
