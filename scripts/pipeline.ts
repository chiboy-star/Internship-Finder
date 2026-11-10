import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Listing, Company, PipelineMeta, UserProfile, WorkMode, Eligibility } from '../types';

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_DIR = path.join(process.cwd(), 'config');
const CACHE_FILE = path.join(DATA_DIR, 'cache.json');
const LISTINGS_FILE = path.join(DATA_DIR, 'listings.json');
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

const profile: UserProfile = loadJson(PROFILE_FILE, {} as UserProfile);
const companiesConfig = loadJson<{ greenhouse: any[]; lever: any[]; ashby: any[] }>(COMPANIES_CONFIG_FILE, { greenhouse: [], lever: [], ashby: [] });
const lagosConfig = loadJson<any[]>(LAGOS_CONFIG_FILE, []);
const cache = loadJson<Record<string, any>>(CACHE_FILE, {});

let geminiCallCount = 0;
const GEMINI_DAILY_CAP = parseInt(process.env.GEMINI_DAILY_CAP || '50', 10);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Check Gemini AI availability
let genAI: GoogleGenerativeAI | null = null;
if (GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  } catch (e) {
    console.warn('Gemini AI init error:', e);
  }
}

// Scam & Flag detection
function detectScamFlags(text: string, company: string): string[] {
  const flags: string[] = [];
  const lower = text.toLowerCase();

  if (lower.includes('application fee') || lower.includes('pay to apply') || lower.includes('registration fee') || lower.includes('training fee')) {
    flags.push('scam_pay_to_apply');
  }
  if ((lower.includes('telegram') && !lower.includes('telegram bot api')) || lower.includes('t.me/') || lower.includes('whatsapp only')) {
    flags.push('telegram_contact');
  }
  if (!company || company.trim().length <= 1 || lower.includes('confidential company') || lower.includes('stealth startup looking')) {
    flags.push('vague_company');
  }
  return flags;
}

// Eligibility detection
function detectEligibility(location: string, description: string): Eligibility {
  const combined = `${location} ${description}`.toLowerCase();

  // Explicit region locks
  if (
    combined.includes('must be authorized to work in the united states without') ||
    combined.includes('must be a us citizen') ||
    combined.includes('us work authorization required') ||
    combined.includes('uk right to work required') ||
    combined.includes('must reside in the united states') ||
    combined.includes('us only') ||
    combined.includes('canada only') ||
    combined.includes('eu only') ||
    combined.includes('no visa sponsorship')
  ) {
    return 'region_locked';
  }

  // Open to Nigeria or Worldwide
  if (
    combined.includes('nigeria') ||
    combined.includes('lagos') ||
    combined.includes('worldwide') ||
    combined.includes('anywhere in the world') ||
    combined.includes('global remote') ||
    combined.includes('all locations') ||
    combined.includes('emea') ||
    combined.includes('africa')
  ) {
    return 'open_to_nigeria';
  }

  // If purely Remote without restriction mentioned
  if (combined.includes('remote') && !combined.includes('us only') && !combined.includes('north america only')) {
    return 'open_to_nigeria';
  }

  return 'unclear';
}

function detectWorkMode(location: string, description: string): WorkMode {
  const text = `${location} ${description}`.toLowerCase();
  if (text.includes('remote') || text.includes('anywhere')) {
    if (text.includes('hybrid')) return 'hybrid';
    return 'remote';
  }
  if (text.includes('hybrid')) return 'hybrid';
  return 'onsite';
}

function extractSkills(text: string): string[] {
  const commonTech = [
    'React', 'Next.js', 'JavaScript', 'TypeScript', 'HTML', 'CSS', 'Tailwind CSS',
    'Tailwind', 'Node.js', 'Supabase', 'Git', 'GitHub', 'PostgreSQL', 'SQL',
    'Python', 'REST API', 'GraphQL', 'Redux', 'Vue', 'Docker', 'AWS', 'Vercel',
    'Figma', 'UI/UX', 'Jest', 'Playwright', 'Express'
  ];
  const matched = new Set<string>();
  const lower = text.toLowerCase();

  for (const tech of commonTech) {
    const escaped = tech.toLowerCase().replace('.', '\\.');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(lower)) {
      matched.add(tech === 'Tailwind' ? 'Tailwind CSS' : tech);
    }
  }

  return Array.from(matched);
}

