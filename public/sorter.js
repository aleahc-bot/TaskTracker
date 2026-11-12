/* Free, rule-based SOP sorter.
   Turns the text of a PDF into tasks and gives each one a priority using:
   1. Priority headings in the PDF ("High Priority", "CRITICAL:", "Low priority tasks")
   2. Labels on a line ("[High]", "(Urgent)", "Priority: Low")
   3. Due dates (due within 2 days → Critical, within 7 days → High)
   4. Keywords ("broken", "security", "sitemap", "nice to have", …)
   Anything with no signal becomes Medium. */
(function (root) {
  const LEVELS = ["critical", "high", "medium", "low"];
  const WORD = {
    critical: "critical", urgent: "critical", asap: "critical", emergency: "critical", p1: "critical", "top priority": "critical",
    high: "high", important: "high", p2: "high",
    medium: "medium", normal: "medium", moderate: "medium", standard: "medium", routine: "medium", p3: "medium",
    low: "low", minor: "low", optional: "low", p4: "low", "nice to have": "low", "nice-to-have": "low",
  };
  const LABEL_WORDS = Object.keys(WORD).sort((a, b) => b.length - a.length).map((w) => w.replace(/[-]/g, "\\-")).join("|");

  // Whole line is a priority heading, e.g. "High Priority", "CRITICAL PRIORITY TASKS:", "Priority 1 – Urgent", "Low:"
  const HEADING = new RegExp(`^(?:priority\\s*(?:level)?\\s*[:\\-–]?\\s*)?(${LABEL_WORDS})(?:\\s+priority)?(?:\\s+(?:tasks?|items?|issues?|fixes))?\\s*[:\\-–]?\\s*$`, "i");
  // Label inside a line, e.g. "[High]", "(urgent)", "Priority: Low", "— critical"
  const INLINE = [
    new RegExp(`[\\[(]\\s*(${LABEL_WORDS})(?:\\s+priority)?\\s*[\\])]`, "i"),
    new RegExp(`\\bpriority\\s*[:=\\-–]\\s*(${LABEL_WORDS})\\b`, "i"),
    new RegExp(`\\b(${LABEL_WORDS})\\s+priority\\b`, "i"),
  ];

  const KEYWORDS = {
    critical: [
      "urgent", "asap", "immediately", "right away", "emergency", "critical", "broken", "not working", "isn't working", "doesn't work",
      "site down", "website down", "is down", "outage", "error", "404", "500", "crash", "hacked", "malware", "security", "vulnerab",
      "ssl", "certificate expired", "expired", "expiring", "legal", "compliance", "ada ", "accessibility lawsuit", "privacy policy",
      "gdpr", "payment", "checkout", "form not", "contact form", "leads not", "blocker", "blocking", "launch blocker", "deindex", "penalty",
    ],
    high: [
      "launch", "go live", "go-live", "deadline", "this week", "ranking", "rankings", "search console", "gsc", "index", "indexing",
      "sitemap", "redirect", "301", "302", "migration", "site speed", "page speed", "core web vitals", "load time", "mobile",
      "google business", "gbp", "schema", "structured data", "canonical", "robots.txt", "noindex", "broken link", "duplicate",
      "analytics", "ga4", "tracking", "conversion", "client request", "client asked",
    ],
    low: [
      "nice to have", "nice-to-have", "optional", "if time", "when possible", "when you can", "later", "eventually", "future",
      "someday", "consider", "idea", "ideas", "maybe", "explore", "polish", "minor", "cosmetic", "tweak", "low priority", "backlog",
    ],
  };

  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (y, m, d) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : null);
  const fullYear = (y, today) => (y == null ? +today.slice(0, 4) : y < 100 ? 2000 + y : y);

  function findDates(line, today) {
    const found = [];
    const add = (index, value) => value && found.push({ index, value });
    let m;
    const r1 = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g;
    while ((m = r1.exec(line))) add(m.index, iso(+m[1], +m[2], +m[3]));
    const r2 = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g;
    while ((m = r2.exec(line))) add(m.index, iso(fullYear(m[3] ? +m[3] : null, today), +m[1], +m[2]));
    const r3 = /\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b/gi;
    while ((m = r3.exec(line))) add(m.index, iso(fullYear(m[3] ? +m[3] : null, today), MONTHS[m[1].toLowerCase()], +m[2]));
    return found.sort((a, b) => a.index - b.index);
  }

  function pickDates(line, today) {
    const dates = findDates(line, today);
    if (!dates.length) return { start: null, end: null };
    let start = null, end = null;
    for (const d of dates) {
      const before = line.slice(Math.max(0, d.index - 14), d.index).toLowerCase();
      if (/(start|begin|from|kick ?off)\W*$/.test(before)) start = start || d.value;
      else end = end || d.value;
    }
    if (dates.length >= 2 && !start) { start = dates[0].value; end = dates[dates.length - 1].value; }
    if (start && end && end < start) [start, end] = [end, start];
    return { start, end };
  }

  const daysUntil = (date, today) => Math.round((Date.parse(date) - Date.parse(today)) / 864e5);
  const hasWord = (text, k) => (/^[a-z0-9]+$/i.test(k) ? new RegExp(`\\b${k}\\b`, "i").test(text) : text.includes(k));

  function keywordPriority(text) {
    const t = " " + text.toLowerCase() + " ";
    for (const level of ["low", "critical", "high"]) {
      if (KEYWORDS[level].some((k) => hasWord(t, k))) return level;
    }
    return null;
  }

  const BULLET = /^\s*(?:[•●○◦▪▫■□☐☑✓✔\-–—*>]|\d{1,3}[.)]|[a-z][.)]|\[\s?[x ]?\s?\])\s+/i;

  function cleanTitle(s) {
    let t = s.replace(BULLET, "");
    INLINE.forEach((re) => { t = t.replace(re, " "); });
    t = t
      .replace(/\b(?:start(?:s|ing)?|begin|from|due|deadline|by|end(?:s)?|until)\s*(?:date)?\s*[:\-–]?\s*(?=\d|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/gi, " ")
      .replace(/\b\d{4}-\d{1,2}-\d{1,2}\b/g, " ")
      .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, " ")
      .replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?\b/gi, " ")
      .replace(/\(\s*\)|\[\s*\]/g, " ")
      .replace(/\s{2,}/g, " ")
      .replace(/^[\s:;,\-–—|]+|[\s:;,\-–—|]+$/g, "")
      .trim();
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function looksLikeHeading(line) {
    const t = line.trim();
    if (/:\s*$/.test(t) && t.length < 70) return true;
    if (t.length < 60 && /\b(sop|checklist|tasks|procedures?|overview|notes|guide)\s*:?$/i.test(t)) return true;
    const letters = t.replace(/[^a-z]/gi, "");
    return letters.length >= 4 && letters === letters.toUpperCase() && t.length < 60;
  }

  function sortSop(text, today) {
    today = today || new Date().toISOString().slice(0, 10);
    const raw = String(text || "").split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim());

    // Join wrapped lines: a lowercase continuation belongs to the line above.
    const lines = [];
    for (const l of raw) {
      if (!l) { lines.push(""); continue; }
      const prev = lines[lines.length - 1];
      if (prev && /^[a-z(]/.test(l) && !BULLET.test(l) && !HEADING.test(l) && !/[.:!?]$/.test(prev)) lines[lines.length - 1] = prev + " " + l;
      else lines.push(l);
    }

    const bulletCount = lines.filter((l) => BULLET.test(l)).length;
    const onlyBullets = bulletCount >= 3;
    let section = null;
    const tasks = [];
    const seen = new Set();

    for (const line of lines) {
      if (!line) continue;
      const head = line.replace(BULLET, "").match(HEADING);
      if (head) { section = WORD[head[1].toLowerCase()] || null; continue; }
      if (onlyBullets && !BULLET.test(line)) {
        if (looksLikeHeading(line)) section = keywordHeading(line) ?? section;
        continue;
      }
      if (!onlyBullets && looksLikeHeading(line)) { section = keywordHeading(line) ?? section; continue; }

      const title = cleanTitle(line);
      if (title.length < 6 || title.length > 220 || !/[a-z]/i.test(title)) continue;
      const key = title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      let label = null;
      for (const re of INLINE) { const m = line.match(re); if (m) { label = WORD[m[1].toLowerCase()]; break; } }
      const { start, end } = pickDates(line, today);

      let priority, why;
      if (label) { priority = label; why = "labeled in the PDF"; }
      else if (section) { priority = section; why = "under a priority heading"; }
      else {
        const kw = keywordPriority(line);
        priority = kw || "medium"; why = kw ? "matched keywords" : "no priority signal";
      }
      if (!label && end) {
        const d = daysUntil(end, today);
        if (d <= 2 && priority !== "critical") { priority = "critical"; why = d < 0 ? "past due" : "due within 2 days"; }
        else if (d <= 7 && (priority === "medium" || priority === "low")) { priority = "high"; why = "due within a week"; }
      }
      tasks.push({ title: title.slice(0, 200), priority, start, end, note: "", why });
      if (tasks.length >= 80) break;
    }
    return tasks;
  }

  // A non-bullet heading line like "URGENT FIXES" or "Phase 3 – optional extras:" can set the section.
  function keywordHeading(line) {
    const m = line.match(new RegExp(`\\b(${LABEL_WORDS})\\b`, "i"));
    return m ? WORD[m[1].toLowerCase()] : null;
  }

  root.sortSop = sortSop;
  root.SOP_LEVELS = LEVELS;
})(typeof window !== "undefined" ? window : globalThis);
