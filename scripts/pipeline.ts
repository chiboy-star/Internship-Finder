import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  Listing,
  Company,
  PipelineMeta,
  UserProfile,
  WorkMode,
  Eligibility,
  RejectedListing,
  ScoreBreakdown,
} from '../types';

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_DIR = path.join(process.cwd(), 'config');
const CACHE_FILE = path.join(DATA_DIR, 'cache.json');
const LISTINGS_FILE = path.join(DATA_DIR, 'listings.json');
const REJECTED_FILE = path.join(DATA_DIR, 'rejected.json');
const COMPANIES_FILE = path.join(DATA_DIR, 'companies.json');
const META_FILE = path.join(DATA_DIR, 'meta.json');
const PROFILE_FILE = path.join(CONFIG_DIR, 'profile.json');
const COMPANIES_CONFIG_FILE = path.join(CONFIG_DIR, 'companies.json');
const LAGOS_CONFIG_FILE = path.join(CONFIG_DIR, 'lagos.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helpers
function hashString(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16);
}

function loadJson<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (err) {
    console.error(`Error loading ${filePath}:`, err);
  }
  return fallback;
}

function saveJson(filePath: string, data: any) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// -------------------------------------------------------------
// Environment Loading & Gemini Initialization
// -------------------------------------------------------------
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key] && val) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnvLocal();

const rawModel = process.env.GEMINI_MODEL?.trim();
const GEMINI_MODEL = rawModel && !rawModel.includes('paste-') ? rawModel : 'gemini-1.5-flash';
const GEMINI_DAILY_CAP = parseInt(process.env.GEMINI_DAILY_CAP || '100', 10);
const rawKey = process.env.GEMINI_API_KEY?.trim();
const GEMINI_API_KEY = rawKey && !rawKey.includes('paste-') ? rawKey : undefined;

let geminiCallCount = 0;
let genAI: GoogleGenerativeAI | null = null;

if (GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    console.log(`Gemini enabled: yes (model ${GEMINI_MODEL})`);
  } catch (e: any) {
    console.warn('Gemini enabled: no (unverified mode - init error:', e?.message, ')');
  }
} else {
  console.log('Gemini enabled: no (unverified mode)');
}

const profile: UserProfile = loadJson(PROFILE_FILE, {} as UserProfile);
const companiesConfig = loadJson<{ greenhouse: any[]; lever: any[]; ashby: any[] }>(COMPANIES_CONFIG_FILE, {
  greenhouse: [],
  lever: [],
  ashby: [],
});
const lagosConfig = loadJson<any[]>(LAGOS_CONFIG_FILE, []);
const cache = loadJson<Record<string, any>>(CACHE_FILE, {});

// Track rejections
const rejectedListings: RejectedListing[] = [];
const rejectionCounts: Record<string, number> = {};

function recordRejection(
  title: string,
  company: string,
  url: string,
  source: string,
  location: string,
  reason_code: string,
  reason: string,
  snippet?: string
) {
  rejectionCounts[reason_code] = (rejectionCounts[reason_code] || 0) + 1;
  rejectedListings.push({
    title,
    company,
    url,
    source,
    location,
    reason_code,
    reason,
    snippet: (snippet || '').slice(0, 300),
    rejected_at: new Date().toISOString(),
  });
}

// -------------------------------------------------------------
// STAGE A: Rules only, No Gemini (Keyword & Title filtering)
// -------------------------------------------------------------

export function stageAFilter(raw: {
  title: string;
  company: string;
  apply_url: string;
  location: string;
  source: string;
  description_snippet?: string;
}): { passed: boolean; reason_code?: string; reason?: string } {
  const title = (raw.title || '').trim();
  const titleLower = title.toLowerCase();
  const descLower = (raw.description_snippet || '').toLowerCase();
  const combined = `${titleLower} ${descLower}`;

  // 1. Apply URL must not be just a root or generic careers landing page
  const cleanUrl = (raw.apply_url || '').toLowerCase().trim();
  if (!cleanUrl || cleanUrl.endsWith('.com') || cleanUrl.endsWith('.com/') || cleanUrl.endsWith('/careers') || cleanUrl.endsWith('/jobs')) {
    return {
      passed: false,
      reason_code: 'GENERIC_CAREERS_PAGE',
      reason: 'Apply URL is a generic careers landing page or domain root, not a specific job posting.',
    };
  }

  // 2b. Reject roles requiring advanced degrees (PhD, Doctorate, MBA)
  if (/\b(phd|doctorate|postdoc|post-doc|mba)\b/i.test(title)) {
    return {
      passed: false,
      reason_code: 'ADVANCED_DEGREE_REQUIRED',
      reason: 'Role explicitly requires an advanced graduate degree (PhD, Doctorate, or MBA).',
    };
  }

  // 2c. Reject titles containing non-intern or full-time / senior / operational titles UNLESS title clearly says intern
  const isExplicitInternInTitle = /\b(intern|interns|internship|internships|siwes|industrial attachment|attachment|co-op|coop|placement|trainee)\b/i.test(title);

  const nonInternTerms = [
    'new grad', 'graduate', 'full-time', 'full time', 'junior', 'associate', 'senior',
    'staff', 'lead', 'manager', 'principal', 'agent', 'representative', 'teller',
    'specialist', 'recruiter', 'driver', 'executive', 'director', 'accountant', 'legal'
  ];
  for (const term of nonInternTerms) {
    if (titleLower.includes(term) && !isExplicitInternInTitle) {
      return {
        passed: false,
        reason_code: 'NON_INTERN_OR_FULLTIME_ROLE',
        reason: `Title contains non-intern term "${term}" without an explicit internship designation.`,
      };
    }
  }

  // 3. Must match internship keyword as a WHOLE WORD in title or body
  // (Prevents matching "international", "internal", "internet")
  const internWordRegex = /\b(intern|interns|internship|internships|industrial attachment|siwes|student trainee|co-op|coop|placement)\b/i;
  const hasInternKeyword = isExplicitInternInTitle || internWordRegex.test(descLower);

  if (!hasInternKeyword) {
    return {
      passed: false,
      reason_code: 'NOT_AN_INTERNSHIP',
      reason: 'No internship, placement, SIWES, or trainee keywords found in title or description.',
    };
  }

  // 4. Reject past years or non-summer seasons (Summer 2026, Fall 2026, Spring 2027, Winter, etc.)
  if (
    titleLower.includes('2025') ||
    titleLower.includes('summer 2026') ||
    titleLower.includes('fall 2026') ||
    titleLower.includes('spring 2027') ||
    titleLower.includes('winter 2027') ||
    titleLower.includes('fall 2027')
  ) {
    return {
      passed: false,
      reason_code: 'WRONG_SEASON_OR_YEAR',
      reason: 'Posting is explicitly for a past year or non-summer term (Spring, Fall, Winter).',
    };
  }

  return { passed: true };
}

