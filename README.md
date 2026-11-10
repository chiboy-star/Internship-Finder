# Internship Finder — Summer 2027

A private, single-user software engineering internship matcher and outreach platform designed for **Chinemerem Madueke** (3rd-year B.Sc. Software Engineering student at Pan Atlantic University, Lagos). Built strictly on free-tier infrastructure (Next.js, Vercel Hobby, GitHub Actions, and Gemini free tier).

---

## Strict Internship Criteria

1. **Type**: Real internships only (placement, industrial attachment, SIWES, co-op, student trainee). Full-time roles, new grad positions, junior jobs, and bare company career pages are strictly rejected.
2. **Location**: Either (a) fully remote AND explicitly open to candidates residing in Nigeria/Africa/Worldwide, OR (b) onsite/hybrid in Lagos, Nigeria. Region-locked roles (US/UK/EU authorization required, relocation required, specific time-zone restrictions) are rejected.
3. **Timing**: Summer 2027 (~June to September 2027), 8 to 18 weeks duration. Roles for 2026, fall, winter, or spring are rejected.
4. **Scope**: All software engineering tracks at beginner to intermediate level (frontend, backend, mobile, full-stack, QA, DevOps, data/ML, systems, security).

---

## Keys and Setup Instructions

### 1. Local Setup (`.env.local`)
Create a file named `.env.local` in the project root:
```env
# Required for Gemini evaluation and pitch drafting
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash
GEMINI_DAILY_CAP=100

# Required for API route quota protection
APP_PASSPHRASE=your_secret_passphrase_here

# Optional: Powers the "Refresh now" button via GitHub workflow dispatch
GITHUB_DISPATCH_TOKEN=ghp_your_personal_access_token
GITHUB_REPO=chiboy-star/Internship-Finder
```

> **Note**: `.env.local` is listed in `.gitignore` and is never committed.

### 2. Google AI Studio (Gemini API Key)
1. Go to [Google AI Studio](https://aistudio.google.com/apikey).
2. Sign in with your Google account.
3. Click **Create API key** and copy your key into `GEMINI_API_KEY`.
4. Check current free tier model names (e.g. `gemini-1.5-flash`).

### 3. GitHub Actions Setup
1. Open your repository on GitHub: `https://github.com/chiboy-star/Internship-Finder`.
2. Go to **Settings** > **Secrets and variables** > **Actions**.
3. Under **Repository secrets**, click **New repository secret**:
   - Name: `GEMINI_API_KEY`
   - Value: paste your Gemini API key.
4. Click on the **Variables** tab:
   - Variable 1: `GEMINI_MODEL` (e.g. `gemini-1.5-flash`)
   - Variable 2: `GEMINI_DAILY_CAP` (e.g. `100`)
5. Go to **Settings** > **Actions** > **General** > **Workflow permissions**:
   - Select **Read and write permissions** (required so the daily GitHub Actions runner can commit updated `data/` files).
   - Click **Save**.

### 4. Vercel Deployment Setup
1. In your Vercel Project Dashboard, navigate to **Settings** > **Environment Variables**.
2. Add:
   - `GEMINI_API_KEY`: your Gemini API key
   - `GEMINI_MODEL`: `gemini-1.5-flash`
   - `APP_PASSPHRASE`: your secret phrase
   - *(Optional for live refresh button)*: `GITHUB_DISPATCH_TOKEN` and `GITHUB_REPO`
3. Trigger a redeployment so the variables take effect.

---

## Development & Automation Scripts

```bash
# 1. Install dependencies
npm install

# 2. Run local dev server
npm run dev

# 3. Run data pipeline manually
npm run pipeline

# 4. Run pipeline in background every 6 hours (only works while computer is on)
npm run pipeline:watch

# 5. Run dev server and background watcher concurrently
npm run dev:all

# 6. Test source endpoints diagnostic
npm run test:sources

# 7. Production build
npm run build
```

---

## Multi-Stage Filtering & Scoring Engine

1. **Stage A (Hard Keyword Rules, No Gemini)**:
   - Keeps only listings matching `intern`, `internship`, `placement`, `siwes`, `industrial attachment`, `co-op`, `student trainee`.
   - Rejects titles containing `new grad`, `full-time`, `junior`, `associate`, `senior`, `staff`, `lead` unless "intern" is explicitly present.
   - Rejects non-summer 2027 seasons and generic careers landing pages.
2. **Stage B (Structured Gemini Evaluation)**:
   - Evaluates `is_internship`, `is_software_engineering`, `nigeria_eligibility`, `lagos_onsite`, `start_window`, `duration_weeks`, `paid`, `experience_value`, `attainability`, `confidence`, and extracts direct quote evidence.
3. **Stage C (Hard Gates in Code)**:
   - `is_internship` & `is_software_engineering` must be true.
   - `(remote && open_to_nigeria) || lagos_onsite` must be true.
   - `confidence >= 0.6`.
   - Every rejection is logged with a specific reason code in `data/rejected.json`.
4. **Ranking Formula (`final_score`)**:
   - 35% Experience Value
   - 35% Attainability
   - 20% Paid status
   - 10% Timing fit
