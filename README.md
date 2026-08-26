# Clinical Research Resume Builder

A small web app: visitors upload a CV (PDF/DOCX/TXT) and paste a job description, and get
back a resume tailored for clinical research / pharmacovigilance / clinical SAS roles —
built only from facts in their real CV. Requirements the JD asks for that aren't clearly
supported are flagged, not papered over.

Stack: Next.js (App Router) + the Anthropic API, called server-side so your API key is
never exposed to visitors' browsers.

## 1. Get an Anthropic API key

1. Go to https://console.anthropic.com and sign up / log in.
2. Add billing (Settings → Billing) — the API is pay-as-you-go, separate from a
   claude.ai subscription. Each resume generation is a small, cheap call (a few cents
   at most with Sonnet); set a monthly budget/usage limit in the console so a burst of
   traffic can't run away on you.
3. Settings → API Keys → Create Key. Copy it (starts with `sk-ant-...`) — you won't be
   able to see it again.

## 2. Run it locally (optional, to try before deploying)

```bash
npm install
cp .env.example .env.local
# edit .env.local and paste your real key in place of the placeholder
npm run dev
```

Open http://localhost:3000.

## 3. Deploy it for real (Vercel — free tier is enough to start)

1. Push this folder to a new GitHub repository (Vercel deploys from Git).
2. Go to https://vercel.com, sign up with GitHub, click **Add New → Project**, and
   import that repo. It auto-detects Next.js — no config needed.
3. Before the first deploy, open **Environment Variables** and add:
   - `ANTHROPIC_API_KEY` = your real key from step 1.
4. Click **Deploy**. You'll get a free `your-project.vercel.app` URL immediately.
5. Optional: Project Settings → Domains → add your own domain if you buy one
   (Namecheap, GoDaddy, etc. — point its DNS at Vercel per their instructions).

Any time you push to the repo's main branch, Vercel redeploys automatically.

## What's already handled

- CV parsing (PDF/DOCX/TXT) and resume tailoring both happen in server API routes
  (`app/api/parse-cv`, `app/api/tailor`) — your API key stays server-side only.
- Nothing is written to a database or disk — files are read into memory, sent to
  Claude, and discarded when the request finishes.
- A basic per-IP rate limit (8 requests/minute) is built in to blunt casual abuse.

## Going further (worth doing before heavy traffic)

- **Rate limiting is best-effort.** The in-memory limiter in `lib/rateLimit.js` only
  protects a single serverless instance — Vercel runs many in parallel, so a
  determined user could still exceed it. For a durable global limit, add a small
  Redis-backed limiter (e.g. Upstash Redis + `@upstash/ratelimit`, both free at small
  scale) and swap it into the two API routes.
- **Cost control:** set a hard monthly spend cap in the Anthropic console
  (Settings → Billing → Limits) so a traffic spike or abuse can't run up a large bill.
- **Abuse/spam:** if it gets hammered, add a lightweight CAPTCHA (e.g. Cloudflare
  Turnstile, free) in front of the generate/upload buttons.
- **Analytics:** Vercel's dashboard shows request counts/errors out of the box if you
  just want to see usage without adding anything.

## Project structure

```
app/
  page.js                 – renders the tool
  layout.js                – fonts + page metadata
  api/parse-cv/route.js    – reads uploaded CV, extracts structured profile via Claude
  api/tailor/route.js      – takes JD + profile, returns a tailored resume via Claude
components/
  ResumeBuilder.jsx        – all the UI
lib/
  prompts.js               – the two system prompts (domain-specialized, fact-only)
  rateLimit.js             – basic per-IP request limiter
```