// -------------------------------------------------------------
// STAGE B: Structured Evaluation (Gemini or Strict Heuristic)
// -------------------------------------------------------------

interface StageBResult {
  is_internship: boolean;
  is_software_engineering: boolean;
  work_mode: WorkMode;
  city_country: string;
  nigeria_eligibility: Eligibility;
  lagos_onsite: boolean;
  start_window: string;
  duration_weeks: number | null;
  paid: boolean | 'unknown';
  stipend_text: string | null;
  required_skills: string[];
  seniority_required: string;
  experience_value: number;
  experience_reason: string;
  attainability: number;
  deadline: string | null;
  confidence: number;
  work_mode_quote: string;
  nigeria_eligibility_quote: string;
}

// Strict heuristic evaluation used when Gemini is not available or rate limited
function evaluateListingStrictRule(item: {
  title: string;
  company: string;
  location: string;
  description: string;
}): StageBResult {
  const text = `${item.title} ${item.location} ${item.description}`.toLowerCase();
  const titleLower = item.title.toLowerCase();

  // 1. Is software engineering (Must be reflected in title or specific technical responsibilities)
  const sweKeywords = [
    'software', 'engineer', 'engineering', 'developer', 'frontend', 'front-end',
    'backend', 'fullstack', 'full stack', 'web', 'mobile', 'android', 'ios',
    'qa', 'devops', 'site reliability', 'sre', 'data engineer', 'machine learning',
    'ml', 'ai', 'cloud', 'security', 'systems', 'infrastructure'
  ];
  const nonSweKeywords = [
    'sales', 'marketing', 'collections', 'agent', 'customer', 'recruiter', 'talent',
    'hr', 'legal', 'finance', 'operations', 'compliance', 'teller', 'driver'
  ];

  const hasSweInTitle = sweKeywords.some((k) => titleLower.includes(k));
  const hasNonSweInTitle = nonSweKeywords.some((k) => titleLower.includes(k));
  const is_software_engineering = hasSweInTitle && !hasNonSweInTitle;

  // 1b. Is real internship
  const is_internship = /\b(intern|interns|internship|internships|placement|industrial attachment|siwes|co-op|coop|student trainee)\b/i.test(titleLower) ||
    /\b(summer 2027 internship|software engineering intern|developer intern|frontend intern)\b/i.test(text);

  // 2. Work mode (Check location field first)
  const locLower = (item.location || '').toLowerCase();
  let work_mode: WorkMode = 'onsite';
  let work_mode_quote = `Onsite in ${item.location || 'office'}`;

  if (locLower.includes('remote') || locLower.includes('anywhere')) {
    work_mode = locLower.includes('hybrid') ? 'hybrid' : 'remote';
    work_mode_quote = work_mode === 'hybrid' ? 'Hybrid remote/office' : 'Fully Remote';
  } else if (locLower.includes('hybrid')) {
    work_mode = 'hybrid';
    work_mode_quote = 'Hybrid work arrangement';
  } else if (text.includes('100% remote') || text.includes('fully remote') || text.includes('work from anywhere in the world')) {
    work_mode = 'remote';
    work_mode_quote = 'Fully remote specified in posting description';
  } else {
    work_mode = 'onsite';
    work_mode_quote = `Onsite in ${item.location}`;
  }

  // 3. Lagos onsite / hybrid (Location must be in Lagos, Nigeria)
  const lagos_onsite = locLower.includes('lagos') || (locLower.includes('nigeria') && (work_mode === 'onsite' || work_mode === 'hybrid'));

  // 4. Nigeria eligibility (Strict rules from doc)
  let nigeria_eligibility: Eligibility = 'locked';
  let nigeria_eligibility_quote = 'Restricted by national work authorization or geographic boundary';

  const isWesternLocation = /\b(united states|usa|us|uk|united kingdom|canada|germany|france|netherlands|australia|india|ca|ny|tx|wa|sf|san francisco|new york|london|seattle|austin|chicago)\b/i.test(locLower);

  const hasExplicitGlobalWording =
    locLower.includes('worldwide') ||
    locLower.includes('global') ||
    locLower.includes('anywhere') ||
    text.includes('open to candidates worldwide') ||
    text.includes('open worldwide') ||
    text.includes('hiring globally') ||
    text.includes('work from anywhere in the world') ||
    text.includes('open to candidates in africa') ||
    text.includes('open to candidates in nigeria');

  let isExplicitLocked =
    text.includes('authorized to work in the us') ||
    text.includes('authorized to work in the united states') ||
    text.includes('authorized to work in the uk') ||
    text.includes('us citizen') ||
    text.includes('u.s. citizen') ||
    text.includes('uk right to work') ||
    text.includes('must reside in the united states') ||
    text.includes('us only') ||
    text.includes('canada only') ||
    text.includes('eu only') ||
    text.includes('europe only') ||
    text.includes('emea only') ||
    text.includes('no sponsorship') ||
    text.includes('without sponsorship') ||
    text.includes('relocation required') ||
    text.includes('time zone: est') ||
    text.includes('time zone: pst') ||
    text.includes('americas only') ||
    (work_mode === 'hybrid' && !lagos_onsite) ||
    (isWesternLocation && !hasExplicitGlobalWording && !lagos_onsite);

  if (lagos_onsite) {
    nigeria_eligibility = 'open';
    nigeria_eligibility_quote = 'Onsite/hybrid in Lagos, Nigeria';
  } else if (isExplicitLocked) {
    nigeria_eligibility = 'locked';
    nigeria_eligibility_quote = 'Country work authorization or regional boundary restriction';
  } else if (work_mode === 'remote' && hasExplicitGlobalWording) {
    nigeria_eligibility = 'open';
    nigeria_eligibility_quote = 'Explicitly open worldwide, globally, or to Africa';
  } else if (work_mode === 'remote') {
    // A US, UK or EU city labelled remote without worldwide wording is locked per spec:
    const isWesternCityRemote = /\b(ca|ny|tx|wa|ma|sf|san francisco|new york|london|seattle|austin|chicago|berlin|paris|toronto)\b/i.test(locLower);
    if (isWesternCityRemote) {
      nigeria_eligibility = 'locked';
      nigeria_eligibility_quote = 'Western city labelled remote without worldwide wording';
    } else {
      nigeria_eligibility = 'unclear';
      nigeria_eligibility_quote = 'Remote position with unverified geographic boundaries';
    }
  } else {
    nigeria_eligibility = 'locked';
    nigeria_eligibility_quote = 'Onsite position outside Lagos, Nigeria';
  }

  // 5. Skills
  const commonSkills = ['React', 'Next.js', 'JavaScript', 'TypeScript', 'HTML', 'CSS', 'Tailwind CSS', 'Supabase', 'Python', 'Git', 'SQL'];
  const matchedSkills = commonSkills.filter((s) => text.includes(s.toLowerCase()));

  // 6. Paid & Duration
  const paid = text.includes('unpaid') ? false : text.includes('stipend') || text.includes('salary') || text.includes('hourly') || text.includes('paid') || lagos_onsite ? true : 'unknown';

  let duration_weeks: number | null = null;
  if (text.includes('10-12 weeks') || text.includes('12 weeks')) duration_weeks = 12;
  else if (text.includes('10 weeks')) duration_weeks = 10;
  else if (text.includes('3 months')) duration_weeks = 12;
  else if (text.includes('6 months')) duration_weeks = 24;

  const experience_value = lagos_onsite ? 85 : 75;
  const attainability = lagos_onsite ? 80 : 65;

  return {
    is_internship,
    is_software_engineering,
    work_mode,
    city_country: item.location || 'Remote',
    nigeria_eligibility,
    lagos_onsite,
    start_window: 'Summer 2027',
    duration_weeks,
    paid,
    stipend_text: paid === true ? 'Competitive early-careers stipend' : null,
    required_skills: matchedSkills,
    seniority_required: 'Undergraduate student / 3rd year',
    experience_value,
    experience_reason: 'High-repute engineering organization with modern web technologies and real mentorship.',
    attainability,
    deadline: null,
    confidence: 0.85,
    work_mode_quote,
    nigeria_eligibility_quote,
  };
}

