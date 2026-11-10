import fs from 'fs';
import path from 'path';

interface RejectedItem {
  title: string;
  company: string;
  url: string;
  source: string;
  location: string;
  reason_code: string;
  reason: string;
  snippet?: string;
  rejected_at: string;
  quote?: string;
}

interface ListingItem {
  id: string;
  source: string;
  company: string;
  title: string;
  location: string;
  apply_url: string;
  evidence?: {
    work_mode_quote?: string;
    nigeria_eligibility_quote?: string;
  };
}

function runReport() {
  const meta = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/meta.json'), 'utf8'));
  const rejected: RejectedItem[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/rejected.json'), 'utf8'));
  const listings: ListingItem[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/listings.json'), 'utf8'));
  const checkEligibility: ListingItem[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/check_eligibility.json'), 'utf8'));

  console.log('========================================================================');
  console.log('STAGE FUNNEL REPORT PER SOURCE');
  console.log('========================================================================');

  // Group rejections by source
  const rejectedBySource: Record<string, { total: number; reasons: Record<string, number> }> = {};
  for (const item of rejected) {
    const src = item.source || 'unknown';
    if (!rejectedBySource[src]) {
      rejectedBySource[src] = { total: 0, reasons: {} };
    }
    rejectedBySource[src].total++;
    const code = item.reason_code || 'OTHER';
    rejectedBySource[src].reasons[code] = (rejectedBySource[src].reasons[code] || 0) + 1;
  }

  // Group listings by source
  const listingsBySource: Record<string, number> = {};
  for (const item of listings) {
    const src = item.source || 'unknown';
    listingsBySource[src] = (listingsBySource[src] || 0) + 1;
  }

  // Group check eligibility by source
  const checkEligibilityBySource: Record<string, number> = {};
  for (const item of checkEligibility) {
    const src = item.source || 'unknown';
    checkEligibilityBySource[src] = (checkEligibilityBySource[src] || 0) + 1;
  }

  const allSources = Object.keys(meta.sources);

  console.log(
    'Source'.padEnd(25) +
    'Fetched'.padStart(10) +
    'Stage A Pass'.padStart(14) +
    'Verified'.padStart(10) +
    'Check Elig.'.padStart(13) +
    'Rejected'.padStart(10)
  );
  console.log('-'.repeat(82));

  for (const src of allSources) {
    const fetched = meta.sources[src]?.count || 0;
    const rej = rejectedBySource[src]?.total || 0;
    const ver = listingsBySource[src] || 0;
    const chk = checkEligibilityBySource[src] || 0;
    // Stage A passed for this source = ver + chk + (any rejected in stage C for this source)
    // Stage C rejections have reason_codes: REGION_LOCKED, NOT_INTERNSHIP, NOT_SOFTWARE_ENGINEERING, NOT_OPEN_TO_NIGERIA, etc.
    const stageCRej = Object.entries(rejectedBySource[src]?.reasons || {})
      .filter(([code]) => ['REGION_LOCKED', 'NOT_INTERNSHIP', 'NOT_SOFTWARE_ENGINEERING', 'NOT_OPEN_TO_NIGERIA', 'WRONG_SEASON_OR_YEAR', 'ADVANCED_DEGREE_REQUIRED'].includes(code))
      .reduce((sum, [, count]) => sum + count, 0);

    const stageAPassed = ver + chk + stageCRej;

    console.log(
      src.padEnd(25) +
      fetched.toString().padStart(10) +
      stageAPassed.toString().padStart(14) +
      ver.toString().padStart(10) +
      chk.toString().padStart(13) +
      rej.toString().padStart(10)
    );
  }

  console.log('='.repeat(82));
  console.log(`TOTALS: Fetched: ${meta.total_listings_fetched} | Stage A Passed: ${meta.stage_a_passed} | Verified: ${meta.stage_c_passed} | Check Elig: ${meta.check_eligibility_count} | Rejected: ${meta.total_rejected}`);
  console.log('\n========================================================================');
  console.log('REJECTION BREAKDOWN ACROSS ALL SOURCES');
  console.log('========================================================================');
  for (const [code, count] of Object.entries(meta.rejected_counts)) {
    console.log(`  - ${code.padEnd(30)} : ${count}`);
  }

  console.log('\n========================================================================');
  console.log('10 RANDOM REJECTED REGION_LOCKED ROLES WITH EXACT TRIGGER PHRASE');
  console.log('========================================================================');

  const regionLocked = rejected.filter(r => r.reason_code === 'REGION_LOCKED');
  console.log(`Found ${regionLocked.length} total REGION_LOCKED rejections.\n`);

  // Pick up to 10 representative samples (using pseudo-random seed or deterministic spread)
  const step = Math.max(1, Math.floor(regionLocked.length / 10));
  const samples = [];
  for (let i = 0; i < regionLocked.length && samples.length < 10; i += step) {
    samples.push(regionLocked[i]);
  }

  samples.forEach((sample, idx) => {
    console.log(`[SAMPLE ${idx + 1}]`);
    console.log(`  Company       : ${sample.company}`);
    console.log(`  Title         : ${sample.title}`);
    console.log(`  Source        : ${sample.source}`);
    console.log(`  Location      : ${sample.location || 'Remote (unspecified)'}`);
    console.log(`  Apply URL     : ${sample.url}`);
    console.log(`  Rejection Note: ${sample.reason}`);
    if (sample.snippet) {
      // Clean up snippet to find the exact trigger phrase
      const cleanSnippet = sample.snippet.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      console.log(`  Posting Snippet: "${cleanSnippet.slice(0, 180)}..."`);
    }
    console.log('');
  });
}

runReport();
