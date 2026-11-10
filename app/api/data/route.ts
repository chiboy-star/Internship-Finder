import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    const configDir = path.join(process.cwd(), 'config');

    const listingsPath = path.join(dataDir, 'listings.json');
    const companiesPath = path.join(dataDir, 'companies.json');
    const metaPath = path.join(dataDir, 'meta.json');
    const programsPath = path.join(configDir, 'programs.json');

    const listings = fs.existsSync(listingsPath) ? JSON.parse(fs.readFileSync(listingsPath, 'utf-8')) : [];
    const companies = fs.existsSync(companiesPath) ? JSON.parse(fs.readFileSync(companiesPath, 'utf-8')) : [];
    const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf-8')) : null;
    const programs = fs.existsSync(programsPath) ? JSON.parse(fs.readFileSync(programsPath, 'utf-8')) : [];

    return NextResponse.json(
      {
        listings,
        companies,
        meta,
        programs,
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
