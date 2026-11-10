import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import { UserProfile } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyName, companyContext, specificDetail, chosenProject, passphrase } = body;

    // Passphrase validation
    const expectedPassphrase = process.env.APP_PASSPHRASE;
    if (expectedPassphrase) {
      const providedPassphrase = req.headers.get('x-app-passphrase') || passphrase;
      if (!providedPassphrase || providedPassphrase !== expectedPassphrase) {
        return NextResponse.json(
          { error: 'Invalid or missing passphrase. Quota is protected by passphrase gate.' },
          { status: 401 }
        );
      }
    }

    if (!companyName) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    }

    // Load profile
    const profilePath = path.join(process.cwd(), 'config', 'profile.json');
    const profile: UserProfile = fs.existsSync(profilePath)
      ? JSON.parse(fs.readFileSync(profilePath, 'utf-8'))
      : {
          name: 'Chinemerem Madueke',
          stage: '3rd year B.Sc. Software Engineering, Pan Atlantic University, Nigeria',
          core_skills: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS'],
          projects: [
            {
              name: 'Finance Manager PWA',
              description: 'Offline-first personal finance tracking PWA with Supabase sync',
              live_url: 'https://finance-manager-pwa.vercel.app',
            },
          ],
        };

    const companySlug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const project = chosenProject
      ? profile.projects.find((p) => p.name.toLowerCase() === chosenProject.toLowerCase()) || profile.projects[0]
      : profile.projects[0];

    const projectLinkWithUtm = `${project.live_url}?utm_source=outreach&utm_campaign=${encodeURIComponent(companySlug)}`;

    // If Gemini API Key is available, prompt Gemini with the strict rules
    const geminiKey = process.env.GEMINI_API_KEY;
    const geminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

    if (geminiKey) {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: geminiModel });

        const prompt = `Write a cold outreach email pitching a Summer 2027 software engineering internship.
Sender: ${profile.name}, 3rd year Software Engineering student at Pan Atlantic University, Lagos. Full-time summer availability.
Recipient Company: ${companyName}
Company Context provided: ${companyContext || 'None provided'}
Specific observation to include: ${specificDetail || 'Extract from company context or ask user if blank'}
Featured Project: ${project.name} (${project.description}) -> Link with UTM: ${projectLinkWithUtm}

STRICT PITCH RULES:
1. Total length: UNDER 120 WORDS.
2. Exactly one specific line about ${companyName} taken from its text. Never invent facts about the company. If no specific detail was given, output: "[Please specify one detail about ${companyName}'s product or recent work here]".
3. Exactly one project link: ${projectLinkWithUtm} (do not alter this link).
4. Exactly one clear ask: asking for a 15-minute chat or who to send a CV to.
5. NO flattery filler (no "I hope this email finds you well", no "I'm deeply inspired by your mission", etc.).
6. High-density, professional, direct editorial tone.

Output ONLY the plain email draft text (Subject and Body).`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        const wordCount = text.split(/\s+/).filter(Boolean).length;

        return NextResponse.json({
          draft: text,
          wordCount,
          utmLink: projectLinkWithUtm,
          source: 'gemini',
        });
      } catch (geminiError: any) {
        console.warn('Gemini API call failed, falling back to deterministic template:', geminiError?.message);
      }
    }

    // High quality deterministic template engine adhering to all constraints
    const companyObservation = specificDetail && specificDetail.trim().length > 0
      ? specificDetail.trim()
      : companyContext && companyContext.trim().length > 10
      ? `I've followed ${companyName}'s engineering work on ${companyContext.slice(0, 80).trim()}.`
      : `[Add a specific sentence about ${companyName}'s recent product or infrastructure release here]`;

    const draft = `Subject: Summer 2027 Software Engineering Internship — Chinemerem Madueke

Hi ${companyName} team,

I'm a 3rd-year Software Engineering student at Pan Atlantic University in Lagos, with full-time availability for Summer 2027.

${companyObservation}

My stack centers on Next.js, TypeScript, React, and Supabase. Recently I built ${project.name} (${project.description}), which you can inspect live here: ${projectLinkWithUtm}.

Would you have 15 minutes for a brief call next week, or could you point me to who oversees early-career engineering hiring?

Best regards,
${profile.name}
Lagos, Nigeria`;

    const wordCount = draft.split(/\s+/).filter(Boolean).length;

    return NextResponse.json({
      draft,
      wordCount,
      utmLink: projectLinkWithUtm,
      source: 'template_engine',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

