import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface Company {
  id: string;
  name: string;
  careers_url: string;
  city: string;
  region: string;
  takes_interns: boolean | 'unknown';
  evidence_url?: string;
  contacts: any[];
  notes?: string;
  status?: string;
  http_status?: number | string;
  applicant_system?: string;
  watching_status?: 'watching' | 'manual check' | 'unverified';
  last_change_seen?: string;
  alert_count?: number;
}

interface Snapshot {
  company: string;
  careers_url: string;
  content_hash: string;
  job_links: string[];
  text_sample: string;
  http_status: number | string;
  last_checked: string;
  last_change_seen: string;
}

interface WatcherAlert {
  id: string;
  company: string;
  careers_url: string;
  matching_text: string;
  job_url: string;
  detected_at: string;
  status: 'new' | 'reviewed';
}

function hashContent(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

const INTERN_REGEX = /\b(intern|interns|internship|internships|siwes|industrial attachment|attachment|student trainee|student intern|trainee)\b/i;

export async function runCareersWatcher() {
  console.log('========================================================================================');
  console.log('STEP C: CAREERS-PAGE WATCHER (Polite Snapshotting, Diffing & Keyword Alerts)');
  console.log('========================================================================================');

  const dataDir = path.join(process.cwd(), 'data');
  const companiesPath = path.join(dataDir, 'companies.json');
  const snapshotsPath = path.join(dataDir, 'watcher_snapshots.json');
  const alertsPath = path.join(dataDir, 'alerts.json');

  const companies: Company[] = fs.existsSync(companiesPath)
    ? JSON.parse(fs.readFileSync(companiesPath, 'utf8'))
    : [];

  const previousSnapshots: Record<string, Snapshot> = fs.existsSync(snapshotsPath)
    ? JSON.parse(fs.readFileSync(snapshotsPath, 'utf8'))
    : {};

  const existingAlerts: WatcherAlert[] = fs.existsSync(alertsPath)
    ? JSON.parse(fs.readFileSync(alertsPath, 'utf8'))
    : [];

  const newSnapshots: Record<string, Snapshot> = { ...previousSnapshots };
  const newAlerts: WatcherAlert[] = [...existingAlerts];
  const alertIds = new Set(existingAlerts.map(a => a.id));

  let watchingCount = 0;
  let manualCheckCount = 0;
  let unverifiedCount = 0;
  let newAlertCount = 0;

  const CONCURRENCY = 10;
  let currentIndex = 0;

  console.log(`Watching ${companies.length} companies from data/companies.json...`);

  async function worker() {
    while (currentIndex < companies.length) {
      const idx = currentIndex++;
      const company = companies[idx];
      const url = company.careers_url;

      if (!url) {
        company.watching_status = 'unverified';
        unverifiedCount++;
        continue;
      }

      let httpStatus: number | string = 'failed';
      let html = '';
      let isReachable = false;
      let is403 = false;

      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) InternshipFinder/2.0 (Polite Careers Page Watcher; contact: chinemerem.madueke@pau.edu.ng)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          signal: AbortSignal.timeout(9000),
          redirect: 'follow',
        });
        httpStatus = res.status;
        if (res.status === 403) {
          is403 = true;
        } else if (res.ok) {
          isReachable = true;
          html = await res.text();
        }
      } catch (err: any) {
        httpStatus = err.name === 'TimeoutError' ? 'timeout' : 'network_error';
      }

      const now = new Date().toISOString();
      const prev = previousSnapshots[company.name];

      if (is403) {
        company.watching_status = 'manual check';
        company.http_status = 403;
        manualCheckCount++;

        newSnapshots[company.name] = {
          company: company.name,
          careers_url: url,
          content_hash: prev ? prev.content_hash : 'status_403',
          job_links: prev ? prev.job_links : [],
          text_sample: '403 Forbidden - Marked for manual review',
          http_status: 403,
          last_checked: now,
          last_change_seen: prev ? prev.last_change_seen : 'Access restricted (403 Forbidden)',
        };
        company.last_change_seen = newSnapshots[company.name].last_change_seen;
        continue;
      }

      if (!isReachable) {
        company.watching_status = 'unverified';
        company.http_status = httpStatus;
        unverifiedCount++;

        newSnapshots[company.name] = {
          company: company.name,
          careers_url: url,
          content_hash: prev ? prev.content_hash : 'unreachable',
          job_links: prev ? prev.job_links : [],
          text_sample: `Connection ${httpStatus}`,
          http_status: httpStatus,
          last_checked: now,
          last_change_seen: prev ? prev.last_change_seen : 'Unreachable / connection error',
        };
        company.last_change_seen = newSnapshots[company.name].last_change_seen;
        continue;
      }

      // Reached HTTP 200
      watchingCount++;
      company.watching_status = 'watching';
      company.http_status = 200;

      // Extract job links and readable text
      const linkMatches = Array.from(html.matchAll(/href="([^"]+)"/g)).map(m => m[1]);
      const jobLinks = Array.from(new Set(
        linkMatches.filter(href =>
          href.includes('job') ||
          href.includes('career') ||
          href.includes('position') ||
          href.includes('greenhouse') ||
          href.includes('lever') ||
          href.includes('workable') ||
          href.includes('bamboohr') ||
          href.includes('ashby')
        )
      )).slice(0, 50);

      const cleanText = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const contentHash = hashContent(cleanText + jobLinks.join('|'));
      let lastChangeSeen = prev ? prev.last_change_seen : 'Initial snapshot captured';

      // Compare with previous snapshot
      if (prev && prev.content_hash !== contentHash) {
        // Difference detected
        lastChangeSeen = `${now.split('T')[0]} (Page modified)`;

        // Identify new links
        const prevLinks = new Set(prev.job_links || []);
        const newLinks = jobLinks.filter(l => !prevLinks.has(l));

        // Check for new intern links or new intern text
        let foundMatch = false;
        for (const link of newLinks) {
          if (INTERN_REGEX.test(link)) {
            foundMatch = true;
            const alertId = `alert_${hashContent(company.name + link)}`;
            if (!alertIds.has(alertId)) {
              alertIds.add(alertId);
              newAlertCount++;
              newAlerts.push({
                id: alertId,
                company: company.name,
                careers_url: url,
                matching_text: `New early-careers job link posted: ${link}`,
                job_url: link.startsWith('http') ? link : new URL(link, url).toString(),
                detected_at: now,
                status: 'new',
              });
            }
          }
        }

        // Check clean text for intern mentions
        const textDiffSentences = cleanText.split(/(?<=[.?!])\s+/);
        for (const sentence of textDiffSentences) {
          if (INTERN_REGEX.test(sentence) && sentence.length < 200) {
            const alertId = `alert_${hashContent(company.name + sentence)}`;
            if (!alertIds.has(alertId)) {
              alertIds.add(alertId);
              newAlertCount++;
              newAlerts.push({
                id: alertId,
                company: company.name,
                careers_url: url,
                matching_text: sentence.trim(),
                job_url: url,
                detected_at: now,
                status: 'new',
              });
            }
            break;
          }
        }
      } else if (!prev) {
        // First run: check if existing page has active intern keywords
        const sentences = cleanText.split(/(?<=[.?!])\s+/);
        const matchSentence = sentences.find(s => INTERN_REGEX.test(s) && s.length < 200);
        if (matchSentence) {
          const alertId = `alert_${hashContent(company.name + matchSentence)}`;
          if (!alertIds.has(alertId)) {
            alertIds.add(alertId);
            newAlertCount++;
            newAlerts.push({
              id: alertId,
              company: company.name,
              careers_url: url,
              matching_text: matchSentence.trim(),
              job_url: url,
              detected_at: now,
              status: 'new',
            });
          }
        }
      }

      company.last_change_seen = lastChangeSeen;
      company.alert_count = newAlerts.filter(a => a.company === company.name).length;

      newSnapshots[company.name] = {
        company: company.name,
        careers_url: url,
        content_hash: contentHash,
        job_links: jobLinks,
        text_sample: cleanText.slice(0, 300),
        http_status: 200,
        last_checked: now,
        last_change_seen: lastChangeSeen,
      };
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  // Write updated files
  fs.writeFileSync(snapshotsPath, JSON.stringify(newSnapshots, null, 2));
  fs.writeFileSync(alertsPath, JSON.stringify(newAlerts, null, 2));
  fs.writeFileSync(companiesPath, JSON.stringify(companies, null, 2));

  console.log('\n========================================================================================');
  console.log('CAREERS WATCHER RUN RESULTS:');
  console.log('========================================================================================');
  console.log(`- Total Companies Audited      : ${companies.length}`);
  console.log(`- Actively Watched (HTTP 200)  : ${watchingCount}`);
  console.log(`- Marked "Manual Check" (403)  : ${manualCheckCount}`);
  console.log(`- Unverified / Connection Error: ${unverifiedCount}`);
  console.log(`- Total Alerts Stored          : ${newAlerts.length} (${newAlertCount} detected in this run)`);

  console.log('\nSample Companies in "Watching" State with Last Change Seen:');
  const sampleWatching = companies.filter(c => c.watching_status === 'watching').slice(0, 5);
  sampleWatching.forEach((c, idx) => {
    console.log(`  ${idx + 1}. [${c.name}] Careers: ${c.careers_url}`);
    console.log(`     Last Change: ${c.last_change_seen} | Alerts: ${c.alert_count || 0}`);
  });

  console.log('\nSample Companies Marked "Manual Check" (403 Forbidden):');
  const sample403 = companies.filter(c => c.watching_status === 'manual check').slice(0, 5);
  sample403.forEach((c, idx) => {
    console.log(`  ${idx + 1}. [${c.name}] Careers: ${c.careers_url} (HTTP 403 Forbidden - Manual check)`);
  });

  if (newAlerts.length > 0) {
    console.log('\nActive Internship Alerts Detected on Watched Pages:');
    newAlerts.slice(0, 5).forEach((a, idx) => {
      console.log(`  [Alert ${idx + 1}] Company: ${a.company}`);
      console.log(`    Snippet : "${a.matching_text}"`);
      console.log(`    Link    : ${a.job_url}`);
    });
  }
  console.log('========================================================================================\n');

  return {
    total: companies.length,
    watchingCount,
    manualCheckCount,
    unverifiedCount,
    totalAlerts: newAlerts.length,
    sampleWatching,
    sample403,
    sampleAlerts: newAlerts.slice(0, 5),
  };
}

if (require.main === module) {
  runCareersWatcher();
}

