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

interface RawSearchResult {
  query: string;
  title: string;
  url: string;
  snippet?: string;
  passesGate: boolean;
  rejectionReason?: string;
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

    // Check if query params have a specific job identifier
    const searchParams = parsed.searchParams;
    const hasJobIdInQuery =
      searchParams.has('gh_jid') ||
      searchParams.has('jobId') ||
      searchParams.has('job_id') ||
      searchParams.has('jid') ||
      searchParams.has('id') ||
      searchParams.has('req_id') ||
      searchParams.has('reqId') ||
      searchParams.has('requisition_id') ||
      searchParams.has('ashby_jid') ||
      searchParams.has('posting_id');

    // Check if domain root or generic careers path
    if (GENERIC_CAREERS_PATHS.includes(pathname) && !hasJobIdInQuery) {
      return {
        isSpecific: false,
        reason: `Generic careers landing page (${urlStr}) without a specific job ID.`,
      };
    }

    // Must have a job ID or specific role slug path
    const hasJobIdOrSlug =
      /\/(jobs?|positions?|openings?|roles?|postings?)\/[a-z0-9-_]+/i.test(pathname) ||
      hasJobIdInQuery ||
      /\b(intern|internship|trainee|siwes|engineer|developer)\b/i.test(pathname);

    if (!hasJobIdOrSlug) {
      return {
        isSpecific: false,
        reason: `URL does not contain a specific job identifier, posting slug, or job query param (${urlStr}).`,
      };
    }

    return { isSpecific: true };
  } catch {
    return { isSpecific: false, reason: `Invalid URL format (${urlStr})` };
  }
}

export async function runGroundedLagosSearch() {
  console.log('========================================================================================');
  console.log('STEP 4: GROUNDED SEARCH AUDIT (Targeting Lagos & Remote SWE Internships)');
  console.log('========================================================================================');

  const queries = [
    'software engineering internship summer 2027 remote open to Africa',
    'software engineering internship Lagos Nigeria 2027',
    'SIWES software engineering attachment Lagos 2026 2027',
    'Lagos Nigeria tech internship application 2027'
  ];

  console.log('Queries Used:');
  queries.forEach((q, i) => console.log(`  [Query ${i + 1}] "${q}"`));

  const rawResults: RawSearchResult[] = [];

  if (!apiKey) {
    console.warn('\nWarning: No GEMINI_API_KEY found in .env.local.');
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // 1. Try Gemini with Google Search tool if permitted
  for (const query of queries) {
    console.log(`\nExecuting grounded search query: "${query}"...`);
    try {
      const groundedModel = genAI.getGenerativeModel({
        model: 'gemini-3.5-flash',
        tools: [{ googleSearch: {} } as any],
      });

      const prompt = `Search the live web for active postings matching: "${query}".
Return a JSON array of discovered application or careers URLs:
[
  { "title": "Role Title", "url": "https://..." }
]
If none exist, return [].`;

      const res = await groundedModel.generateContent(prompt);
      const text = res.response.text();
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        for (const item of parsed) {
          if (!item.url) continue;
          const check = isSpecificJobPostingUrl(item.url);
          rawResults.push({
            query,
            title: item.title || 'SWE Intern',
            url: item.url,
            passesGate: check.isSpecific,
            rejectionReason: check.reason,
          });
        }
      }
    } catch (err: any) {
      console.warn(`Grounded search tool notice for query: ${err.message?.slice(0, 140)}`);
      // Fallback: Query knowledge extraction for ATS postings
      try {
        const standardModel = genAI.getGenerativeModel({ model: modelName });
        const fallbackPrompt = `For this query: "${query}", list any known specific early-careers / SIWES internship application URLs (e.g. on Greenhouse, Lever, Workable, or direct company portals in Nigeria).
Return a JSON array:
[
  { "title": "Title", "url": "https://..." }
]
If no specific job posting URL exists, return the company's public ATS URL (e.g. boards.greenhouse.io/moniepoint).`;

        const fallbackRes = await standardModel.generateContent(fallbackPrompt);
        const fbText = fallbackRes.response.text();
        const match = fbText.match(/\[[\s\S]*\]/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          for (const item of parsed) {
            if (!item.url) continue;
            const check = isSpecificJobPostingUrl(item.url);
            rawResults.push({
              query,
              title: item.title || 'SWE Intern',
              url: item.url,
              passesGate: check.isSpecific,
              rejectionReason: check.reason,
            });
          }
        }
      } catch (fbErr: any) {
        console.warn(`Fallback error: ${fbErr.message?.slice(0, 100)}`);
      }
    }
  }

  // Deduplicate results
  const seen = new Set<string>();
  const uniqueResults: RawSearchResult[] = [];
  for (const r of rawResults) {
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    uniqueResults.push(r);
  }

  const passedGate = uniqueResults.filter(r => r.passesGate);
  const failedGate = uniqueResults.filter(r => !r.passesGate);

  console.log(`\n========================================================================================`);
  console.log(`GROUNDED SEARCH RESULTS SUMMARY:`);
  console.log(`========================================================================================`);
  console.log(`- Total URLs returned across all queries : ${uniqueResults.length}`);
  console.log(`- URLs passing specific-posting-URL gate: ${passedGate.length}`);
  console.log(`- URLs failing specific-posting-URL gate: ${failedGate.length}`);

  if (passedGate.length === 0) {
    console.log(`\n⚠️ Notice: EXACTLY ZERO (0) URLs passed the specific-posting-URL gate.`);
    console.log(`All returned links were generic company careers pages, root ATS hubs, or university landing pages.`);
  }

  console.log(`\n10 SAMPLE URLS EVALUATED BY THE SPECIFIC-POSTING GATE:`);
  console.log(`----------------------------------------------------------------------------------------`);
  const sampleList = uniqueResults.slice(0, 10);
  sampleList.forEach((sample, i) => {
    console.log(`[SAMPLE ${i + 1}]`);
    console.log(`  Query   : "${sample.query}"`);
    console.log(`  Title   : ${sample.title}`);
    console.log(`  URL     : ${sample.url}`);
    console.log(`  Verdict : ${sample.passesGate ? '✅ PASSED (Specific Posting)' : '❌ REJECTED'}`);
    if (!sample.passesGate) {
      console.log(`  Reason  : ${sample.rejectionReason}`);
    }
    console.log('');
  });
  console.log(`========================================================================================\n`);

  return {
    queries,
    totalUrls: uniqueResults.length,
    passedCount: passedGate.length,
    failedCount: failedGate.length,
    samples: sampleList,
  };
}

if (require.main === module) {
  runGroundedLagosSearch();
}
