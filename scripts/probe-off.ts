async function inspectOffSeasonHtml() {
  const offUrl = 'https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/README-Off-Season.md';
  const offRes = await fetch(offUrl, { headers: { 'User-Agent': 'InternshipFinder' } });
  const text = await offRes.text();
  const rowMatches = text.match(/<tr>[\s\S]*?<\/tr>/g) || [];
  console.log('Total rows:', rowMatches.length);
  for (let i = 0; i < Math.min(5, rowMatches.length); i++) {
    console.log(`--- ROW ${i} ---`);
    console.log(rowMatches[i]);
  }
}
inspectOffSeasonHtml();