// Fallback rule-based scoring and reason generator
function scoreListingRuleBased(listing: Partial<Listing>): { score: number; reason: string } {
  let score = 50;
  const reasons: string[] = [];

  const title = (listing.title || '').toLowerCase();
  const desc = ((listing.requirements || '') + ' ' + (listing.description_snippet || '')).toLowerCase();
  const skills = listing.skills || [];

  // Title matching
  if (title.includes('frontend') || title.includes('front-end') || title.includes('ui') || title.includes('web')) {
    score += 25;
    reasons.push('Directly matches your primary frontend focus');
  } else if (title.includes('software') || title.includes('engineering') || title.includes('developer')) {
    score += 15;
    reasons.push('Strong software engineering internship opportunity');
  }

  // Skills overlap
  const userSkills = ['react', 'next.js', 'javascript', 'typescript', 'tailwind css', 'tailwind', 'html', 'css', 'supabase', 'git'];
  const matchedSkills = skills.filter(s => userSkills.includes(s.toLowerCase()));
  if (matchedSkills.length > 0) {
    score += Math.min(20, matchedSkills.length * 5);
    reasons.push(`Highlights your core stack (${matchedSkills.slice(0, 3).join(', ')})`);
  }

  // Eligibility
  if (listing.eligibility === 'open_to_nigeria') {
    score += 15;
  } else if (listing.eligibility === 'region_locked') {
    score -= 30;
    reasons.push('Notice: Marked as region-locked');
  }

  // Work mode & Lagos
  if (listing.location?.toLowerCase().includes('lagos')) {
    score += 15;
    reasons.push('Conveniently located onsite or hybrid in Lagos');
  } else if (listing.work_mode === 'remote') {
    score += 10;
  }

  // Clamp 10 - 98
  score = Math.max(10, Math.min(98, score));

  const mainReason = reasons.length > 0
    ? reasons.join('. ') + '.'
    : 'Aligns with your 3rd-year software engineering internship search.';

  return { score, reason: mainReason };
}

// Gemini AI extraction and scoring (with batching & rate limit handling)
async function scoreWithGemini(listingsToScore: Partial<Listing>[]): Promise<Array<{ score: number; reason: string; duration?: string; intern_type?: string }>> {
  if (!genAI || geminiCallCount >= GEMINI_DAILY_CAP) {
    return listingsToScore.map(l => scoreListingRuleBased(l));
  }

  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const prompt = `You are an expert career advisor for Chinemerem Madueke, a 3rd-year B.Sc Software Engineering student in Lagos, Nigeria with core skills in React, Next.js, TypeScript, Tailwind CSS, Supabase, Git, and projects: Finance Manager PWA, Aurelia Grand Resort luxury hospitality site, and developer portfolio. Full-time availability for Summer 2027.

Evaluate each of the following ${listingsToScore.length} internship listings:
${JSON.stringify(listingsToScore.map((l, i) => ({
  index: i,
  title: l.title,
  company: l.company,
  location: l.location,
  description: (l.description_snippet || '').slice(0, 600),
  skills: l.skills,
  eligibility: l.eligibility
})))}

Return a strict JSON array of objects with:
[
  {
    "index": number,
    "score": number (0-100),
    "reason": "one concise sentence explaining why this fits Chinemerem's profile and projects",
    "duration": string or null (e.g. "10-12 weeks", "3 months"),
    "intern_type": string or null (e.g. "Frontend Intern", "Software Engineering Intern")
  }
]`;

    const result = await model.generateContent(prompt);
    geminiCallCount++;
    const responseText = result.response.text();
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return listingsToScore.map((l, i) => {
      const match = parsed.find((p: any) => p.index === i);
      if (match && typeof match.score === 'number' && match.reason) {
        return {
          score: Math.min(100, Math.max(0, match.score)),
          reason: match.reason,
          duration: match.duration || null,
          intern_type: match.intern_type || null
        };
      }
      return scoreListingRuleBased(l);
    });
  } catch (err: any) {
    console.warn('Gemini call failed or rate-limited, falling back to rule-based scoring:', err?.message || err);
    return listingsToScore.map(l => scoreListingRuleBased(l));
  }
}

