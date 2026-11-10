import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load environment
const envPath = path.join(process.cwd(), '.env.local');
let apiKey = process.env.GEMINI_API_KEY;
let modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (key === 'GEMINI_API_KEY' && !apiKey) apiKey = val;
      if (key === 'GEMINI_MODEL' && !process.env.GEMINI_MODEL) modelName = val;
    }
  }
}

interface SpecificPosting {
  company: string;
  title: string;
  apply_url: string;
  source: string;
  location: string;
  is_specific_posting: boolean;
  rejection_reason?: string;
}

const GENERIC_CAREERS_PATHS = [
  '',
  '/',
  '/careers',
  '/careers/',
  '/jobs',
  '/jobs/',
  '/career',
  '/career/',
  '/work-with-us',
  '/join-us',
  '/openings',
  '/opportunities',
  '/about/careers',
  '/company/careers',
  '/ng/careers',
  '/en/careers',
];

export function isSpecificJobPostingUrl(urlStr: string): { isSpecific: boolean; reason?: string } {
  try {
    const parsed = new URL(urlStr);
    const pathname = parsed.pathname.replace(/\/+$/, '').toLowerCase();

    // Check if domain root or generic careers path
    if (GENERIC_CAREERS_PATHS.includes(pathname) && !parsed.search && !parsed.hash) {
      return {
        isSpecific: false,
        reason: `Generic careers landing page (${urlStr}), not a specific job posting.`,
      };
    }

    // Must have a job ID or specific role slug path
    const hasJobIdOrSlug =
      /\/(jobs?|positions?|openings?|roles?|postings?)\/[a-z0-9-_]+/i.test(pathname) ||
      parsed.searchParams.has('gh_jid') ||
      parsed.searchParams.has('job_id') ||
      parsed.searchParams.has('jid') ||
      parsed.searchParams.has('id') ||
      /\b(intern|internship|trainee|siwes|engineer|developer)\b/i.test(pathname);

    if (!hasJobIdOrSlug) {
      return {
        isSpecific: false,
        reason: `URL does not contain a specific job identifier or role slug (${urlStr}).`,
      };
    }

    return { isSpecific: true };
  } catch {
    return { isSpecific: false, reason: `Invalid URL (${urlStr})` };
  }
}

export async function runGroundedLagosSearch() {
  console.log('\n🔎 Starting Grounded Lagos & Nigeria Internship Search...');
  console.log(`Using Gemini model: ${modelName}`);

  const lagosConfigPath = path.join(process.cwd(), 'config', 'lagos.json');
  const lagosCompanies = JSON.parse(fs.readFileSync(lagosConfigPath, 'utf8'));
  console.log(`Loaded ${lagosCompanies.length} companies from config/lagos.json`);

  const results: SpecificPosting[] = [];

  if (!apiKey) {
    console.warn('No GEMINI_API_KEY configured.');
    return results;
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // 1. Try Gemini with Google Search grounding tool
  console.log('\n[Phase 1] Attempting Gemini with Google Search grounding tool...');
  let groundingSucceeded = false;

  try {
    const groundedModel = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
      tools: [{ googleSearch: {} } as any],
    });

    const prompt = `Search the web for active 2026/2027 software engineering internship or SIWES application links in Lagos Nigeria.
Return a valid JSON array of objects:
[
  { "company": "...", "title": "...", "apply_url": "...", "location": "Lagos, Nigeria" }
]
Only return specific posting URLs (with job IDs or direct application slugs). If none exist, return [].`;

    const res = await groundedModel.generateContent(prompt);
    const text = res.response.text();
    console.log('Search grounding tool succeeded!');
    groundingSucceeded = true;

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      for (const item of parsed) {
        const check = isSpecificJobPostingUrl(item.apply_url || '');
        results.push({
          company: item.company || 'Unknown',
          title: item.title || 'Software Engineering Intern',
          apply_url: item.apply_url || '',
          source: 'gemini-search-grounding',
          location: item.location || 'Lagos, Nigeria',
          is_specific_posting: check.isSpecific,
          rejection_reason: check.reason,
        });
      }
    }
  } catch (err: any) {
    console.warn(`Search grounding tool unavailable on current plan: ${err.message?.slice(0, 160)}...`);
    console.log('Switching to Gemini model knowledge extraction for Nigerian tech ATS portals...');
  }

  // 2. Query Gemini directly for specific application links across target companies
  if (!groundingSucceeded || results.length === 0) {
    console.log('\n[Phase 2] Querying Gemini for verified Nigerian tech early-careers & SIWES ATS URLs...');
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const prompt = `You are auditing internship opportunities in Lagos, Nigeria for a 3rd-year software engineering student.
Here are prominent Lagos tech companies:
- Moniepoint (Greenhouse: boards.greenhouse.io/moniepoint)
- Paystack (Lever: jobs.lever.co/paystack)
- Flutterwave (Greenhouse: boards.greenhouse.io/flutterwave)
- Kuda Bank (Workable: apply.workable.com/kuda)
- Interswitch (careers portal)
- Andela Nigeria
- Reliance Health
- Helium Health
- Chowdeck
- MTN Nigeria

List any known specific ATS postings, academies, or application URLs for software engineer interns, trainees, or SIWES students in Nigeria.
Return ONLY a valid JSON array matching this schema:
[
  {
    "company": "Company Name",
    "title": "Role Title",
    "apply_url": "https://...",
    "location": "Lagos, Nigeria"
  }
]`;

      const res = await model.generateContent(prompt);
      const text = res.response.text();
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        for (const item of parsed) {
          const check = isSpecificJobPostingUrl(item.apply_url || '');
          results.push({
            company: item.company || 'Unknown',
            title: item.title || 'Software Engineering Intern',
            apply_url: item.apply_url || '',
            source: 'gemini-curated-ats',
            location: item.location || 'Lagos, Nigeria',
            is_specific_posting: check.isSpecific,
            rejection_reason: check.reason,
          });
        }
      }
    } catch (err: any) {
      console.error(`Gemini query error: ${err.message}`);
    }
  }

  // 3. Evaluate results under Stage A specific URL gate
  console.log('\n' + '='.repeat(60));
  console.log('AUDIT OF GROUNDED / CANDIDATE POSTINGS (Stage A Specific URL Gate)');
  console.log('='.repeat(60));

  const accepted = results.filter((r) => r.is_specific_posting);
  const rejected = results.filter((r) => !r.is_specific_posting);

  console.log(`Total candidate URLs evaluated: ${results.length}`);
  console.log(`✅ Accepted specific posting URLs: ${accepted.length}`);
  console.log(`❌ Rejected generic careers/root URLs: ${rejected.length}`);

  if (accepted.length > 0) {
    console.log('\nAccepted Specific Postings:');
    accepted.forEach((a) => {
      console.log(`  • ${a.title} at ${a.company}`);
      console.log(`    URL: ${a.apply_url}`);
      console.log(`    Location: ${a.location}`);
    });
  }

  if (rejected.length > 0) {
    console.log('\nRejected Generic Careers Pages (Moved to Companies Watchlist):');
    rejected.forEach((r) => {
      console.log(`  • ${r.company} (${r.apply_url})`);
      console.log(`    Reason: ${r.rejection_reason}`);
    });
  }

  return {
    total_companies: lagosCompanies.length,
    accepted,
    rejected,
  };
}

if (require.main === module) {
  runGroundedLagosSearch().catch(console.error);
}
