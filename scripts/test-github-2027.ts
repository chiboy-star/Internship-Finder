import { hashString } from './pipeline';

async function testGitHub2027() {
  const listings: Array<any> = [];

  // 1. Fetch machine-readable listings.json
  const jsonUrl = 'https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/.github/scripts/listings.json';
  console.log(`Fetching machine-readable listings.json from ${jsonUrl}...`);
  try {
    const res = await fetch(jsonUrl, {
      headers: { 'User-Agent': 'InternshipFinder/2.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`Found machine-readable listings.json with ${data.length} total entries.`);
      // Take active & visible listings
      const activeListings = data.filter((item: any) => item.active !== false && item.is_visible !== false);
      console.log(`Active & visible entries: ${activeListings.length}`);

      for (const item of activeListings) {
        const company = item.company_name?.trim();
        const role = item.title?.trim();
        const applyUrl = item.url?.trim();
        const loc = Array.isArray(item.locations) ? item.locations.join(', ') : (item.locations || 'Remote');
        const terms = Array.isArray(item.terms) ? item.terms.join(', ') : (item.terms || '');

        if (!company || !role || !applyUrl) continue;

        listings.push({
          source: 'github-community',
          external_id: `ghc_${hashString(company + role + applyUrl)}`,
          company,
          title: role,
          location: loc || 'Remote',
          apply_url: applyUrl,
          source_url: jsonUrl,
          description: `Internship opportunity at ${company}. Role: ${role}. Locations: ${loc}. Terms: ${terms}. Sponsorship: ${item.sponsorship || 'None'}.`,
        });
      }
    } else {
      console.warn(`Failed to fetch listings.json: HTTP ${res.status}`);
    }
  } catch (e: any) {
    console.warn(`Error fetching listings.json:`, e.message);
  }

  // 2. Fetch and parse off-season 2027 README
  const offUrl = 'https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/README-Off-Season.md';
  console.log(`Fetching off-season 2027 README from ${offUrl}...`);
  try {
    const res = await fetch(offUrl, {
      headers: { 'User-Agent': 'InternshipFinder/2.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const text = await res.text();
      const rowMatches = text.match(/<tr>[\s\S]*?<\/tr>/g) || [];
      console.log(`Found ${rowMatches.length} HTML table rows in README-Off-Season.md`);
      let parsedOffSeason = 0;

      for (const row of rowMatches) {
        const cells = row.match(/<td[\s\S]*?<\/td>/g);
        if (!cells || cells.length < 4) continue;

        const company = cells[0].replace(/<[^>]+>/g, '').replace(/[\u{1F300}-\u{1F9FF}]|🔥|🎓|💻/gu, '').trim();
        const role = cells[1].replace(/<[^>]+>/g, '').replace(/[\u{1F300}-\u{1F9FF}]|🔥|🎓|💻/gu, '').trim();
        const location = cells[2]
          .replace(/<details>[\s\S]*?<\/summary>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        // Application link might be in cells[3] (if 4 cells) or cells[4] (if 5 or 6 cells)
        const appCell = cells.length >= 5 ? cells[4] : cells[3];
        const linkMatch = appCell.match(/href="([^"]+)"/);
        const applyUrl = linkMatch ? linkMatch[1] : '';

        const terms = cells.length >= 5 ? cells[3].replace(/<[^>]+>/g, '').trim() : '';

        if (!company || !role || !applyUrl) continue;

        listings.push({
          source: 'github-community',
          external_id: `ghc_${hashString(company + role + applyUrl)}`,
          company,
          title: role,
          location: location || 'Remote',
          apply_url: applyUrl,
          source_url: offUrl,
          description: `Off-season internship opportunity at ${company}. Role: ${role}. Location: ${location}. Terms: ${terms}.`,
        });
        parsedOffSeason++;
      }
      console.log(`Successfully parsed ${parsedOffSeason} rows from README-Off-Season.md`);
    } else {
      console.warn(`Failed to fetch README-Off-Season.md: HTTP ${res.status}`);
    }
  } catch (e: any) {
    console.warn(`Error fetching README-Off-Season.md:`, e.message);
  }

  console.log(`\n======================================================`);
  console.log(`Total raw listings fetched from Summer 2027 source: ${listings.length}`);

  // Deduplicate by URL & normalized title
  const seenUrls = new Set<string>();
  const uniqueListings: typeof listings = [];
  let duplicates = 0;
  for (const item of listings) {
    const key = `${item.apply_url.toLowerCase().trim()}|${item.title.toLowerCase().trim()}`;
    if (seenUrls.has(key)) {
      duplicates++;
      continue;
    }
    seenUrls.add(key);
    uniqueListings.push(item);
  }
  console.log(`Duplicates: ${duplicates} | Unique listings: ${uniqueListings.length}`);

  return { listings, uniqueListings };
}

testGitHub2027();
