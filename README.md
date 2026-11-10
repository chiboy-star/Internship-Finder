# Internship Finder — Summer 2027

A private, single-user software engineering internship matcher and outreach platform designed for **Chinemerem Madueke** (3rd-year B.Sc. Software Engineering student at Pan Atlantic University, Lagos). Built strictly on free-tier infrastructure (Next.js, Vercel Hobby, GitHub Actions, and Gemini free tier).

---

## Key Highlights

- **Targeted Opportunities**: Curates and ranks Summer 2027 software engineering internships, focusing on remote roles open to Nigeria and onsite/hybrid roles in Lagos.
- **Editorial Typography**: Editorial aesthetic inspired by luxury print magazines — Cormorant/Playfair serif display, quiet Inter UI sans, tabular numerals, 1px hairlines, and a single brass accent (`#B08A3E` light / `#C9A35B` dark) reserved exclusively for *Best Match* and *Closing Soon*.
- **Zero-Scrape Integrity**: Pulls from official public job-board APIs (Greenhouse, Lever, Ashby), GitHub community lists, remote job APIs (Remotive, Arbeitnow), Hacker News *Who is hiring*, and a verified Lagos tech seed list. LinkedIn, Indeed, and Glassdoor are strictly untouched.
- **AI Match & Zero-Fluff Outreach Drafter**: Evaluates listings against user's specific stack (Next.js, React, TypeScript, Tailwind CSS, Supabase) and featured projects (*Finance Manager PWA*, *Aurelia Grand Resort*, *Portfolio*). Cold pitches stay under 120 words with verified company context, 1 project link with UTM campaign tracking, 1 clear ask, and zero flattery filler.
- **Private & Safe**: API routes protected by a passphrase gate (`APP_PASSPHRASE`). Personal state (saved listings, Kanban application tracker, notes) stays safely stored inside client-side IndexedDB with full JSON export and import.

---

## Environment Variables

Configure the following variables in your local `.env.local`, GitHub Actions Secrets, and Vercel Project Settings:

| Variable | Scope | Description | Default / Example |
| :--- | :--- | :--- | :--- |
| `APP_PASSPHRASE` | Server (Vercel & local) | Secret passphrase that gates the `/api/pitch` and company creation routes so external visitors cannot consume your free Gemini quota. | `your_secret_passphrase` |
| `GEMINI_API_KEY` | Server (GitHub Actions & Vercel) | Google Gemini API key from Google AI Studio (Free Tier). Kept strictly server-side. | `AIzaSy...` |
| `GEMINI_MODEL` | Server | Model identifier for evaluation and pitch drafting. | `gemini-1.5-flash` |
| `GEMINI_DAILY_CAP` | Pipeline | Hard cap on daily API calls to avoid rate limits and keep within free tier quotas. | `50` |

---

## How to Add a Company

There are three ways to add a company to your watchlist:

1. **Via UI Form (Easiest)**:
   - Navigate to `/companies` or press `⌘K` -> *Add Custom Company*.
   - On mobile, tap the floating `+` button in the bottom-right corner.
   - Enter the **Company Name** and **Careers URL** and submit.

2. **Via Config File**:
   - For Lagos tech companies, add an object to `config/lagos.json`:
     ```json
     {
       "company": "Paystack",
       "careers_url": "https://paystack.com/careers",
       "city": "Lagos",
       "region": "Lagos, Nigeria",
       "takes_interns": true,
       "notes": "Leading payments infrastructure company in Lagos.",
       "contacts": []
     }
     ```
   - For ATS job boards (Greenhouse, Lever, Ashby), add company slugs into `config/companies.json`.

3. **Via API**:
   - Send a `POST` request to `/api/companies/add` with header `x-app-passphrase: <APP_PASSPHRASE>`.

---

## Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Run the local development server
npm run dev

# 3. Test data pipeline sync
npm run pipeline

# 4. Build for production
npm run build
```

---

## Architecture & Daily Pipeline

- **GitHub Actions (`.github/workflows/pipeline.yml`)**: Runs daily at 06:00 UTC. Fetches active postings, filters for Summer 2027 early-career roles, deduplicates by hash, scores newly discovered roles, closes stale listings (>14 days), and commits updated `data/listings.json`, `data/companies.json`, and `data/meta.json`.
- **Next.js App Router on Vercel**: Statically serves and revalidates feed data without requiring a persistent paid database.
- **IndexedDB**: Retains all user state (Kanban status, custom notes, dismissed listings, and goals) locally with instant offline performance.

