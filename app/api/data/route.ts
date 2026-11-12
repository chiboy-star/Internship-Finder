import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    const configDir = path.join(process.cwd(), 'config');

    const listingsPath = path.join(dataDir, 'listings.json');
    const checkEligibilityPath = path.join(dataDir, 'check_eligibility.json');
    const companiesPath = path.join(dataDir, 'companies.json');
    const metaPath = path.join(dataDir, 'meta.json');
    const alertsPath = path.join(dataDir, 'alerts.json');
    const programsPath = path.join(configDir, 'programs.json');
    const openingSoonPath = path.join(configDir, 'opening_soon.json');

    const listings = fs.existsSync(listingsPath) ? JSON.parse(fs.readFileSync(listingsPath, 'utf-8')) : [];
    const check_eligibility = fs.existsSync(checkEligibilityPath) ? JSON.parse(fs.readFileSync(checkEligibilityPath, 'utf-8')) : [];
    const companies = fs.existsSync(companiesPath) ? JSON.parse(fs.readFileSync(companiesPath, 'utf-8')) : [];
    const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf-8')) : null;
    const alerts = fs.existsSync(alertsPath) ? JSON.parse(fs.readFileSync(alertsPath, 'utf-8')) : [];
    const programs = fs.existsSync(programsPath) ? JSON.parse(fs.readFileSync(programsPath, 'utf-8')) : [];
    const opening_soon = fs.existsSync(openingSoonPath) ? JSON.parse(fs.readFileSync(openingSoonPath, 'utf-8')) : [];

    return NextResponse.json(
      {
        listings,
        check_eligibility,
        companies,
        meta,
        alerts,
        programs,
        opening_soon,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
