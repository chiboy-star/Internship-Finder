import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, careers_url, notes, passphrase } = body;

    const expectedPassphrase = process.env.APP_PASSPHRASE;
    if (expectedPassphrase) {
      const providedPassphrase = req.headers.get('x-app-passphrase') || passphrase;
      if (!providedPassphrase || providedPassphrase !== expectedPassphrase) {
        return NextResponse.json(
          { error: 'Invalid or missing passphrase.' },
          { status: 401 }
        );
      }
    }

    if (!name || !careers_url) {
      return NextResponse.json(
        { error: 'Company name and careers URL are required.' },
        { status: 400 }
      );
    }

    const lagosPath = path.join(process.cwd(), 'config', 'lagos.json');
    const lagosList = fs.existsSync(lagosPath) ? JSON.parse(fs.readFileSync(lagosPath, 'utf-8')) : [];

    const existingIndex = lagosList.findIndex(
      (c: any) => c.company.toLowerCase() === name.toLowerCase()
    );

    const newCompanyEntry = {
      company: name.trim(),
      careers_url: careers_url.trim(),
      city: 'Lagos',
      region: 'Lagos, Nigeria',
      takes_interns: true,
      notes: notes?.trim() || 'Added via Internship Finder company form.',
      contacts: [
        {
          name: `${name.trim()} Talent Partner`,
          role: 'Engineering Recruiter',
          email: null,
          source_url: careers_url.trim(),
        },
      ],
    };

    if (existingIndex >= 0) {
      lagosList[existingIndex] = { ...lagosList[existingIndex], ...newCompanyEntry };
    } else {
      lagosList.push(newCompanyEntry);
    }

    fs.writeFileSync(lagosPath, JSON.stringify(lagosList, null, 2), 'utf-8');

    return NextResponse.json({ success: true, company: newCompanyEntry });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

