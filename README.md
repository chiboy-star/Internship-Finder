# Internship Finder — Summer 2027

A private, single-user software engineering internship matcher and outreach platform designed for **Chinemerem Madueke** (3rd-year B.Sc. Software Engineering student at Pan-Atlantic University, Lagos, Nigeria). Built strictly on free-tier infrastructure: Next.js, Vercel, GitHub Actions, and Gemini free tier.

---

## 🎯 Target Criteria & Eligibility Gates

1. **Role Scope**: Software engineering tracks at beginner to intermediate level (Frontend, Backend, Fullstack, Mobile, DevOps/Cloud, Security, AI/ML Engineering, Data Engineering).
2. **Timing**: Summer 2027 (~June to September 2027) or 6-month Industrial Attachment / SIWES.
3. **Geographic Eligibility**:
   - **Lagos, Nigeria**: Onsite or hybrid roles within Lagos.
   - **Global Remote**: Remote roles that explicitly state openness to candidates residing in Nigeria, Africa, or Worldwide / "Any Timezone".
   - **Region-Locked Rejection**: Roles requiring US/UK/EU work authorization, citizenship, or relocation are rejected with explicit reason logging.
   - **Check Eligibility**: Remote roles with unstated geographic boundaries are isolated into a dedicated review funnel (`data/check_eligibility.json`).

---

## ⚡ Architecture & Reconciled Funnel

Every raw listing fetched by the pipeline is balanced across an airtight accounting equation:
$$\text{Raw Listings} = \text{Duplicates} + \text{Stage A Rejects} + \text{Stage C Rejects} + \text{Check Eligibility} + \text{Verified}$$

```
Raw Listings (9,691)
├── Duplicates (1,463)
├── Stage A Rejects (8,114)   [Non-internship, wrong season, non-SWE, generic careers landing pages]
├── Stage C Rejects (113)     [REGION_LOCKED, US/EU only, low confidence]
├── Check Eligibility (0)     [Remote, unstated bounds]
└── Verified Matches (1)      [Explicit Nigeria/Africa quote evidence]
```

### Active Pipeline Sources
- **SimplifyJobs / Summer 2027 Internships** (dev branch machine-readable listings + markdown tables)
- **Hacker News "Who is hiring?"** (Monthly hiring threads filtered for internship & remote keywords)
- **RemoteOK API** (Real-time remote feed)
- **Jobicy Remote API** (Global remote developer feed)
- **Arbeitnow API** (Remote European/Global listings)
- **Remotive API** (Curated remote software roles)
- **Wellfound / AngelList Startup Feed**
- **Lagos Local Directory** (178 tech companies across Victoria Island, Lekki, Ikeja, Yaba)

---

## 🔔 Native Notifications (Zero Paid Services)

The pipeline uses the built-in `GITHUB_TOKEN` provided automatically by GitHub Actions to create and update a single tracking issue titled:
> **"New internship matches"**

Whenever new verified listings, check_eligibility roles, or careers-watcher alerts are detected:
1. The workflow calls GitHub REST API using `GITHUB_TOKEN`.
2. It searches for the open issue titled `"New internship matches"`.
3. If found, it posts a formatted sync comment with markdown tables, apply links, and verbatim quotes. If not found, it opens the issue.
4. Because the issue is assigned or created in your repository, **GitHub automatically dispatches email notifications to you**.
5. No paid email, SMS, Twilio, or Slack keys are required.

### Required Workflow Permissions (`.github/workflows/pipeline.yml`)
```yaml
permissions:
  contents: write    # To commit updated JSON feeds to origin main
  issues: write      # Required for GITHUB_TOKEN to search, open, and comment on issues
```

---

## 👁️ Careers-Page Watcher & Change Detection

For all monitored companies, `scripts/careers-watcher.ts` runs automated, polite DOM inspections:
- **Polite Constraints**: Exactly 1 request per page per run, descriptive User-Agent (`InternshipFinder/2.0 (Polite Careers Page Watcher; contact: chinemerem.madueke@pau.edu.ng)`), respects robots.txt.
- **Snapshot Storage**: Stores SHA-256 hashes of text and extracted job links in `data/watcher_snapshots.json`.
- **Diffing Engine**: Compares current runs with previous snapshots. If new text or links match `intern`, `internship`, `SIWES`, `industrial attachment`, `student`, or `trainee`, it creates an alert record in `data/alerts.json`.
- **Anti-Bot Polite Bypass**: Pages returning `HTTP 403` (e.g. Paystack, Moniepoint, Carbon via Cloudflare) are marked `"manual check"` and skipped rather than hammered.
- **Current Tracking**: **89 Actively Watched** (HTTP 200), **9 Manual Check Required** (HTTP 403), **7 Keyword Alerts Detected**.

---

## 💼 Companies Directory & Outreach Tracker

The Companies tab (`/companies`) features a full personal outreach CRM:
- **Verified First**: Companies with verified reachable careers pages (`HTTP 200`) sort to the top with emerald indicators.
- **Contact Source Citation**: Displays verified contact information alongside the verbatim URL where that contact was found.
- **Outreach Statuses**: `To contact` (default), `Contacted`, `Replied`, `Closed` with custom follow-up dates. Persisted in `localStorage`.
- **Pitch Drafter Safeguard**: Tailored pitch generator (`components/PitchModal.tsx`) strictly **refuses to run** for unverified companies or companies without a verified contact page, offering a direct LinkedIn recruiter search link instead to protect sender reputation.

---

## 📅 Opening Soon Program Tracker

High-conviction student programs audited with exact supporting sentences:
- **Google Summer of Code (GSoC)**: Opens February (`https://summerofcode.withgoogle.com/`)
- **Outreachy**: Opens January (`https://www.outreachy.org/`)
- **MLH Fellowship**: Opens February (`https://fellowship.mlh.io/`)
- **Linux Foundation LFX Mentorship**: Opens April (`https://lfx.linuxfoundation.org/tools/mentorship/`)
- *Programs without published official dates are explicitly flagged as `"verify (rolling)"` with zero invented dates.*

---

## 🚀 Setup & Local Execution

### 1. Environment Configuration (`.env.local`)
Create `.env.local` in project root:
```env
# Gemini evaluation & pitch drafting (Free Tier)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash
GEMINI_DAILY_CAP=100

# Quota protection passphrase
APP_PASSPHRASE=your_secret_passphrase

# Optional: Remote workflow dispatch
GITHUB_DISPATCH_TOKEN=ghp_your_pat_here
GITHUB_REPO=chiboy-star/Internship-Finder
```

### 2. CLI Commands
```bash
# Install dependencies
npm install

# Start local Next.js development server
npm run dev

# Run full ingestion and scoring pipeline
npm run pipeline

# Run careers-page watcher
npx tsx scripts/careers-watcher.ts

# Test GitHub issue notification locally (dry run)
npx tsx scripts/notify-github-issue.ts

# Run production build
npm run build
```

---

## ⏰ Daily Automation Schedule

The pipeline runs automatically via GitHub Actions every morning at **06:00 UTC**:
1. Checks out repository.
2. Runs ingestion pipeline across all 8 sources.
3. Executes careers-page watcher and updates DOM diff snapshots.
4. Generates/updates the GitHub Issue titled `"New internship matches"` to trigger email notification.
5. Commits and pushes data feeds (`data/listings.json`, `data/companies.json`, `data/alerts.json`, etc.) back to `main`.
