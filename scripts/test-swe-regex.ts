import fs from 'fs';
import path from 'path';

const sweRegex = /\b(software|engineer|engineering|developer|programmer|coder|frontend|front-end|backend|fullstack|full-stack|web|mobile|android|ios|qa|devops|sre|cloud|systems|infrastructure|firmware|embedded|gameplay|graphics|machine learning|deep learning|\bml\b|\bai\b|artificial intelligence|agentic|genai|generative ai|\bllm\b|\bnlp\b|computer vision|data engineer|data engineering|data science|data scientist|security|cybersecurity|infosec|appsec)\b/i;
const nonSweRegex = /\b(sales|marketing|collections|\bagent\b|customer support|customer service|customer care|recruiter|talent acquisition|human resources|\bhr\b|legal|accounting|finance|teller|driver|warehouse|pharmacist|pharmacy|nursing|nurse|medical|operations associate|gis analyst|data analyst|data analytics|business analyst)\b/i;

function testRegex() {
  // Test false positive edge cases
  const falsePositives = [
    'Email Marketing Intern',
    'Customer Care & Detail Intern',
    'Maintainability Specialist Intern',
    'Financial Analyst Intern',
    'Data Analyst Intern',
  ];

  console.log('--- Testing False Positive Rejections ---');
  for (const t of falsePositives) {
    const isSwe = sweRegex.test(t.toLowerCase()) && !nonSweRegex.test(t.toLowerCase());
    console.log(`"${t}" => is_swe: ${isSwe} (Expected: false)`);
  }

  // Test true positive technical SWE edge cases
  const truePositives = [
    'Agentic AI Engineer Co-op',
    'Machine Learning Intern',
    'Data Science Intern',
    'Gameplay Programmer Intern',
    'Cloud Security Intern',
    'Full Stack Developer Intern',
    'Software Engineer Intern',
  ];

  console.log('\n--- Testing True Positive Acceptances ---');
  for (const t of truePositives) {
    const isSwe = sweRegex.test(t.toLowerCase()) && !nonSweRegex.test(t.toLowerCase());
    console.log(`"${t}" => is_swe: ${isSwe} (Expected: true)`);
  }

  // Load rejected and listings from data folder to pull real titles accepted as SWE from previous run
  const rejected = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'rejected.json'), 'utf8'));
  const listings = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'listings.json'), 'utf8'));

  // Get items that passed Stage A and were accepted as SWE (i.e. not rejected for NOT_SOFTWARE_ENGINEERING)
  const sweAccepted = [];

  for (const item of listings) {
    if (sweRegex.test(item.title.toLowerCase()) && !nonSweRegex.test(item.title.toLowerCase())) {
      sweAccepted.push({ company: item.company, title: item.title, source: item.source });
    }
  }

  for (const item of rejected) {
    // Roles rejected for REGION_LOCKED or NOT_OPEN_TO_NIGERIA passed the SWE gate!
    if (item.reason_code === 'REGION_LOCKED' || item.reason_code === 'NOT_OPEN_TO_NIGERIA') {
      if (sweRegex.test(item.title.toLowerCase()) && !nonSweRegex.test(item.title.toLowerCase())) {
        sweAccepted.push({ company: item.company, title: item.title, source: item.source });
      }
    }
  }

  console.log(`\nFound ${sweAccepted.length} real roles that passed SWE gate.`);
  console.log('\n10 Sample Accepted-as-SWE Titles:');
  const step = Math.max(1, Math.floor(sweAccepted.length / 10));
  const samples = [];
  for (let i = 0; i < sweAccepted.length && samples.length < 10; i += step) {
    samples.push(sweAccepted[i]);
  }

  samples.forEach((s, idx) => {
    console.log(`  ${idx + 1}. [${s.company}] "${s.title}" (${s.source})`);
  });
}

testRegex();