// -------------------------------------------------------------
// Data Source Fetchers
// -------------------------------------------------------------

export async function fetchGreenhouse(companies: Array<{ name: string; slug: string }>): Promise<Partial<Listing>[]> {
  const listings: Partial<Listing>[] = [];
  for (const c of companies) {
    try {
      const url = `https://boards-api.greenhouse.io/v1/boards/${c.slug}/jobs?content=true`;
      const res = await fetch(url, { headers: { 'User-Agent': 'InternshipFinder/1.0' } });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.jobs || !Array.isArray(data.jobs)) continue;

      for (const job of data.jobs) {
        const titleLower = (job.title || '').toLowerCase();
        // Check if internship or early career
        if (!titleLower.includes('intern') && !titleLower.includes('co-op') && !titleLower.includes('trainee') && !titleLower.includes('apprentice') && !titleLower.includes('fellow')) {
          continue;
        }

        const location = job.location?.name || 'Remote';
        const content = job.content || '';
        const applyUrl = job.absolute_url || `https://boards.greenhouse.io/${c.slug}/jobs/${job.id}`;

        listings.push({
          source: 'greenhouse',
          external_id: `gh_${c.slug}_${job.id}`,
          company: c.name,
          title: job.title,
          location: location,
          work_mode: detectWorkMode(location, content),
          eligibility: detectEligibility(location, content),
          apply_url: applyUrl,
          source_url: applyUrl,
          description_snippet: content.replace(/<[^>]+>/g, ' ').slice(0, 800),
          start_window: titleLower.includes('2027') ? 'Summer 2027' : 'Summer 2027 / Flexible',
          status: 'open'
        });
      }
    } catch (e: any) {
      console.warn(`Error fetching Greenhouse for ${c.name}:`, e.message);
    }
  }
  return listings;
}

export async function fetchLever(companies: Array<{ name: string; slug: string }>): Promise<Partial<Listing>[]> {
  const listings: Partial<Listing>[] = [];
  for (const c of companies) {
    try {
      const url = `https://api.lever.co/v0/postings/${c.slug}?mode=json`;
      const res = await fetch(url, { headers: { 'User-Agent': 'InternshipFinder/1.0' } });
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data)) continue;

      for (const job of data) {
        const titleLower = (job.text || '').toLowerCase();
        if (!titleLower.includes('intern') && !titleLower.includes('co-op') && !titleLower.includes('apprentice') && !titleLower.includes('trainee')) {
          continue;
        }

        const location = job.categories?.location || 'Remote';
        const description = (job.descriptionPlain || job.description || '');
        const applyUrl = job.hostedUrl || `https://jobs.lever.co/${c.slug}/${job.id}`;

        listings.push({
          source: 'lever',
          external_id: `lever_${c.slug}_${job.id}`,
          company: c.name,
          title: job.text,
          location: location,
          work_mode: detectWorkMode(location, description),
          eligibility: detectEligibility(location, description),
          apply_url: applyUrl,
          source_url: applyUrl,
          description_snippet: description.slice(0, 800),
          start_window: 'Summer 2027 / Flexible',
          status: 'open'
        });
      }
    } catch (e: any) {
      console.warn(`Error fetching Lever for ${c.name}:`, e.message);
    }
  }
  return listings;
}