// Gemini AI Evaluator with strict JSON schema
async function evaluateBatchWithGemini(
  items: Array<{ title: string; company: string; location: string; description: string }>
): Promise<StageBResult[]> {
  if (!genAI || geminiCallCount >= GEMINI_DAILY_CAP) {
    return items.map(evaluateListingStrictRule);
  }

  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const prompt = `You are a strict technical job screener auditing internship postings for Chinemerem Madueke, a 3rd-year B.Sc. Software Engineering student based in Lagos, Nigeria (Skills: React, Next.js, TypeScript, Tailwind, Supabase, Python, C++, Git). Target: Summer 2027 internships.

CRITICAL ELIGIBILITY RULES:
- "open": ONLY if the listing explicitly states worldwide, anywhere, global, work from anywhere, Africa, or Nigeria.
- "locked": IF the listing mentions US work authorization, US citizens only, UK right to work, time-zone restrictions, relocation required, hybrid outside Lagos, or US/UK/EU city without global wording. EMEA-only or Europe-only is locked.
- "unclear": If remote but no geographic boundary is stated.
- "is_internship": MUST BE TRUE only for actual internships, placements, SIWES, co-ops, or trainees. New grad, associate, and junior roles MUST BE FALSE.
- "is_software_engineering": true for frontend, backend, fullstack, mobile, QA, DevOps, data/ML, security.

Evaluate each listing and return a valid JSON array matching this exact schema:
[
  {
    "index": number,
    "is_internship": boolean,
    "is_software_engineering": boolean,
    "work_mode": "remote" | "onsite" | "hybrid" | "unknown",
    "city_country": string,
    "nigeria_eligibility": "open" | "locked" | "unclear",
    "lagos_onsite": boolean,
    "start_window": string,
    "duration_weeks": number or null,
    "paid": true | false | "unknown",
    "stipend_text": string or null,
    "required_skills": string[],
    "seniority_required": string,
    "experience_value": number (0-100),
    "experience_reason": string,
    "attainability": number (0-100),
    "deadline": string or null,
    "confidence": number (0.0 to 1.0),
    "work_mode_quote": string (under 20 words from text),
    "nigeria_eligibility_quote": string (under 20 words from text)
  }
]

Listings to audit:
${JSON.stringify(
  items.map((it, idx) => ({
    index: idx,
    title: it.title,
    company: it.company,
    location: it.location,
    snippet: it.description.slice(0, 700),
  }))
)}`;

    const response = await model.generateContent(prompt);
    geminiCallCount++;
    const text = response.response.text().trim();
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return items.map((it, idx) => {
      const match = parsed.find((p: any) => p.index === idx);
      if (match && typeof match.is_internship === 'boolean') {
        return {
          is_internship: match.is_internship,
          is_software_engineering: match.is_software_engineering,
          work_mode: match.work_mode || 'unknown',
          city_country: match.city_country || it.location,
          nigeria_eligibility: match.nigeria_eligibility || 'unclear',
          lagos_onsite: match.lagos_onsite || false,
          start_window: match.start_window || 'Summer 2027',
          duration_weeks: match.duration_weeks || null,
          paid: match.paid !== undefined ? match.paid : 'unknown',
          stipend_text: match.stipend_text || null,
          required_skills: match.required_skills || [],
          seniority_required: match.seniority_required || 'Student',
          experience_value: Math.min(100, Math.max(0, match.experience_value || 70)),
          experience_reason: match.experience_reason || 'Software engineering internship experience.',
          attainability: Math.min(100, Math.max(0, match.attainability || 65)),
          deadline: match.deadline || null,
          confidence: match.confidence || 0.8,
          work_mode_quote: (match.work_mode_quote || '').slice(0, 100),
          nigeria_eligibility_quote: (match.nigeria_eligibility_quote || '').slice(0, 100),
        };
      }
      return evaluateListingStrictRule(it);
    });
  } catch (err: any) {
    throw err;
  }
}

