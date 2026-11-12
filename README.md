# Site Task Tracker

Prospecthelp's tracker for Jap (SEO Analyst) and Aleah (Web Specialist): team filters, client cards with logos, and an SOP checklist grouped by Critical, High, Medium and Low priority. Drop an SOP PDF and its tasks are sorted into the checklist.

## What's inside

| Path | What it is |
| --- | --- |
| `public/index.html`, `public/app.js` | The page itself |
| `public/logos/` | The 9 starting client logos |
| `api/data.js` | Loads clients and tasks (adds the 9 starting clients the first time) |
| `api/tasks.js`, `api/clients.js` | Add, edit, check off and delete |
| `api/upload.js` | Saves SOP PDFs and new logos to Vercel Blob (max 4.4 MB per file) |
| `public/sorter.js` | Free priority sorting from headings, labels, dates and keywords |
| `api/sort.js` | Sends PDF text to Claude to sort by priority (only if an API key is set) |

## Put it live

### 1. Push to GitHub (GitHub Desktop)
1. Open GitHub Desktop → **File → Add local repository** → choose `Documents\site-task-tracker`.
2. When it says this isn't a repository yet, click **create a repository**, then **Create repository**.
3. Click **Publish repository**. You can leave **Keep this code private** ticked.

### 2. Import into Vercel
1. Go to vercel.com → **Add New… → Project** → pick `site-task-tracker` → **Import**.
2. Framework Preset: **Other**. Leave the build settings empty. Click **Deploy**.
   The page loads but shows "Database not connected" until step 3.

### 3. Connect storage (Vercel → your project → Storage)
1. **Create Database → Upstash for Redis** (from the Marketplace) → free plan → connect it to this project.
2. **Create → Blob** → choose **Public** access → connect it to this project.
3. Go to **Deployments**, open the latest one's **⋯** menu → **Redeploy**.

The 9 clients appear the first time the site loads.

### 4. Optional: turn on AI auto-sorting
1. At console.anthropic.com, add billing credit and create an API key.
2. In Vercel → **Settings → Environment Variables**, add `ANTHROPIC_API_KEY` with that key.
3. Redeploy. The drop zone text changes to say Claude sorts the tasks.

Without a key, the site sorts tasks for free using `public/sorter.js`:
1. **Priority headings** in the PDF, like "Critical Priority" or "LOW PRIORITY:", set the priority for the tasks under them.
2. **Labels** on a line, like `[High]`, `(Urgent)` or `Priority: Low`.
3. **Due dates**: due within 2 days becomes Critical, within 7 days becomes at least High.
4. **Keywords**, like "broken", "security" or "SSL" for Critical; "sitemap", "redirect" or "page speed" for High; "nice to have" or "later" for Low.
5. Anything else becomes Medium.

For the most accurate results, write SOPs with priority headings. You can still change any priority in the review step.
Optional: `ANTHROPIC_MODEL` picks a different Claude model (default `claude-sonnet-5-5`).

## Good to know
- **No login:** anyone with the link can view and edit, so share the URL only with your team.
- **Updates between you and Jap:** the page checks for each other's changes every 15 seconds and whenever you switch back to the tab.
- **Scanned PDFs:** PDFs made from photos or scans have no readable text. Export SOPs from Google Docs or Word instead.
- **Making changes:** after editing files, commit and push in GitHub Desktop. Vercel redeploys automatically.
