import {
  fetchGitHubCommunityInternshipList,
  stageAFilter,
  evaluateListingStrictRule,
  stageCHardGates,
} from './pipeline';

async function runStep1Audit() {
  console.log('================================================================');
  console.log('STEP 1 AUDIT: SimplifyJobs/Summer2027-Internships (dev branch)');
  console.log('================================================================');

  const startTime = Date.now();
  const rawListings = await fetchGitHubCommunityInternshipList();

  console.log(`\n1. FETCH RESULTS:`);
  console.log(`- Total raw rows fetched: ${rawListings.length}`);

  // Deduplication
  const seen = new Set<string>();
  const uniqueListings: typeof rawListings = [];
  let duplicates = 0;

  for (const item of rawListings) {
    const key = `${item.apply_url.toLowerCase().trim()}|${item.title.toLowerCase().trim()}`;
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    uniqueListings.push(item);
  }

  console.log(`- Duplicates found: ${duplicates}`);
  console.log(`- Unique listings to evaluate: ${uniqueListings.length}`);

  // Stage A Filtering
  let stageAPassedCount = 0;
  const stageARejections: Record<string, number> = {};
  const stageAPassedItems: typeof uniqueListings = [];

  for (const item of uniqueListings) {
    const resA = stageAFilter({
      title: item.title,
      company: item.company,
      apply_url: item.apply_url,
      location: item.location,
      source: item.source,
      description_snippet: item.description,
    });

    if (resA.passed) {
      stageAPassedCount++;
      stageAPassedItems.push(item);
    } else {
      const code = resA.reason_code || 'OTHER';
      stageARejections[code] = (stageARejections[code] || 0) + 1;
    }
  }

  console.log(`\n2. STAGE A FILTER RESULTS:`);
  console.log(`- Passed Stage A: ${stageAPassedCount}`);
  console.log(`- Rejected in Stage A: ${uniqueListings.length - stageAPassedCount}`);
  console.log(`- Rejection Breakdown:`);
  for (const [code, count] of Object.entries(stageARejections)) {
    console.log(`    • ${code.padEnd(30)}: ${count}`);
  }

  // Stage C Evaluation
  let verifiedCount = 0;
  let checkEligibilityCount = 0;
  let stageCRejectedCount = 0;
  const stageCRejections: Record<string, number> = {};
  const samplePassed: any[] = [];
  const sampleCheck: any[] = [];
  const sampleRejected: any[] = [];

  for (const item of stageAPassedItems) {
    const stageB = evaluateListingStrictRule({
      title: item.title,
      company: item.company,
      location: item.location,
      description: item.description,
    });

    const stageC = stageCHardGates(stageB);

    if (stageC.passed) {
      if (stageC.status === 'check_eligibility') {
        checkEligibilityCount++;
        if (sampleCheck.length < 5) {
          sampleCheck.push({ item, stageB, stageC });
        }
      } else {
        verifiedCount++;
        if (samplePassed.length < 5) {
          samplePassed.push({ item, stageB, stageC });
        }
      }
    } else {
      stageCRejectedCount++;
      const code = stageC.reason_code || 'OTHER';
      stageCRejections[code] = (stageCRejections[code] || 0) + 1;
      if (sampleRejected.length < 5) {
        sampleRejected.push({ item, stageB, stageC });
      }
    }
  }

  console.log(`\n3. STAGE C EVALUATION RESULTS (for this source only):`);
  console.log(`- Verified (Passed main feed): ${verifiedCount}`);
  console.log(`- Check Eligibility (Remote, unstated bounds): ${checkEligibilityCount}`);
  console.log(`- Rejected in Stage C: ${stageCRejectedCount}`);
  console.log(`- Stage C Rejection Breakdown:`);
  for (const [code, count] of Object.entries(stageCRejections)) {
    console.log(`    • ${code.padEnd(30)}: ${count}`);
  }

  if (sampleCheck.length > 0) {
    console.log(`\nSample Check Eligibility Listings (${sampleCheck.length}):`);
    sampleCheck.forEach(({ item, stageB }) => {
      console.log(`  - [${item.company}] ${item.title}`);
      console.log(`    Location: ${item.location} | Work Mode: ${stageB.work_mode}`);
      console.log(`    URL: ${item.apply_url}`);
    });
  }

  if (samplePassed.length > 0) {
    console.log(`\nSample Verified Listings (${samplePassed.length}):`);
    samplePassed.forEach(({ item, stageB }) => {
      console.log(`  - [${item.company}] ${item.title}`);
      console.log(`    Location: ${item.location} | Work Mode: ${stageB.work_mode}`);
      console.log(`    URL: ${item.apply_url}`);
    });
  }

  console.log(`\nAudit completed in ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
  console.log('================================================================');
}

runStep1Audit();