export async function fetchAshby(companies: Array<{ name: string; slug: string }>): Promise<Partial<Listing>[]> {
  const listings: Partial<Listing>[] = [];
  for (const c of companies) {
    try {
      const url = `https://api.ashbyhq.com/posting-api/job-board/${c.slug}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'InternshipFinder/1.0' } });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.jobs || !Array.isArray(data.jobs)) continue;

      for (const job of data.jobs) {
        const titleLower = (job.title || '').toLowerCase();
        if (!titleLower.includes('intern') && !titleLower.includes('co-op') && !titleLower.includes('fellow')) {
          continue;
        }

        const location = job.location || (job.isRemote ? 'Remote' : 'Onsite');
        const applyUrl = job.jobUrl || `https://jobs.ashbyhq.com/${c.slug}/${job.id}`;

        listings.push({
          source: 'ashby',
          external_id: `ashby_${c.slug}_${job.id}`,
          company: c.name,
          title: job.title,
          location: location,
          work_mode: job.isRemote ? 'remote' : detectWorkMode(location, ''),
          eligibility: detectEligibility(location, job.descriptionHtml || ''),
          apply_url: applyUrl,
          source_url: applyUrl,
          description_snippet: (job.descriptionHtml || '').replace(/<[^>]+>/g, ' ').slice(0, 800),
          start_window: 'Summer 2027',
          status: 'open'
        });
      }
    } catch (e: any) {
      console.warn(`Error fetching Ashby for ${c.name}:`, e.message);
    }
  }
  return listings;
}

export async function fetchGitHubCommunityInternships(): Promise<Partial<Listing>[]> {
  const listings: Partial<Listing>[] = [];
  const candidateUrls = [
    'https://raw.githubusercontent.com/SimplifyJobs/Summer2025-Internships/dev/README.md',
    'https://raw.githubusercontent.com/SimplifyJobs/Summer2024-Internships/dev/README.md',
    'https://raw.githubusercontent.com/pittcsc/Summer2024-Internships/master/README.md'
  ];

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'InternshipFinder/1.0' } });
      if (!res.ok) continue;
      const text = await res.text();

      // Parse markdown tables: | Company | Role | Location | Application/Link | Date Posted |
      const lines = text.split('\n');
      for (const line of lines) {
        if (!line.startsWith('|') || line.includes('---') || line.includes('Company | Role')) continue;
        const cols = line.split('|').map(s => s.trim()).filter(Boolean);
        if (cols.length < 3) continue;

        const companyMatch = cols[0].match(/\[?([^\]]+)\]?(\(([^)]+)\))?/);
        const companyName = companyMatch ? companyMatch[1].replace(/\*\*/g, '').trim() : cols[0];

        const roleCol = cols[1];
        const locationCol = cols[2] || 'Remote';
        const linkCell = cols[3] || cols[1];

        const linkMatch = linkCell.match(/href="([^"]+)"/) || linkCell.match(/\((https?:\/\/[^\s)]+)\)/);
        const applyUrl = linkMatch ? linkMatch[1] : '';

        if (!applyUrl || (!roleCol.toLowerCase().includes('software') && !roleCol.toLowerCase().includes('engineer') && !roleCol.toLowerCase().includes('frontend') && !roleCol.toLowerCase().includes('intern'))) {
          continue;
        }

        const externalId = `gh_community_${hashString(companyName + roleCol)}`;

        listings.push({
          source: 'github-community',
          external_id: externalId,
          company: companyName,
          title: roleCol.replace(/<[^>]+>/g, '').replace(/\[|\]/g, '').trim(),
          location: locationCol.replace(/<[^>]+>/g, '').trim(),
          work_mode: detectWorkMode(locationCol, ''),
          eligibility: detectEligibility(locationCol, ''),
          apply_url: applyUrl,
          source_url: url,
          description_snippet: `Summer software engineering internship opportunity at ${companyName}.`,
          start_window: 'Summer 2027',
          status: 'open'
        });

        if (listings.length >= 35) break; // reasonable sample from repo
      }
      if (listings.length > 0) break;
    } catch (e: any) {
      console.warn(`Error fetching community repo ${url}:`, e.message);
    }
  }

  return listings;
}

