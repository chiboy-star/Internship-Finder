'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sliders,
  User,
  Database,
  HelpCircle,
  Download,
  Upload,
  Trash2,
  Key,
  Eye,
  EyeOff,
  CheckCircle,
  AlertTriangle,
  Mail,
  Copy,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import { PipelineMeta, UserProfile } from '@/types';
import { exportAllData, importAllData, clearAllLocalData } from '@/lib/db';
import { useTheme } from '@/components/Providers';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  // Load pipeline meta
  const { data: feedData } = useQuery<{ meta: PipelineMeta }>({
    queryKey: ['feed-data'],
    queryFn: async () => {
      const res = await fetch('/api/data');
      if (!res.ok) return { meta: null as any };
      return res.json();
    },
  });

  const meta = feedData?.meta;

  // Profile data
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Passphrase state
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canDispatch, setCanDispatch] = useState<boolean | null>(null);

  // FAQ accordion state
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Clear data confirmation modal
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // File import ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Weekly digest state
  const [digestPreview, setDigestPreview] = useState('');
  const [digestCopied, setDigestCopied] = useState(false);

  useEffect(() => {
    fetch('/config/profile.json')
      .then((r) => r.json())
      .then(setProfile)
      .catch(() => {});

    const savedPass = localStorage.getItem('app-passphrase');
    if (savedPass) setPassphrase(savedPass);

    fetch('/api/pipeline/refresh')
      .then((r) => r.json())
      .then((data) => setCanDispatch(Boolean(data?.can_dispatch)))
      .catch(() => setCanDispatch(false));
  }, []);

  const handleRefreshPipeline = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/pipeline/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-app-passphrase': passphrase,
        },
        body: JSON.stringify({ passphrase }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to trigger pipeline refresh');
      } else {
        toast.success(data.message || 'Started, new data appears in a few minutes.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error communicating with refresh endpoint');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSavePassphrase = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('app-passphrase', passphrase);
    toast.success('Passphrase saved for API routes');
  };

  const handleExport = async () => {
    try {
      const json = await exportAllData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `internship-finder-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('All tracker and watchlist state exported');
    } catch {
      toast.error('Export failed');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const res = await importAllData(text);
      if (res.success) {
        toast.success(`Successfully imported ${res.count} records`);
      } else {
        toast.error(res.error || 'Import failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to read file');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearData = async () => {
    await clearAllLocalData();
    setShowClearConfirm(false);
    toast.success('All personal local data cleared');
    window.location.reload();
  };

  const generateWeeklyDigest = () => {
    const text = `📬 Summer 2027 Internship Digest — Week of ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}

🎯 Highlights for Chinemerem Madueke (Frontend & Software Engineering):
- Top Matches: Paystack, Moniepoint, Stripe, RepSpark, Bamboo
- Stack Focus: Next.js, TypeScript, React, Supabase
- Availability: Summer 2027 Full-Time

⏰ Action Items:
1. Send tailored outreach pitch to 3 Lagos tech companies.
2. Complete follow-up for applied roles.
3. Review closing soon deadlines.

🔗 Live Tracker: https://internship-finder.vercel.app`;

    setDigestPreview(text);
  };

  const handleCopyDigest = () => {
    if (!digestPreview) return;
    navigator.clipboard.writeText(digestPreview);
    setDigestCopied(true);
    toast.success('Digest copied to clipboard');
    setTimeout(() => setDigestCopied(false), 2000);
  };

  const faqItems = [
    {
      q: 'How does the match scoring work?',
      a: 'The pipeline extracts requirements and compares them against your profile (React, Next.js, TypeScript, Tailwind, Supabase, Git, and full-time Summer 2027 availability). Gemini AI or deterministic fallback scores listings from 0 to 100 with a one-sentence rationale why the position fits your projects.',
    },
    {
      q: 'What do the eligibility flags mean?',
      a: 'Remote jobs that explicitly require US/UK citizenship or work authorization without visa support are flagged as "Region-Locked". Roles open to candidates globally or specifically in Nigeria/Africa are flagged as "Open to Nigeria / Worldwide".',
    },
    {
      q: 'Where does data come from and why are LinkedIn/Indeed off-limits?',
      a: 'We query official public board endpoints (Greenhouse, Lever, Ashby), community GitHub repos, public remote APIs (Remotive, Arbeitnow), Hacker News Who is hiring, and our hand-verified Lagos seed list. In strict compliance with terms and robots.txt, scraping LinkedIn, Indeed, and Glassdoor is strictly off-limits.',
    },
    {
      q: 'How do I add a new company to the watchlist?',
      a: 'Use the "Add Company" button on the Companies page or the floating action button on mobile. Provide the company name and careers URL. It will automatically be tracked and included in outreach pitches.',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16 space-y-12">
      {/* Editorial Header */}
      <div className="border-b border-hairline-light dark:border-hairline-dark pb-6">
        <span className="editorial-label text-brass-light dark:text-brass-dark">System Configuration</span>
        <h1 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-ink-light dark:text-ink-dark mt-1 text-balance">
          Settings & Profile
        </h1>
        <p className="mt-2 text-sm sm:text-base text-muted-light dark:text-muted-dark">
          Manage your candidate profile, data sources, passphrase gate, and local backups.
        </p>
      </div>

      {/* Profile Section */}
      <section className="p-6 rounded-[12px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark space-y-4">
        <div className="flex items-center space-x-2">
          <User className="w-5 h-5 text-brass-light dark:text-brass-dark" strokeWidth={1.5} />
          <h2 className="font-serif text-xl font-bold text-ink-light dark:text-ink-dark">
            Candidate Profile
          </h2>
        </div>

        {profile && (
          <div className="space-y-4 text-sm text-ink-light/90 dark:text-ink-dark/90">
            <div>
              <span className="editorial-label block text-[10px]">Academic Stage</span>
              <p className="font-medium mt-0.5">{profile.stage}</p>
            </div>

            <div>
              <span className="editorial-label block text-[10px]">Core Skills</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {profile.core_skills.concat(profile.backend_and_tools).map((s) => (
                  <span
                    key={s}
                    className="text-xs px-2.5 py-0.5 rounded-[6px] border border-hairline-light dark:border-hairline-dark bg-hairline-light/30 dark:bg-hairline-dark/30 font-sans"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <span className="editorial-label block text-[10px]">Featured Projects</span>
              <ul className="mt-1 space-y-1 text-xs text-muted-light dark:text-muted-dark">
                {profile.projects.map((p) => (
                  <li key={p.name}>
                    <strong className="text-ink-light dark:text-ink-dark">{p.name}:</strong> {p.description}{' '}
                    <a href={p.live_url} target="_blank" rel="noopener noreferrer" className="text-brass-light dark:text-brass-dark underline ml-1">
                      Live
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <span className="editorial-label block text-[10px]">Target Availability</span>
              <p className="text-xs text-ink-light dark:text-ink-dark font-medium mt-0.5">
                {profile.availability} — {profile.hours_per_week}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Passphrase Gate Protection */}
      <section className="p-6 rounded-[12px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark space-y-4">
        <div className="flex items-center space-x-2">
          <Key className="w-5 h-5 text-brass-light dark:text-brass-dark" strokeWidth={1.5} />
          <h2 className="font-serif text-xl font-bold text-ink-light dark:text-ink-dark">
            Passphrase Gate (APP_PASSPHRASE)
          </h2>
        </div>
        <p className="text-xs text-muted-light dark:text-muted-dark leading-relaxed">
          Protects your server API routes and Gemini AI quota from unauthorized third-party usage.
        </p>

        <form onSubmit={handleSavePassphrase} className="max-w-md space-y-3">
          <div className="relative">
            <input
              type={showPassphrase ? 'text' : 'password'}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter your secret passphrase..."
              className="w-full px-3 py-2 pr-10 rounded-[8px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark text-sm text-ink-light dark:text-ink-dark focus:outline-none focus:ring-1 focus:ring-brass-light"
            />
            <button
              type="button"
              onClick={() => setShowPassphrase(!showPassphrase)}
              aria-label={showPassphrase ? 'Hide passphrase' : 'Show passphrase'}
              className="hit-slop absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-light dark:text-muted-dark hover:text-ink-light dark:hover:text-ink-dark"
            >
              {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-[8px] bg-ink-light text-background-light dark:bg-ink-dark dark:text-background-dark text-xs font-semibold hover:opacity-90"
          >
            Save Passphrase
          </button>
        </form>
      </section>

      {/* Data Sources Status */}
      <section className="p-6 rounded-[12px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark space-y-4">
        <div className="flex items-center space-x-2">
          <Database className="w-5 h-5 text-brass-light dark:text-brass-dark" strokeWidth={1.5} />
          <h2 className="font-serif text-xl font-bold text-ink-light dark:text-ink-dark">
            Data Sources & Pipeline Sync
          </h2>
        </div>

        {meta && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-hairline-light dark:border-hairline-dark">
                  <th className="py-2.5 editorial-label">Source</th>
                  <th className="py-2.5 editorial-label">Status</th>
                  <th className="py-2.5 editorial-label">Listings</th>
                  <th className="py-2.5 editorial-label">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline-light dark:divide-hairline-dark">
                {Object.entries(meta.sources).map(([name, info]) => (
                  <tr key={name} className="hover:bg-hairline-light/20 dark:hover:bg-hairline-dark/20">
                    <td className="py-2.5 font-medium capitalize text-ink-light dark:text-ink-dark">
                      {name.replace(/-/g, ' ')}
                    </td>
                    <td className="py-2.5">
                      {info.status === 'success' ? (
                        <span className="text-green-600 dark:text-green-400 font-medium">Active</span>
                      ) : info.status === 'skipped' ? (
                        <span className="text-muted-light dark:text-muted-dark">Off-Limits (Terms)</span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">Offline</span>
                      )}
                    </td>
                    <td className="py-2.5 tabular-nums text-ink-light dark:text-ink-dark">{info.count}</td>
                    <td className="py-2.5 text-muted-light dark:text-muted-dark">
                      {name === 'greenhouse' || name === 'ashby' || name === 'lever'
                        ? 'Official Public API'
                        : name === 'lagos-seed'
                        ? 'Curated Seed File'
                        : name === 'hackernews'
                        ? 'Algolia HN API'
                        : name === 'remote-apis'
                        ? 'Public JSON Feed'
                        : 'Saved Search Links'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pt-4 border-t border-hairline-light dark:border-hairline-dark flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-ink-light dark:text-ink-dark">
              Manual Ingestion Trigger
            </p>
            <p className="text-[11px] text-muted-light dark:text-muted-dark">
              {canDispatch
                ? 'Connected to GitHub Actions workflow dispatch for automated cloud ingestion.'
                : 'Triggers local ingestion or server runner. Configure GITHUB_DISPATCH_TOKEN in .env.local to dispatch GitHub Actions.'}
            </p>
          </div>
          <button
            onClick={handleRefreshPipeline}
            disabled={isRefreshing}
            className="hit-slop flex items-center space-x-2 px-4 py-2 rounded-[8px] bg-ink-light text-background-light dark:bg-ink-dark dark:text-background-dark text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Pipeline Now'}</span>
          </button>
        </div>
      </section>

      {/* Weekly Digest Generator */}
      <section className="p-6 rounded-[12px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark space-y-4">
        <div className="flex items-center space-x-2">
          <Mail className="w-5 h-5 text-brass-light dark:text-brass-dark" strokeWidth={1.5} />
          <h2 className="font-serif text-xl font-bold text-ink-light dark:text-ink-dark">
            Weekly Digest Generator
          </h2>
        </div>
        <p className="text-xs text-muted-light dark:text-muted-dark leading-relaxed">
          Generate an executive weekly summary of new internship matches and closing deadlines to send via email or Telegram bot.
        </p>

        <button
          onClick={generateWeeklyDigest}
          className="px-4 py-2 rounded-[8px] bg-ink-light text-background-light dark:bg-ink-dark dark:text-background-dark text-xs font-semibold hover:opacity-90"
        >
          Generate Weekly Digest Preview
        </button>

        {digestPreview && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="editorial-label text-[10px]">Digest Output</span>
              <button
                onClick={handleCopyDigest}
                className="hit-slop flex items-center space-x-1 text-xs text-muted-light hover:text-ink-light dark:hover:text-ink-dark"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{digestCopied ? 'Copied' : 'Copy Digest'}</span>
              </button>
            </div>
            <pre className="p-4 rounded-[8px] bg-hairline-light/30 dark:bg-hairline-dark/30 border border-hairline-light dark:border-hairline-dark text-xs font-sans whitespace-pre-wrap">
              {digestPreview}
            </pre>
          </div>
        )}
      </section>

      {/* Expandable FAQ Accordion */}
      <section className="p-6 rounded-[12px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark space-y-4">
        <div className="flex items-center space-x-2">
          <HelpCircle className="w-5 h-5 text-brass-light dark:text-brass-dark" strokeWidth={1.5} />
          <h2 className="font-serif text-xl font-bold text-ink-light dark:text-ink-dark">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="divide-y divide-hairline-light dark:divide-hairline-dark">
          {faqItems.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={idx} className="py-3">
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between text-left text-sm font-semibold text-ink-light dark:text-ink-dark py-1"
                >
                  <span>{item.q}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 shrink-0 text-muted-light" /> : <ChevronDown className="w-4 h-4 shrink-0 text-muted-light" />}
                </button>
                {isOpen && (
                  <p className="text-xs text-muted-light dark:text-muted-dark mt-2 leading-relaxed">
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Backup, Export & Clear State */}
      <section className="p-6 rounded-[12px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark space-y-4">
        <h2 className="font-serif text-xl font-bold text-ink-light dark:text-ink-dark">
          Data Management & Reset
        </h2>
        <p className="text-xs text-muted-light dark:text-muted-dark">
          Personal state (saved items, custom companies, tracker progress, notes) is stored in your browser's IndexedDB.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleExport}
            className="hit-slop flex items-center space-x-1.5 px-3 py-2 rounded-[8px] border border-hairline-light dark:border-hairline-dark text-xs font-medium text-ink-light dark:text-ink-dark hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40"
          >
            <Download className="w-4 h-4" strokeWidth={1.5} />
            <span>Export JSON Backup</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="hit-slop flex items-center space-x-1.5 px-3 py-2 rounded-[8px] border border-hairline-light dark:border-hairline-dark text-xs font-medium text-ink-light dark:text-ink-dark hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40"
          >
            <Upload className="w-4 h-4" strokeWidth={1.5} />
            <span>Import JSON Backup</span>
          </button>

          <button
            onClick={() => setShowClearConfirm(true)}
            className="hit-slop flex items-center space-x-1.5 px-3 py-2 rounded-[8px] border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-950/20"
          >
            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
            <span>Clear Local Data</span>
          </button>
        </div>
      </section>

      {/* Irreversible Confirmation Modal */}
      {showClearConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowClearConfirm(false)}
        >
          <div
            className="w-full max-w-md bg-background-light dark:bg-background-dark border border-hairline-light dark:border-hairline-dark rounded-[12px] p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-lg font-bold text-ink-light dark:text-ink-dark">
              Clear all saved data?
            </h3>
            <p className="text-xs text-muted-light dark:text-muted-dark leading-relaxed">
              This action cannot be undone. All saved applications, custom company notes, and tracker records in this browser will be wiped.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 text-xs text-muted-light hover:text-ink-light dark:hover:text-ink-dark"
              >
                Cancel
              </button>
              <button
                onClick={handleClearData}
                className="px-3 py-1.5 rounded-[8px] bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
              >
                Confirm Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

