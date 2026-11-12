import {
  fetchGitHubCommunityInternshipList,
  stageAFilter,
  evaluateListingStrictRule,
  stageCHardGates,
} from './pipeline';

async function auditFeedback() {
  console.log('Fetching GitHub Community listings...');
  const rawListings = await fetchGitHubCommunityInternshipList();

  // Deduplicate
  const seen = new Set<string>();
  const uniqueListings: typeof rawListings = [];
  for (const item of rawListings) {
    const key = `${item.apply_url.toLowerCase().trim()}|${item.title.toLowerCase().trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueListings.push(item);
  }

  // Stage A
  const stageAPassed: typeof uniqueListings = [];
  const genericCareersPages: typeof uniqueListings = [];

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
      stageAPassed.push(item);
    } else if (resA.reason_code === 'GENERIC_CAREERS_PAGE') {
      genericCareersPages.push(item);
    }
  }

  console.log(`\n======================================================`);
  console.log(`1. 10 RANDOM GENERIC_CAREERS_PAGE REJECTIONS (Total: ${genericCareersPages.length})`);
  console.log(`======================================================`);
  const step = Math.max(1, Math.floor(genericCareersPages.length / 10));
  const sampleGeneric = [];
  for (let i = 0; i < genericCareersPages.length && sampleGeneric.length < 10; i += step) {
    sampleGeneric.push(genericCareersPages[i]);
  }

  sampleGeneric.forEach((item, idx) => {
    console.log(`[SAMPLE ${idx + 1}]`);
    console.log(`  Company   : ${item.company}`);
    console.log(`  Title     : ${item.title}`);
    console.log(`  Apply URL : ${item.apply_url}`);
    console.log(`  Location  : ${item.location}`);
  });

  // Stage C
  const notSweTitles: Array<{ company: string; title: string; location: string; url: string }> = [];

  for (const item of stageAPassed) {
    const stageB = evaluateListingStrictRule({
      title: item.title,
      company: item.company,
      location: item.location,
      description: item.description,
    });

    const stageC = stageCHardGates(stageB);
    if (!stageC.passed && stageC.reason_code === 'NOT_SOFTWARE_ENGINEERING') {
      notSweTitles.push({
        company: item.company,
        title: item.title,
        location: item.location,
        url: item.apply_url,
      });
    }
  }

  console.log(`\n======================================================`);
  console.log(`2. NOT_SOFTWARE_ENGINEERING TITLES (Total: ${notSweTitles.length})`);
  console.log(`======================================================`);
  notSweTitles.forEach((item, idx) => {
    console.log(`  ${(idx + 1).toString().padStart(2)}. [${item.company}] ${item.title} (${item.location})`);
  });
}

auditFeedback();
