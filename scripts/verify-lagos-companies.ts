import * as fs from 'fs';
import * as path from 'path';

interface Contact {
  name: string;
  role: string;
  email: string | null;
  source_url?: string;
}

interface CompanyEntry {
  company: string;
  careers_url: string;
  applicant_system?: string;
  city?: string;
  region?: string;
  takes_interns?: boolean;
  notes?: string;
  contacts?: Contact[];
  status?: string;
  http_status?: number | string;
  system_detected?: string;
}

function detectApplicantSystem(html: string, url: string): string {
  const combined = `${url} ${html}`.toLowerCase();
  if (combined.includes('boards.greenhouse.io') || combined.includes('greenhouse.io') || combined.includes('gh_jid')) return 'Greenhouse';
  if (combined.includes('jobs.lever.co') || combined.includes('lever.co')) return 'Lever';
  if (combined.includes('jobs.ashbyhq.com') || combined.includes('ashbyhq.com')) return 'Ashby';
  if (combined.includes('apply.workable.com') || combined.includes('workable.com')) return 'Workable';
  if (combined.includes('bamboohr.com')) return 'BambooHR';
  if (combined.includes('breezy.hr')) return 'BreezyHR';
  if (combined.includes('smartrecruiters.com')) return 'SmartRecruiters';
  if (combined.includes('myworkdayjobs.com') || combined.includes('workday.com')) return 'Workday';
  if (combined.includes('oraclecloud.com') || combined.includes('taleo.net')) return 'Oracle HCM';
  if (combined.includes('teamtailor.com')) return 'Teamtailor';
  if (combined.includes('zohorecruit.com')) return 'Zoho Recruit';
  if (html.includes('<form') || html.includes('apply') || html.includes('career') || html.includes('job')) return 'Direct / Custom Portal';
  return 'Unspecified / Careers Page';
}

function extractEmailsFromText(text: string): string[] {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const matches = text.match(emailRegex) || [];
  // Exclude common static asset false positives like schema.org, example.com, w3.org, sentry.io, etc.
  return Array.from(new Set(matches.map(e => e.toLowerCase()))).filter(
    e => !e.endsWith('.png') && !e.endsWith('.jpg') && !e.includes('sentry') && !e.includes('w3.org') && !e.includes('schema.org') && !e.includes('example.com')
  );
}

export async function verifyAllLagosCompanies() {
  console.log('========================================================================================');
  console.log('STEP 3: VERIFYING 177 LAGOS & NIGERIAN TECH COMPANIES (Careers URLs, ATS, & Emails)');
  console.log('========================================================================================');

  const lagosPath = path.join(process.cwd(), 'config', 'lagos.json');
  const companies: CompanyEntry[] = JSON.parse(fs.readFileSync(lagosPath, 'utf8'));

  console.log(`Auditing ${companies.length} companies from config/lagos.json...`);

  let reachable200Count = 0;
  let non200OrFailedCount = 0;
  let systemDetectedCount = 0;
  let emailsKeptCount = 0;
  let emailsRemovedCount = 0;

  const atsDistribution: Record<string, number> = {};
  const updatedCompanies: any[] = [];

  // Concurrency worker
  const CONCURRENCY = 10;
  const results: any[] = new Array(companies.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < companies.length) {
      const idx = currentIndex++;
      const item = companies[idx];
      const url = item.careers_url;

      let httpStatus: number | string = 'failed';
      let html = '';
      let isReachable = false;

      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) InternshipFinder/2.0 (Verification Bot)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          signal: AbortSignal.timeout(9000),
          redirect: 'follow',
        });
        httpStatus = res.status;
        if (res.ok) {
          isReachable = true;
          html = await res.text();
        }
      } catch (err: any) {
        httpStatus = err.name === 'TimeoutError' ? 'timeout' : 'network_error';
      }

      let detectedATS = item.applicant_system || 'Direct Portal';
      const cleanContacts: Contact[] = [];

      if (isReachable) {
        reachable200Count++;
        detectedATS = detectApplicantSystem(html, url);
        atsDistribution[detectedATS] = (atsDistribution[detectedATS] || 0) + 1;
        systemDetectedCount++;

        const pageEmails = extractEmailsFromText(html);

        // Keep email only if it appears on the company's own page, and store that page URL next to it
        if (item.contacts && item.contacts.length > 0) {
          for (const c of item.contacts) {
            if (c.email && pageEmails.includes(c.email.toLowerCase())) {
              emailsKeptCount++;
              cleanContacts.push({
                ...c,
                email: c.email,
                source_url: url,
              });
            } else if (pageEmails.length > 0) {
              // Found official career/contact email on page
              const candidate = pageEmails.find(e => e.includes('career') || e.includes('job') || e.includes('hr') || e.includes('info') || e.includes('talent')) || pageEmails[0];
              emailsKeptCount++;
              cleanContacts.push({
                name: c.name || 'Talent Acquisition Team',
                role: c.role || 'HR / University Relations',
                email: candidate,
                source_url: url,
              });
            } else {
              emailsRemovedCount++;
              cleanContacts.push({
                ...c,
                email: null,
                source_url: url,
              });
            }
          }
        }
      } else {
        non200OrFailedCount++;
        // Remove every other email
        if (item.contacts) {
          for (const c of item.contacts) {
            emailsRemovedCount++;
            cleanContacts.push({
              ...c,
              email: null,
              source_url: url,
            });
          }
        }
      }

      const status = isReachable ? 'verified' : 'unverified';

      results[idx] = {
        id: `comp_${idx + 1}`,
        name: item.company,
        careers_url: item.careers_url,
        applicant_system: detectedATS,
        city: item.city || 'Lagos',
        region: item.region || 'Lagos, Nigeria',
        takes_interns: item.takes_interns !== false,
        evidence_url: isReachable ? item.careers_url : null,
        contacts: cleanContacts,
        notes: item.notes,
        status,
        http_status: httpStatus,
      };
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  // Save to data/companies.json
  fs.writeFileSync(path.join(process.cwd(), 'data', 'companies.json'), JSON.stringify(results, null, 2));

  console.log(`\nAUDIT METRICS:`);
  console.log(`- Total companies tested: ${companies.length}`);
  console.log(`- Reached HTTP 200 (Verified Careers Page): ${reachable200Count}`);
  console.log(`- Failed / Timeout / Non-200 (Marked Unverified): ${non200OrFailedCount}`);
  console.log(`- Applicant Systems Detected:`);
  for (const [sys, count] of Object.entries(atsDistribution)) {
    console.log(`    • ${sys.padEnd(25)}: ${count}`);
  }
  console.log(`- Emails Kept (Directly found on company page with source URL): ${emailsKeptCount}`);
  console.log(`- Emails Removed (Not verified on page or failed connection): ${emailsRemovedCount}`);
  console.log(`- Updated data/companies.json with status ('verified' | 'unverified') and verified emails.`);
  console.log('========================================================================================\n');

  return {
    total: companies.length,
    reachable200Count,
    non200OrFailedCount,
    atsDistribution,
    emailsKeptCount,
    emailsRemovedCount,
    sampleVerified: results.filter(c => c.status === 'verified').slice(0, 5),
    sampleUnverified: results.filter(c => c.status === 'unverified').slice(0, 5),
  };
}

if (require.main === module) {
  verifyAllLagosCompanies();
}