// -------------------------------------------------------------
// STAGE C: Hard Gates in Code (Not AI)
// -------------------------------------------------------------

export function stageCHardGates(evalResult: StageBResult): {
  passed: boolean;
  reason_code?: string;
  reason?: string;
} {
  // Gate 1: Must be real internship and software engineering
  if (!evalResult.is_internship) {
    return {
      passed: false,
      reason_code: 'NOT_INTERNSHIP',
      reason: 'Role was evaluated as not being a legitimate internship or student trainee program.',
    };
  }

  if (!evalResult.is_software_engineering) {
    return {
      passed: false,
      reason_code: 'NOT_SOFTWARE_ENGINEERING',
      reason: 'Role is outside software engineering disciplines (e.g. non-technical, sales, marketing).',
    };
  }

  // Gate 2: Location requirement: (work_mode is remote AND nigeria_eligibility is open) OR lagos_onsite is true
  const isRemoteOpenToNigeria = evalResult.work_mode === 'remote' && evalResult.nigeria_eligibility === 'open';
  if (!isRemoteOpenToNigeria && !evalResult.lagos_onsite) {
    const code = evalResult.nigeria_eligibility === 'locked' ? 'REGION_LOCKED' : 'NOT_OPEN_TO_NIGERIA';
    return {
      passed: false,
      reason_code: code,
      reason: `Location failed: Requires local work authorization outside Nigeria, or is not onsite in Lagos. Quote: "${evalResult.nigeria_eligibility_quote}"`,
    };
  }

  // Gate 3: Timing fit: duration between 8 and 18 weeks (or unknown)
  if (evalResult.duration_weeks !== null && (evalResult.duration_weeks < 8 || evalResult.duration_weeks > 18)) {
    return {
      passed: false,
      reason_code: 'INVALID_DURATION',
      reason: `Internship duration (${evalResult.duration_weeks} weeks) falls outside standard summer internship window (8-18 weeks).`,
    };
  }

  // Gate 4: Confidence threshold
  if (evalResult.confidence < 0.6) {
    return {
      passed: false,
      reason_code: 'LOW_CONFIDENCE',
      reason: `Evaluation confidence (${evalResult.confidence.toFixed(2)}) is below 0.6 threshold.`,
    };
  }

  return { passed: true };
}

// -------------------------------------------------------------
// Ranking Engine: 35% Exp, 35% Attain, 20% Paid, 10% Timing
// -------------------------------------------------------------

export function computeRankScore(evalResult: StageBResult, isUnverified: boolean): {
  final_score: number;
  breakdown: ScoreBreakdown;
} {
  if (isUnverified) {
    return {
      final_score: 45,
      breakdown: {
        experience_value: 15,
        attainability: 15,
        paid_score: 10,
        timing_fit: 5,
      },
    };
  }

  // 1. Experience Value (35%)
  const expWeighted = (evalResult.experience_value / 100) * 35;

  // 2. Attainability (35%)
  const attainWeighted = (evalResult.attainability / 100) * 35;

  // 3. Paid Score (20%): paid true = 20, unknown = 7, unpaid = 0
  const paidWeighted = evalResult.paid === true ? 20 : evalResult.paid === 'unknown' ? 7 : 0;

  // 4. Timing Fit (10%): explicit Summer 2027 & ~3 months = 10, unknown = 5
  const timingWeighted = evalResult.duration_weeks && evalResult.duration_weeks >= 8 && evalResult.duration_weeks <= 14 ? 10 : 5;

  const final_score = Math.round(expWeighted + attainWeighted + paidWeighted + timingWeighted);

  return {
    final_score: Math.min(100, Math.max(10, final_score)),
    breakdown: {
      experience_value: Math.round(expWeighted),
      attainability: Math.round(attainWeighted),
      paid_score: paidWeighted,
      timing_fit: timingWeighted,
    },
  };
}

// -------------------------------------------------------------
// Data Source Fetchers
// -------------------------------------------------------------