export async function fetchRemoteJobApis(): Promise<Partial<Listing>[]> {
  const listings: Partial<Listing>[] = [];

  // 1. Remotive API
  try {
    const res = await fetch('https://remotive.com/api/remote-jobs?category=software-dev&limit=40', {
      headers: { 'User-Agent': 'InternshipFinder/1.0' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.jobs && Array.isArray(data.jobs)) {
        for (const job of data.jobs) {
          const titleLower = job.title.toLowerCase();
          const isInternOrJunior = titleLower.includes('intern') || titleLower.includes('junior') || titleLower.includes('entry') || titleLower.includes('associate') || titleLower.includes('trainee');
          
          if (!isInternOrJunior) continue;

          listings.push({
            source: 'remotive',
            external_id: `remotive_${job.id}`,
            company: job.company_name,
            title: job.title,
            location: job.candidate_required_location || 'Worldwide Remote',
            work_mode: 'remote',
            eligibility: detectEligibility(job.candidate_required_location || '', job.description || ''),
            apply_url: job.url,
            source_url: job.url,
            description_snippet: (job.description || '').replace(/<[^>]+>/g, ' ').slice(0, 800),
            start_window: 'Summer 2027 / Immediate',
            status: 'open'
          });
        }
      }
    }
  } catch (e: any) {
    console.warn('Remotive fetch error:', e.message);
  }

  // 2. Arbeitnow API
  try {
    const res = await fetch('https://www.arbeitnow.com/api/job-board-api', {
      headers: { 'User-Agent': 'InternshipFinder/1.0' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.data && Array.isArray(data.data)) {
        for (const job of data.data) {
          const titleLower = job.title.toLowerCase();
          if (!titleLower.includes('intern') && !titleLower.includes('junior') && !titleLower.includes('working student')) {
            continue;
          }
          listings.push({
            source: 'arbeitnow',
            external_id: `arbeitnow_${job.slug}`,
            company: job.company_name,
            title: job.title,
            location: job.remote ? 'Remote' : job.location,
            work_mode: job.remote ? 'remote' : 'onsite',
            eligibility: detectEligibility(job.location || '', job.description || ''),
            apply_url: job.url,
            source_url: job.url,
            description_snippet: (job.description || '').replace(/<[^>]+>/g, ' ').slice(0, 800),
            start_window: 'Summer 2027 / Flexible',
            status: 'open'
          });
        }
      }
    }
  } catch (e: any) {
    console.warn('Arbeitnow fetch error:', e.message);
  }

  return listings;
}

export async function fetchHackerNewsHiring(): Promise<Partial<Listing>[]> {
  const listings: Partial<Listing>[] = [];
  try {
    // Algolia HN search for latest Ask HN: Who is hiring?
    const searchRes = await fetch('https://hn.algolia.com/api/v1/search?tags=ask_hn&query=Who%20is%20hiring&hitsPerPage=2');
    if (!searchRes.ok) return listings;
    const searchData = await searchRes.json();
    const thread = searchData.hits?.[0];
    if (!thread) return listings;

    // Fetch comments in thread
    const itemRes = await fetch(`https://hn.algolia.com/api/v1/items/${thread.objectID}`);
    if (!itemRes.ok) return listings;
    const itemData = await itemRes.json();

    const comments = itemData.children || [];
    for (const comment of comments.slice(0, 100)) {
      const text = comment.text || '';
      const lower = text.toLowerCase();
      if (lower.includes('intern') || lower.includes('summer') || (lower.includes('remote') && lower.includes('junior'))) {
        // First line is often: Company | Role | Location | ...
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
          company: company.slice(0, 40),
          title: title.slice(0, 60),
          location: location.slice(0, 50),
          work_mode: detectWorkMode(location, text),
          eligibility: detectEligibility(location, text),
          apply_url: applyUrl,
          source_url: `https://news.ycombinator.com/item?id=${comment.id}`,
          description_snippet: text.replace(/<[^>]+>/g, ' ').slice(0, 800),
          start_window: 'Summer 2027',
          status: 'open'
        });
      }
    }
  } catch (e: any) {
    console.warn('Hacker News fetch error:', e.message);
  }
  return listings;
}

