async function checkOverlap() {
  const jsonUrl = 'https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/.github/scripts/listings.json';
  const jRes = await fetch(jsonUrl, { headers: { 'User-Agent': 'InternshipFinder' } });
  const jsonData = await jRes.json();
  const urlsInJson = new Set(jsonData.map((d: any) => d.url));

  const offUrl = 'https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/README-Off-Season.md';
  const offRes = await fetch(offUrl, { headers: { 'User-Agent': 'InternshipFinder' } });
  const offText = await offRes.text();
  const offRows = offText.match(/<tr>[\s\S]*?<\/tr>/g) || [];

  let inJson = 0;
  let notInJson = 0;
  for (const row of offRows) {
    const linkMatch = row.match(/href="([^"]+)"/);
    if (linkMatch) {
      if (urlsInJson.has(linkMatch[1])) {
        inJson++;
      } else {
        notInJson++;
      }
    }
  }
  console.log('Off-season rows in listings.json:', inJson, 'not in listings.json:', notInJson);
}
checkOverlap();