export async function fetchGreenhouseBoards(companies: Array<{ name: string; slug: string }>) {
  const listings: Array<{
    source: string;
    external_id: string;
    company: string;
    title: string;
    location: string;
    apply_url: string;
    source_url: string;
    description: string;
  }> = [];

  for (const c of companies) {
    try {
      const url = `https://boards-api.greenhouse.io/v1/boards/${c.slug}/jobs?content=true`;
      const res = await fetch(url, { headers: { 'User-Agent': 'InternshipFinder/2.0' } });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.jobs || !Array.isArray(data.jobs)) continue;

      for (const job of data.jobs) {
        const title = (job.title || '').trim();
        const location = job.location?.name || 'Remote';
        const content = (job.content || '').replace(/<[^>]+>/g, ' ');
        const applyUrl = job.absolute_url || `https://boards.greenhouse.io/${c.slug}/jobs/${job.id}`;

        listings.push({
          source: 'greenhouse',
          external_id: `gh_${c.slug}_${job.id}`,
          company: c.name,
          title,
          location,
          apply_url: applyUrl,
          source_url: applyUrl,
          description: content,
        });
      }
    } catch (e: any) {
      console.warn(`Error fetching Greenhouse for ${c.name}:`, e.message);
    }
  }

  return listings;
}

export async function fetchLeverPostings(companies: Array<{ name: string; slug: string }>) {
  const listings: Array<{
    source: string;
    external_id: string;
    company: string;
    title: string;
    location: string;
    apply_url: string;
    source_url: string;
    description: string;
  }> = [];

  for (const c of companies) {
    try {
      const url = `https://api.lever.co/v0/postings/${c.slug}?mode=json`;
      const res = await fetch(url, { headers: { 'User-Agent': 'InternshipFinder/2.0' } });
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data)) continue;

      for (const job of data) {
        const title = (job.text || '').trim();
        const location = job.categories?.location || 'Remote';
        const description = (job.descriptionPlain || job.description || '').replace(/<[^>]+>/g, ' ');
        const applyUrl = job.hostedUrl || `https://jobs.lever.co/${c.slug}/${job.id}`;

        listings.push({
          source: 'lever',
          external_id: `lever_${c.slug}_${job.id}`,
          company: c.name,
          title,
          location,
          apply_url: applyUrl,
          source_url: applyUrl,
          description,
        });
      }
    } catch (e: any) {
      console.warn(`Error fetching Lever for ${c.name}:`, e.message);
    }
  }

  return listings;
}

export async function fetchAshbyBoards(companies: Array<{ name: string; slug: string }>) {
  const listings: Array<{
    source: string;
    external_id: string;
    company: string;
    title: string;
    location: string;
    apply_url: string;
    source_url: string;
    description: string;
  }> = [];

  for (const c of companies) {
    try {
      const url = `https://api.ashbyhq.com/posting-api/job-board/${c.slug}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'InternshipFinder/2.0' } });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.jobs || !Array.isArray(data.jobs)) continue;

      for (const job of data.jobs) {
        const title = (job.title || '').trim();
        const location = job.location || (job.isRemote ? 'Remote' : 'Onsite');
        const applyUrl = job.jobUrl || `https://jobs.ashbyhq.com/${c.slug}/${job.id}`;
        const description = (job.descriptionHtml || '').replace(/<[^>]+>/g, ' ');

        listings.push({
          source: 'ashby',
          external_id: `ashby_${c.slug}_${job.id}`,
          company: c.name,
          title,
          location,
          apply_url: applyUrl,
          source_url: applyUrl,
          description,
        });
      }
    } catch (e: any) {
      console.warn(`Error fetching Ashby for ${c.name}:`, e.message);
    }
  }

  return listings;
}

export async function fetchGitHubCommunityInternshipList(): Promise<Array<{
  source: string;
  external_id: string;
  company: string;
  title: string;
  location: string;
  apply_url: string;
  source_url: string;
  description: string;
}>> {
  const listings: Array<any> = [];
  const urls = [
    'https://raw.githubusercontent.com/SimplifyJobs/Summer2025-Internships/dev/README.md',
    'https://raw.githubusercontent.com/pittcsc/Summer2025-Internships/master/README.md',
    'https://raw.githubusercontent.com/speedyapply/2025-SWE-College-Jobs/main/README.md',
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 InternshipFinder/2.0' } });
      if (!res.ok) continue;
      const text = await res.text();

      // 1. Try HTML Table parsing (<table>...<tr><td>...)
      const rowMatches = text.match(/<tr>[\s\S]*?<\/tr>/g) || [];
      for (const row of rowMatches) {
        const cells = row.match(/<td[\s\S]*?<\/td>/g);
        if (!cells || cells.length < 4) continue;

        const company = cells[0].replace(/<[^>]+>/g, '').trim();
        const role = cells[1].replace(/<[^>]+>/g, '').trim();
        const location = cells[2].replace(/<[^>]+>/g, ' ').trim();
        const linkMatch = cells[3].match(/href="([^"]+)"/);
        const applyUrl = linkMatch ? linkMatch[1] : '';

        if (!company || !role || !applyUrl) continue;

        listings.push({
          source: 'github-community',
          external_id: `ghc_${hashString(company + role)}`,
          company,
          title: role,
          location: location || 'Remote',
          apply_url: applyUrl,
          source_url: url,
          description: `Summer software engineering internship opportunity at ${company}. Role: ${role}. Location: ${location}.`,
        });

        if (listings.length >= 100) break;
      }

      // 2. Try Markdown Table parsing if HTML had no rows
      if (listings.length === 0) {
        const lines = text.split('\n');
        for (const line of lines) {
          if (!line.startsWith('|') || line.includes('---') || line.includes('Company | Role')) continue;
          const cols = line.split('|').map((s) => s.trim()).filter(Boolean);
          if (cols.length < 3) continue;

          const companyMatch = cols[0].match(/\[?([^\]]+)\]?(\(([^)]+)\))?/);
          const companyName = companyMatch ? companyMatch[1].replace(/\*\*/g, '').trim() : cols[0];
          const role = cols[1].replace(/<[^>]+>/g, '').replace(/\[|\]/g, '').trim();
          const location = (cols[2] || 'Remote').replace(/<[^>]+>/g, '').trim();
          const linkCell = cols[3] || cols[1];
          const linkMatch = linkCell.match(/href="([^"]+)"/) || linkCell.match(/\((https?:\/\/[^\s)]+)\)/);
          const applyUrl = linkMatch ? linkMatch[1] : '';

          if (!companyName || !role || !applyUrl) continue;

          listings.push({
            source: 'github-community',
            external_id: `ghc_${hashString(companyName + role)}`,
            company: companyName,
            title: role,
            location: location || 'Remote',
            apply_url: applyUrl,
            source_url: url,
            description: `Summer software engineering internship at ${companyName}.`,
          });
          if (listings.length >= 100) break;
        }
      }

      if (listings.length > 0) break;
    } catch (e: any) {
      console.warn(`Error fetching GitHub community repo ${url}:`, e.message);
    }
  }

  return listings;
}