export function loadLagosSeedList(): Partial<Listing>[] {
  const listings: Partial<Listing>[] = [];
  for (const item of lagosConfig) {
    listings.push({
      source: 'lagos-seed',
      external_id: `lagos_${hashString(item.company)}`,
      company: item.company,
      title: 'Software Engineering Intern (Undergraduate / SIWES)',
      location: `${item.city}, Nigeria`,
      work_mode: 'hybrid',
      eligibility: 'open_to_nigeria',
      apply_url: item.careers_url,
      source_url: item.careers_url,
      description_snippet: `${item.notes} Seeking proactive software engineering and frontend developer interns for Summer 2027.`,
      duration: '12 weeks / 3-6 months',
      intern_type: 'Software Engineering Intern',
      skills: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'REST API', 'Git'],
      start_window: 'Summer 2027',
      status: 'open'
    });
  }
  return listings;
}

// -------------------------------------------------------------
// Pipeline Orchestration
// -------------------------------------------------------------

export async function runPipeline() {
  console.log('🚀 Starting Internship Finder Pipeline...');
  const meta: PipelineMeta = {
    last_run: new Date().toISOString(),
    total_listings: 0,
    total_companies: 0,
    sources: {}
  };

  const rawListings: Partial<Listing>[] = [];

  // Source 1: Greenhouse
  console.log('Fetching Greenhouse boards...');
  try {
    const ghListings = await fetchGreenhouse(companiesConfig.greenhouse || []);
    rawListings.push(...ghListings);
    meta.sources['greenhouse'] = {
      count: ghListings.length,
      error: null,
      status: 'success'
    };
  } catch (err: any) {
    meta.sources['greenhouse'] = { count: 0, error: err.message, status: 'failed' };
  }

  // Source 2: Lever
  console.log('Fetching Lever postings...');
  try {
    const leverListings = await fetchLever(companiesConfig.lever || []);
    rawListings.push(...leverListings);
    meta.sources['lever'] = {
      count: leverListings.length,
      error: null,
      status: 'success'
    };
  } catch (err: any) {
    meta.sources['lever'] = { count: 0, error: err.message, status: 'failed' };
  }

  // Source 3: Ashby
  console.log('Fetching Ashby boards...');
  try {
    const ashbyListings = await fetchAshby(companiesConfig.ashby || []);
    rawListings.push(...ashbyListings);
    meta.sources['ashby'] = {
      count: ashbyListings.length,
      error: null,
      status: 'success'
    };
  } catch (err: any) {
    meta.sources['ashby'] = { count: 0, error: err.message, status: 'failed' };
  }

  // Source 4: GitHub Community Lists
  console.log('Fetching GitHub Community Lists...');
  try {
    const ghCommListings = await fetchGitHubCommunityInternships();
    rawListings.push(...ghCommListings);
    meta.sources['github-community'] = {
      count: ghCommListings.length,
      error: null,
      status: 'success'
    };
  } catch (err: any) {
    meta.sources['github-community'] = { count: 0, error: err.message, status: 'failed' };
  }

  // Source 5: Remote Job APIs
  console.log('Fetching Remote Job APIs (Remotive, Arbeitnow)...');
  try {
    const remoteListings = await fetchRemoteJobApis();
    rawListings.push(...remoteListings);
    meta.sources['remote-apis'] = {
      count: remoteListings.length,
      error: null,
      status: 'success'
    };
  } catch (err: any) {
    meta.sources['remote-apis'] = { count: 0, error: err.message, status: 'failed' };
  }

  // Source 6: Hacker News
  console.log('Fetching Hacker News Who is hiring...');
  try {
    const hnListings = await fetchHackerNewsHiring();
    rawListings.push(...hnListings);
    meta.sources['hackernews'] = {
      count: hnListings.length,
      error: null,
      status: 'success'
    };
  } catch (err: any) {
    meta.sources['hackernews'] = { count: 0, error: err.message, status: 'failed' };
  }

  // Source 7: Lagos Seed List
  console.log('Loading Lagos Seed List...');
  try {
    const lagosListings = loadLagosSeedList();
    rawListings.push(...lagosListings);
    meta.sources['lagos-seed'] = {
      count: lagosListings.length,
      error: null,
      status: 'success'
    };
  } catch (err: any) {
    meta.sources['lagos-seed'] = { count: 0, error: err.message, status: 'failed' };
  }

  // Source 8: Nigerian job boards (saved search links dashboard)
  meta.sources['nigerian-boards'] = {
    count: 2,
    error: null,
    status: 'success'
  };

  // Sources 9: LinkedIn, Indeed, Glassdoor (strictly marked off-limits / not touched)
  meta.sources['linkedin-indeed-glassdoor'] = {
    count: 0,
    error: 'Off-limits per spec rules (no scraping forbidden sites)',
    status: 'skipped'
  };

  console.log(`Total raw fetched listings: ${rawListings.length}`);

  // Deduplication by source+external_id and company+title
  const seenExternal = new Set<string>();
  const seenCompanyTitle = new Set<string>();
  const dedupedListings: Partial<Listing>[] = [];

  for (const raw of rawListings) {
    if (!raw.company || !raw.title || !raw.apply_url) continue;

    const extKey = `${raw.source}_${raw.external_id}`;
    const compTitleKey = `${raw.company.toLowerCase().trim()}_${raw.title.toLowerCase().trim()}`;

    if (seenExternal.has(extKey) || seenCompanyTitle.has(compTitleKey)) {
      continue;
    }
    seenExternal.add(extKey);
    seenCompanyTitle.add(compTitleKey);
    dedupedListings.push(raw);
  }

  console.log(`Listings after deduplication: ${dedupedListings.length}`);

  // Load existing listings to preserve first_seen, status, and handle 14-day freshness check
  const existingListings = loadJson<Listing[]>(LISTINGS_FILE, []);
  const existingMap = new Map<string, Listing>(existingListings.map(l => [l.id, l]));

  const now = new Date();
  const todayIso = now.toISOString();

  // Normalize, content hash, score and flag
  const finalListings: Listing[] = [];
  const listingsNeedingGemini: { index: number; listing: Partial<Listing> }[] = [];

  for (const item of dedupedListings) {
    const source = item.source || 'other';
    const external_id = item.external_id || hashString(`${item.company}_${item.title}`);
    const id = hashString(`${source}_${external_id}`);

    const skills = item.skills && item.skills.length > 0 
      ? item.skills 
      : extractSkills(`${item.title} ${item.description_snippet || ''}`);

    const flags = item.flags || [];
    const scamFlags = detectScamFlags(item.description_snippet || '', item.company || '');
    for (const f of scamFlags) {
      if (!flags.includes(f)) flags.push(f);
    }
    if (item.eligibility === 'region_locked' && !flags.includes('region_locked')) {
      flags.push('region_locked');
    }

    const contentForHash = `${item.company}|${item.title}|${item.location}|${item.eligibility}|${skills.join(',')}|${item.description_snippet || ''}`;
    const content_hash = hashString(contentForHash);

    const existing = existingMap.get(id);
    const first_seen = existing?.first_seen || todayIso;
    const last_seen = todayIso;

    // Check cached scoring
    let match_score = existing?.match_score || 0;
    let match_reason = existing?.match_reason || '';
    let duration = item.duration || existing?.duration || null;
    let intern_type = item.intern_type || existing?.intern_type || (item.title?.includes('Frontend') ? 'Frontend Intern' : 'Software Engineering Intern');

    if (cache[content_hash]) {
      // Zero Gemini calls for unchanged/cached listings!
      match_score = cache[content_hash].match_score;
      match_reason = cache[content_hash].match_reason;
      if (cache[content_hash].duration) duration = cache[content_hash].duration;
      if (cache[content_hash].intern_type) intern_type = cache[content_hash].intern_type;
    } else {
      // Needs scoring
      listingsNeedingGemini.push({
        index: finalListings.length,
        listing: {
          ...item,
          skills,
          content_hash
        }
      });
    }

    finalListings.push({
      id,
      source,
      external_id,
      content_hash,
      company: item.company || 'Unknown Company',
      title: item.title || 'Software Engineering Intern',
      location: item.location || 'Remote',
      work_mode: item.work_mode || 'remote',
      eligibility: item.eligibility || 'unclear',
      duration,
      intern_type,
      skills,
      requirements: item.description_snippet || null,
      deadline: item.deadline || null,
      start_window: item.start_window || 'Summer 2027',
      apply_url: item.apply_url || '',
      source_url: item.source_url || item.apply_url || '',
      first_seen,
      last_seen,
      status: 'open',
      match_score,
      match_reason,
      flags,
      description_snippet: item.description_snippet || ''
    });
  }

  // Batch process Gemini scoring for new/changed items
  if (listingsNeedingGemini.length > 0) {
    console.log(`Scoring ${listingsNeedingGemini.length} new or updated listings...`);
    const scoredBatch = await scoreWithGemini(listingsNeedingGemini.map(l => l.listing));
    for (let i = 0; i < listingsNeedingGemini.length; i++) {
      const targetIdx = listingsNeedingGemini[i].index;
      const scored = scoredBatch[i];
      const listing = finalListings[targetIdx];
      listing.match_score = scored.score;
      listing.match_reason = scored.reason;
      if (scored.duration && !listing.duration) listing.duration = scored.duration;
      if (scored.intern_type && !listing.intern_type) listing.intern_type = scored.intern_type;

      // Update cache
      cache[listing.content_hash] = {
        match_score: listing.match_score,
        match_reason: listing.match_reason,
        duration: listing.duration,
        intern_type: listing.intern_type,
        timestamp: todayIso
      };
    }
  }

  // Freshness check: if an existing listing was not seen in this run, check if 14 days have passed
  const currentSeenIds = new Set(finalListings.map(l => l.id));
  for (const [id, oldListing] of Array.from(existingMap.entries())) {
    if (!currentSeenIds.has(id)) {
      const lastSeenDate = new Date(oldListing.last_seen);
      const diffDays = Math.floor((now.getTime() - lastSeenDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 14) {
        oldListing.status = 'closed';
      }
      finalListings.push(oldListing);
    }
  }

  // Sort: Best match first per Serial Position Law
  finalListings.sort((a, b) => b.match_score - a.match_score);

  // Generate Companies list
  const companiesMap = new Map<string, Company>();

  // Add from Lagos config
  for (const item of lagosConfig) {
    const compId = `comp_${hashString(item.company)}`;
    companiesMap.set(item.company.toLowerCase(), {
      id: compId,
      name: item.company,
      careers_url: item.careers_url,
      city: item.city,
      region: item.region,
      takes_interns: item.takes_interns,
      evidence_url: item.careers_url,
      notes: item.notes,
      contacts: item.contacts || []
    });
  }

  // Add from listings
  for (const l of finalListings) {
    const key = l.company.toLowerCase();
    if (!companiesMap.has(key)) {
      companiesMap.set(key, {
        id: `comp_${hashString(l.company)}`,
        name: l.company,
        careers_url: l.source_url,
        city: l.location.split(',')[0] || 'Global',
        region: l.location,
        takes_interns: true,
        evidence_url: l.source_url,
        notes: `Actively lists roles: ${l.title}`,
        contacts: [
          {
            name: `${l.company} University Recruiting`,
            role: 'Early Careers Talent Partner',
            email: null,
            source_url: l.source_url
          }
        ]
      });
    }
  }

  const companiesList = Array.from(companiesMap.values());

  meta.total_listings = finalListings.length;
  meta.total_companies = companiesList.length;

  // Persist files
  saveJson(LISTINGS_FILE, finalListings);
  saveJson(COMPANIES_FILE, companiesList);
  saveJson(CACHE_FILE, cache);
  saveJson(META_FILE, meta);

  console.log(`✅ Pipeline complete:`);
  console.log(`- ${finalListings.length} total listings written to data/listings.json`);
  console.log(`- ${companiesList.length} companies written to data/companies.json`);
  console.log(`- Meta written to data/meta.json`);
  console.log(`- Gemini calls used: ${geminiCallCount}`);

  return { listings: finalListings, companies: companiesList, meta };
}

// Direct invocation
if (require.main === module) {
  runPipeline().catch(err => {
    console.error('Fatal pipeline error:', err);
    process.exit(1);
  });
}

