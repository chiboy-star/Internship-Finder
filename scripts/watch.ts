import { runPipeline } from './pipeline';

const INTERVAL_HOURS = 6;
const INTERVAL_MS = INTERVAL_HOURS * 60 * 60 * 1000;

console.log(`⏱️ Internship Finder Pipeline Watcher initialized.`);
console.log(`Will run every ${INTERVAL_HOURS} hours while this computer and terminal remain active.`);

async function cycle() {
  try {
    console.log(`\n[${new Date().toLocaleTimeString()}] Triggering scheduled pipeline run...`);
    await runPipeline();
  } catch (err: any) {
    console.error('Error during scheduled pipeline run:', err?.message || err);
  }
}

// Initial run
cycle();

// Set interval
setInterval(cycle, INTERVAL_MS);