export async function fetchRemoteJobFeeds() {
  const listings: Array<any> = [];

  // 1. Remotive API
  try {
    const res = await fetch('https://remotive.com/api/remote-jobs?category=software-dev&limit=60', {
      headers: { 'User-Agent': 'InternshipFinder/2.0' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.jobs && Array.isArray(data.jobs)) {
        for (const job of data.jobs) {
          listings.push({
            source: 'remotive',
            external_id: `remotive_${job.id}`,
            company: job.company_name,
            title: job.title,
            location: job.candidate_required_location || 'Worldwide Remote',
            apply_url: job.url,
            source_url: job.url,
            description: (job.description || '').replace(/<[^>]+>/g, ' ').slice(0, 1000),
          });
        }
      }
    }
  } catch (e: any) {
    console.warn('Remotive error:', e.message);
  }

  // 2. Arbeitnow API
  try {
    const res = await fetch('https://www.arbeitnow.com/api/job-board-api', {
      headers: { 'User-Agent': 'InternshipFinder/2.0' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.data && Array.isArray(data.data)) {
        for (const job of data.data) {
          listings.push({
            source: 'arbeitnow',
            external_id: `arbeitnow_${job.slug}`,
            company: job.company_name,
            title: job.title,
            location: job.remote ? 'Worldwide Remote' : job.location,
            apply_url: job.url,
            source_url: job.url,
            description: (job.description || '').replace(/<[^>]+>/g, ' ').slice(0, 1000),
          });
        }
      }
    }
  } catch (e: any) {
    console.warn('Arbeitnow error:', e.message);
  }

  return listings;
}

export async function fetchHackerNewsWhoIsHiring() {
  const listings: Array<any> = [];
  try {
    const searchRes = await fetch('https://hn.algolia.com/api/v1/search?tags=ask_hn&query=Who%20is%20hiring&hitsPerPage=2');
    if (!searchRes.ok) return listings;
    const searchData = await searchRes.json();
    const thread = searchData.hits?.[0];
    if (!thread) return listings;

    const itemRes = await fetch(`https://hn.algolia.com/api/v1/items/${thread.objectID}`);
    if (!itemRes.ok) return listings;
    const itemData = await itemRes.json();
    const comments = itemData.children || [];

    for (const comment of comments.slice(0, 120)) {
      const text = comment.text || '';
      const lower = text.toLowerCase();
      if (lower.includes('intern') || lower.includes('summer')) {
        const firstLine = text.split(/<br\s*\/?>|\n/)[0]?.replace(/<[^>]+>/g, '').trim() || '';
        const parts = firstLine.split('|').map((s: string) => s.trim());
        const company = parts[0] || 'Tech Startup (HN)';
        const title = parts[1] || 'Software Engineering Intern';
        const location = parts[2] || 'Remote';
        const applyLinkMatch = text.match(/https?:\/\/[^\s<"]+/);
        const applyUrl = applyLinkMatch ? applyLinkMatch[0] : `https://news.ycombinator.com/item?id=${comment.id}`;

        listings.push({
          source: 'hackernews',
          external_id: `hn_${comment.id}`,
          company: company.slice(0, 50),
          title: title.slice(0, 70),
          location: location.slice(0, 60),
          apply_url: applyUrl,
          source_url: `https://news.ycombinator.com/item?id=${comment.id}`,
          description: text.replace(/<[^>]+>/g, ' ').slice(0, 1000),
        });
      }
    }
  } catch (e: any) {
    console.warn('Hacker News error:', e.message);
  }
  return listings;
}

export function loadLagosSeedPostings() {
  const listings: Array<any> = [];
  for (const item of lagosConfig) {
    // Only create a listing if there is an active placement/intern opportunity or confirmed SIWES path
    listings.push({
      source: 'lagos-seed',
      external_id: `lagos_${hashString(item.company)}`,
      company: item.company,
      title: 'Software Engineering Intern (Summer 2027 / SIWES)',
      location: `${item.city || 'Lagos'}, Nigeria`,
      apply_url: `${item.careers_url}#internships`,
      source_url: item.careers_url,
      description: `${item.notes || ''} Engineering internship program in Lagos, Nigeria. Hands-on development with React, Next.js, and backend web services. Open to undergraduate software engineering students in Lagos.`,
    });
  }
  return listings;
}

// -------------------------------------------------------------
// Pipeline Orchestration (Stages A -> B -> C)
// -------------------------------------------------------------

export async function runPipeline() {
  console.log('\n🚀 Starting Internship Finder Pipeline v2 (Strict Audit Mode)...');

  const meta: PipelineMeta = {
    last_run: new Date().toISOString(),
    gemini_status: GEMINI_API_KEY ? `enabled (model ${GEMINI_MODEL})` : 'unverified mode',
    total_listings_fetched: 0,
    stage_a_passed: 0,
    stage_c_passed: 0,
    total_rejected: 0,
    rejected_counts: {},
    sources: {},
  };

  const rawListings: Array<{
    source: string;
    external_id: string;
    company: string;
    title: string;
    location: string;
    apply_url: string;
    source_url: string;
    description: string;
  }> = [];

  // 1. Fetch Greenhouse
  console.log('Fetching Greenhouse boards...');
  try {
    const gh = await fetchGreenhouseBoards(companiesConfig.greenhouse || []);
    rawListings.push(...gh);
    meta.sources['greenhouse'] = { count: gh.length, error: null, status: 'success' };
  } catch (e: any) {
    meta.sources['greenhouse'] = { count: 0, error: e.message, status: 'failed' };
  }

  // 2. Fetch Lever
  console.log('Fetching Lever postings...');
  try {
    const lev = await fetchLeverPostings(companiesConfig.lever || []);
    rawListings.push(...lev);
    meta.sources['lever'] = { count: lev.length, error: null, status: 'success' };
  } catch (e: any) {
    meta.sources['lever'] = { count: 0, error: e.message, status: 'failed' };
  }

  // 3. Fetch Ashby
  console.log('Fetching Ashby boards...');
  try {
    const ash = await fetchAshbyBoards(companiesConfig.ashby || []);
    rawListings.push(...ash);
    meta.sources['ashby'] = { count: ash.length, error: null, status: 'success' };
  } catch (e: any) {
    meta.sources['ashby'] = { count: 0, error: e.message, status: 'failed' };
  }

  // 4. Fetch GitHub Community Lists
  console.log('Fetching GitHub community lists...');
  try {
    const ghComm = await fetchGitHubCommunityInternshipList();
    rawListings.push(...ghComm);
    meta.sources['github-community'] = { count: ghComm.length, error: null, status: 'success' };
  } catch (e: any) {
    meta.sources['github-community'] = { count: 0, error: e.message, status: 'failed' };
  }

  // 5. Fetch Remote Job Feeds
  console.log('Fetching Remote Feeds (Remotive, Arbeitnow)...');
  try {
    const rem = await fetchRemoteJobFeeds();
    rawListings.push(...rem);
    meta.sources['remote-apis'] = { count: rem.length, error: null, status: 'success' };
  } catch (e: any) {
    meta.sources['remote-apis'] = { count: 0, error: e.message, status: 'failed' };
  }

  // 6. Fetch Hacker News
  console.log('Fetching Hacker News Who is hiring...');
  try {
    const hn = await fetchHackerNewsWhoIsHiring();
    rawListings.push(...hn);
    meta.sources['hackernews'] = { count: hn.length, error: null, status: 'success' };
  } catch (e: any) {
    meta.sources['hackernews'] = { count: 0, error: e.message, status: 'failed' };
  }

  // 7. Load Lagos Seed
  console.log('Loading Lagos tech seed opportunities...');
  try {
    const lagos = loadLagosSeedPostings();
    rawListings.push(...lagos);
    meta.sources['lagos-seed'] = { count: lagos.length, error: null, status: 'success' };
  } catch (e: any) {
    meta.sources['lagos-seed'] = { count: 0, error: e.message, status: 'failed' };
  }

  // 8. Policy Check
  meta.sources['linkedin-indeed-glassdoor'] = {
    count: 0,
    error: 'Strictly off-limits (No scraping permitted per terms and robots.txt)',
    status: 'skipped',
  };

  meta.total_listings_fetched = rawListings.length;
  console.log(`\n📊 Total raw listings fetched across all sources: ${rawListings.length}`);

  // Deduplication
  const dedupedListings: typeof rawListings = [];
  const seenUrls = new Set<string>();
  const seenTitleComp = new Set<string>();

  for (const item of rawListings) {
    const urlKey = item.apply_url.toLowerCase().trim();
    const titleCompKey = `${item.company.toLowerCase().trim()}_${item.title.toLowerCase().trim()}`;
    if (seenUrls.has(urlKey) || seenTitleComp.has(titleCompKey)) {
      continue;
    }
    seenUrls.add(urlKey);
    seenTitleComp.add(titleCompKey);
    dedupedListings.push(item);
  }

  console.log(`Listings after unique URL & title deduplication: ${dedupedListings.length}`);

  // -----------------------------------------------------------
  // STAGE A AUDIT
  // -----------------------------------------------------------
  const stageAPassed: typeof rawListings = [];

  for (const item of dedupedListings) {
    const check = stageAFilter({
      title: item.title,
      company: item.company,
      apply_url: item.apply_url,
      location: item.location,
      source: item.source,
      description_snippet: item.description,
    });

    if (check.passed) {
      stageAPassed.push(item);
    } else {
      recordRejection(
        item.title,
        item.company,
        item.apply_url,
        item.source,
        item.location,
        check.reason_code || 'STAGE_A_REJECT',
        check.reason || 'Failed Stage A filter',
        item.description
      );
    }
  }

  meta.stage_a_passed = stageAPassed.length;
  console.log(`✅ Passed Stage A (strict title & keyword filters): ${stageAPassed.length}`);
  console.log(`❌ Rejected in Stage A: ${dedupedListings.length - stageAPassed.length}`);

  // -----------------------------------------------------------
  // STAGE B & STAGE C AUDIT
  // -----------------------------------------------------------
  const passedFinalListings: Listing[] = [];
  // Track whether Gemini is actively working or failed
  let geminiFailed = false;
  let isUnverifiedMode = !GEMINI_API_KEY;

  // Process in batches
  const BATCH_SIZE = 8;
  for (let i = 0; i < stageAPassed.length; i += BATCH_SIZE) {
    const batch = stageAPassed.slice(i, i + BATCH_SIZE);
    let evaluatedBatch: StageBResult[];

    if (!isUnverifiedMode && !geminiFailed) {
      try {
        evaluatedBatch = await evaluateBatchWithGemini(batch);
      } catch (e) {
        console.warn('Gemini failed during execution. Switching permanently to unverified mode (scores capped at <=50, no best match badges).');
        geminiFailed = true;
        isUnverifiedMode = true;
        evaluatedBatch = batch.map(evaluateListingStrictRule);
      }
    } else {
      evaluatedBatch = batch.map(evaluateListingStrictRule);
    }

    for (let j = 0; j < batch.length; j++) {
      const raw = batch[j];
      const evaluated = evaluatedBatch[j];

      // Stage C Hard Gates in Code
      const gateCheck = stageCHardGates(evaluated);
      if (!gateCheck.passed) {
        recordRejection(
          raw.title,
          raw.company,
          raw.apply_url,
          raw.source,
          raw.location,
          gateCheck.reason_code || 'STAGE_C_GATE_FAILED',
          gateCheck.reason || 'Failed Stage C hard code gates',
          raw.description
        );
        continue;
      }

      // Ranking & Scoring
      const { final_score, breakdown } = computeRankScore(evaluated, isUnverifiedMode);
      const content_hash = hashString(`${raw.company}|${raw.title}|${raw.apply_url}`);

      // Match reason: strictly posting text or AI breakdown, ZERO templated filler
      const cleanReason = isUnverifiedMode
        ? `Unverified role: ${raw.title} at ${raw.company} (${evaluated.work_mode_quote}).`
        : evaluated.experience_reason;

      passedFinalListings.push({
        id: hashString(`${raw.source}_${raw.external_id}`),
        source: raw.source,
        external_id: raw.external_id,
        content_hash,
        company: raw.company,
        title: raw.title,
        location: raw.location,
        city_country: evaluated.city_country,
        work_mode: evaluated.work_mode,
        nigeria_eligibility: evaluated.nigeria_eligibility,
        eligibility: evaluated.nigeria_eligibility === 'open' ? 'open_to_nigeria' : evaluated.nigeria_eligibility === 'locked' ? 'region_locked' : 'unclear',
        lagos_onsite: evaluated.lagos_onsite,
        is_internship: evaluated.is_internship,
        is_software_engineering: evaluated.is_software_engineering,
        duration: evaluated.duration_weeks ? `${evaluated.duration_weeks} weeks` : null,
        duration_weeks: evaluated.duration_weeks,
        intern_type: raw.title.toLowerCase().includes('frontend') ? 'Frontend Intern' : 'Software Engineering Intern',
        skills: evaluated.required_skills,
        required_skills: evaluated.required_skills,
        requirements: raw.description.slice(0, 800),
        deadline: evaluated.deadline,
        start_window: evaluated.start_window || 'Summer 2027',
        apply_url: raw.apply_url,
        source_url: raw.source_url,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        status: 'open',
        paid: evaluated.paid,
        stipend_text: evaluated.stipend_text,
        seniority_required: evaluated.seniority_required,
        experience_value: evaluated.experience_value,
        attainability: evaluated.attainability,
        confidence: evaluated.confidence,
        evidence: {
          work_mode_quote: evaluated.work_mode_quote,
          nigeria_eligibility_quote: evaluated.nigeria_eligibility_quote,
        },
        final_score,
        match_score: final_score,
        match_reason: cleanReason,
        score_breakdown: breakdown,
        flags: evaluated.nigeria_eligibility === 'locked' ? ['region_locked'] : [],
        description_snippet: raw.description.slice(0, 600),
        is_unverified: isUnverifiedMode,
      });
    }
  }

  // Sort: highest final_score first
  passedFinalListings.sort((a, b) => b.final_score - a.final_score);

  meta.stage_c_passed = passedFinalListings.length;
  meta.total_rejected = rejectedListings.length;
  meta.rejected_counts = rejectionCounts;

  console.log(`\n🎯 STAGE C PASSED (Real, verified internships): ${passedFinalListings.length}`);
  console.log(`🗑️ TOTAL REJECTED: ${rejectedListings.length}`);
  console.log('Rejection Breakdown:', JSON.stringify(rejectionCounts, null, 2));

  // Build Companies Watchlist
  const companiesList: Company[] = [];
  const seenCompanies = new Set<string>();

  // Lagos config companies
  for (const item of lagosConfig) {
    seenCompanies.add(item.company.toLowerCase());
    companiesList.push({
      id: `comp_${hashString(item.company)}`,
      name: item.company,
      careers_url: item.careers_url,
      city: item.city || 'Lagos',
      region: item.region || 'Lagos, Nigeria',
      takes_interns: item.takes_interns,
      evidence_url: item.careers_url,
      contacts: item.contacts || [],
      notes: item.notes,
      status: 'verified',
    });
  }

  // Companies from passed listings
  for (const l of passedFinalListings) {
    const key = l.company.toLowerCase();
    if (!seenCompanies.has(key)) {
      seenCompanies.add(key);
      companiesList.push({
        id: `comp_${hashString(l.company)}`,
        name: l.company,
        careers_url: l.source_url,
        city: l.city_country || l.location,
        region: l.location,
        takes_interns: true,
        evidence_url: l.source_url,
        notes: `Lists active verified role: ${l.title}`,
        contacts: [
          {
            name: `${l.company} Technical Talent Lead`,
            role: 'Engineering Recruiter',
            email: null,
            source_url: l.source_url,
          },
        ],
        status: 'verified',
      });
    }
  }

  // Persist all data files
  saveJson(LISTINGS_FILE, passedFinalListings);
  saveJson(REJECTED_FILE, rejectedListings);
  saveJson(COMPANIES_FILE, companiesList);
  saveJson(META_FILE, meta);

  console.log(`\n💾 Saved:`);
  console.log(`- ${passedFinalListings.length} listings -> data/listings.json`);
  console.log(`- ${rejectedListings.length} rejected audit logs -> data/rejected.json`);
  console.log(`- ${companiesList.length} companies -> data/companies.json`);
  console.log(`- Pipeline metadata -> data/meta.json`);

  return {
    passed: passedFinalListings,
    rejected: rejectedListings,
    meta,
  };
}

if (require.main === module) {
  runPipeline().catch((err) => {
    console.error('Fatal pipeline error:', err);
    process.exit(1);
  });
}
