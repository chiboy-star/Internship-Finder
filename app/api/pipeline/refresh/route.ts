import { NextRequest, NextResponse } from 'next/server';
import { runPipeline } from '@/scripts/pipeline';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { passphrase } = body;

    const expectedPassphrase = process.env.APP_PASSPHRASE;
    if (expectedPassphrase) {
      const provided = req.headers.get('x-app-passphrase') || passphrase;
      if (!provided || provided !== expectedPassphrase) {
        return NextResponse.json({ error: 'Unauthorized: Passphrase required to trigger refresh.' }, { status: 401 });
      }
    }

    const token = process.env.GITHUB_DISPATCH_TOKEN;
    const repo = process.env.GITHUB_REPO || 'chiboy-star/Internship-Finder';

    // If GitHub Dispatch token is present, dispatch workflow
    if (token && repo) {
      const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/pipeline.yml/dispatches`, {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'InternshipFinder-App',
        },
        body: JSON.stringify({ ref: 'main' }),
      });

      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: `GitHub dispatch failed: ${err}` }, { status: res.status });
      }

      return NextResponse.json({
        success: true,
        message: 'Started, new data appears in a few minutes.',
        mode: 'github_actions',
      });
    }

    // Local development fallback: trigger pipeline execution directly
    runPipeline().catch((err) => console.error('Background pipeline error:', err));

    return NextResponse.json({
      success: true,
      message: 'Started, new data appears in a few minutes (local execution).',
      mode: 'local_run',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

export async function GET() {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO;
  return NextResponse.json({
    can_dispatch: Boolean(token && repo),
    repo: repo || null,
  });
}
