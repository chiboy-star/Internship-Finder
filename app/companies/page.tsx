'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  ExternalLink,
  PlusCircle,
  Search,
  Users,
  Sparkles,
  CheckCircle,
  AlertCircle,
  MapPin,
  Check,
  Eye,
  Bell,
  ShieldAlert,
  CheckCircle2,
  Radio,
  ArrowUpRight,
  Clock,
  Calendar,
  MessageSquare,
  CheckCheck,
  Ban,
} from 'lucide-react';
import { Company, Contact, WatcherAlert } from '@/types';
import { PitchModal } from '@/components/PitchModal';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export type OutreachStatus = 'To contact' | 'Contacted' | 'Replied' | 'Closed';

interface OutreachRecord {
  status: OutreachStatus;
  follow_up_date?: string;
  notes?: string;
}

export default function CompaniesPage() {
  const queryClient = useQueryClient();
  const { data: feedData, isLoading } = useQuery<{ companies: Company[]; alerts?: WatcherAlert[] }>({
    queryKey: ['feed-data'],
    queryFn: async () => {
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error('Failed to load companies data');
      return res.json();
    },
  });

  const companies = feedData?.companies || [];
  const alerts = feedData?.alerts || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [pitchTargetCompany, setPitchTargetCompany] = useState<Company | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [watchFilter, setWatchFilter] = useState<'all' | 'watching' | 'manual_check' | 'alerts'>('all');
  const [outreachFilter, setOutreachFilter] = useState<'all' | OutreachStatus>('all');
  const [outreachMap, setOutreachMap] = useState<Record<string, OutreachRecord>>({});

  // Load outreach tracker state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('internship_outreach_tracker');
      if (saved) {
        setOutreachMap(JSON.parse(saved));
      }
    } catch (err) {
      console.error('Failed to parse outreach tracker storage:', err);
    }
  }, []);

  const updateOutreach = (companyId: string, status: OutreachStatus, follow_up_date?: string) => {
    setOutreachMap((prev) => {
      const current = prev[companyId] || { status: 'To contact' };
      const updated: Record<string, OutreachRecord> = {
        ...prev,
        [companyId]: {
          status,
          follow_up_date: follow_up_date !== undefined ? follow_up_date : current.follow_up_date,
        },
      };
      try {
        localStorage.setItem('internship_outreach_tracker', JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
      return updated;
    });
    toast.success(`Outreach status updated to "${status}"`);
  };

  const watchedCount = useMemo(() => companies.filter((c) => c.watching_status === 'watching').length, [companies]);
  const manualCheckCount = useMemo(() => companies.filter((c) => c.watching_status === 'manual check').length, [companies]);

  // Outreach metric counts
  const outreachCounts = useMemo(() => {
    let toContact = 0;
    let contacted = 0;
    let replied = 0;
    let closed = 0;

    for (const c of companies) {
      const st = outreachMap[c.id]?.status || 'To contact';
      if (st === 'To contact') toContact++;
      else if (st === 'Contacted') contacted++;
      else if (st === 'Replied') replied++;
      else if (st === 'Closed') closed++;
    }

    return { toContact, contacted, replied, closed };
  }, [companies, outreachMap]);

  // Form state
  const [companyName, setCompanyName] = useState('');
  const [careersUrl, setCareersUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);
  const [formError, setFormError] = useState('');

  // Filtered and Sorted companies: Verified companies first!
  const filteredCompanies = useMemo(() => {
    let list = [...companies];

    // Watching filter
    if (watchFilter === 'watching') {
      list = list.filter((c) => c.watching_status === 'watching');
    } else if (watchFilter === 'manual_check') {
      list = list.filter((c) => c.watching_status === 'manual check');
    } else if (watchFilter === 'alerts') {
      list = list.filter((c) => c.alert_count && c.alert_count > 0);
    }

    // Outreach status filter
    if (outreachFilter !== 'all') {
      list = list.filter((c) => {
        const st = outreachMap[c.id]?.status || 'To contact';
        return st === outreachFilter;
      });
    }

    // Search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.region.toLowerCase().includes(query) ||
          (c.notes && c.notes.toLowerCase().includes(query))
      );
    }

    // Strict requirement: Show verified companies first!
    list.sort((a, b) => {
      const aVerified = a.status === 'verified';
      const bVerified = b.status === 'verified';
      if (aVerified && !bVerified) return -1;
      if (!aVerified && bVerified) return 1;
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [companies, searchQuery, watchFilter, outreachFilter, outreachMap]);

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess(false);

    if (!companyName.trim() || !careersUrl.trim()) {
      setFormError('Please fill in both the company name and careers URL.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/companies/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: companyName,
          careers_url: careersUrl,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add company');
      }

      setFormSuccess(true);
      toast.success(`Company ${companyName} added to watchlist`);
      setCompanyName('');
      setCareersUrl('');
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['feed-data'] });

      setTimeout(() => {
        setFormSuccess(false);
        setShowAddForm(false);
      }, 2500);
    } catch (err: any) {
      setFormError(err.message || 'Error adding company');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
      {/* Editorial Header */}
      <div className="mb-8 border-b border-hairline-light dark:border-hairline-dark pb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="editorial-label text-brass-light dark:text-brass-dark">Target Organizations</span>
            <h1 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-ink-light dark:text-ink-dark mt-1 text-balance">
              Company Watchlist & Contacts
            </h1>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="hit-slop flex items-center space-x-2 py-2 px-4 rounded-[8px] bg-ink-light text-background-light dark:bg-ink-dark dark:text-background-dark text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <PlusCircle className="w-4 h-4" strokeWidth={1.5} />
            <span>{showAddForm ? 'Close Form' : 'Add Company to Watchlist'}</span>
          </button>
        </div>

        <p className="mt-3 text-base text-muted-light dark:text-muted-dark max-w-2xl leading-relaxed">
          High-conviction companies in Lagos and remote organizations with a history of taking software engineering interns. Verified public contact links and cold pitch routes.
        </p>

        {/* Add Company 2-Field Form (Accessible with aria-describedby, inline states) */}
        {showAddForm && (
          <div className="mt-6 p-6 rounded-[12px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark animate-in fade-in duration-200">
            <span className="editorial-label text-brass-light dark:text-brass-dark block mb-1">
              Add New Company
            </span>
            <h3 className="font-serif text-xl font-bold text-ink-light dark:text-ink-dark mb-4">
              Two-Field Fast Company Addition
            </h3>

            {formSuccess ? (
              <div className="p-4 rounded-[8px] bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 flex items-center space-x-2 text-green-800 dark:text-green-300 text-sm">
                <Check className="w-5 h-5 shrink-0" />
                <span>Company successfully added to watchlist!</span>
              </div>
            ) : (
              <form onSubmit={handleAddCompany} className="space-y-4 max-w-xl">
                <div>
                  <label className="editorial-label block mb-1" htmlFor="company-name-input">
                    Company Name
                  </label>
                  <input
                    id="company-name-input"
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Flutterwave, Paystack, Vercel"
                    aria-describedby={formError ? 'company-form-error' : undefined}
                    className="w-full px-3 py-2 rounded-[8px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark text-sm text-ink-light dark:text-ink-dark focus:outline-none focus:ring-1 focus:ring-brass-light"
                    required
                  />
                </div>

                <div>
                  <label className="editorial-label block mb-1" htmlFor="careers-url-input">
                    Careers or Team Page URL
                  </label>
                  <input
                    id="careers-url-input"
                    type="url"
                    value={careersUrl}
                    onChange={(e) => setCareersUrl(e.target.value)}
                    placeholder="https://company.com/careers"
                    className="w-full px-3 py-2 rounded-[8px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark text-sm text-ink-light dark:text-ink-dark focus:outline-none focus:ring-1 focus:ring-brass-light"
                    required
                  />
                </div>

                <div>
                  <label className="editorial-label block mb-1" htmlFor="company-notes-input">
                    Notes / Tech Stack (Optional)
                  </label>
                  <input
                    id="company-notes-input"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Fintech company based in Victoria Island, builds with Next.js"
                    className="w-full px-3 py-2 rounded-[8px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark text-sm text-ink-light dark:text-ink-dark focus:outline-none focus:ring-1 focus:ring-brass-light"
                  />
                </div>

                {formError && (
                  <p id="company-form-error" className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{formError}</span>
                  </p>
                )}

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-[8px] bg-ink-light text-background-light dark:bg-ink-dark dark:text-background-dark text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : 'Save to Watchlist'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Careers-Page Watcher Section */}
      <section className="mb-10 p-6 sm:p-8 rounded-[16px] border border-hairline-light dark:border-hairline-dark bg-background-light/70 dark:bg-background-dark/70 backdrop-blur-sm shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-5 border-b border-hairline-light dark:border-hairline-dark">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-full bg-brass-light/10 dark:bg-brass-dark/10 flex items-center justify-center text-brass-light dark:text-brass-dark shrink-0">
              <Eye className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="editorial-label text-brass-light dark:text-brass-dark">Careers-Page Watcher</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <Radio className="w-2.5 h-2.5 mr-1 animate-pulse" /> Active Monitoring
                </span>
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-ink-light dark:text-ink-dark mt-0.5">
                Live Watcher & ATS Change Detection
              </h2>
            </div>
          </div>
          <div className="text-xs text-muted-light dark:text-muted-dark max-w-xs text-right hidden sm:block">
            One request/page/run • Respects robots.txt • Captures DOM diffs
          </div>
        </div>

        {/* Metrics Overview / Filter Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <button
            type="button"
            onClick={() => setWatchFilter(watchFilter === 'watching' ? 'all' : 'watching')}
            className={cn(
              "p-4 rounded-[12px] border text-left transition-all",
              watchFilter === 'watching'
                ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500"
                : "border-hairline-light dark:border-hairline-dark hover:border-muted-light/60 bg-background-light dark:bg-background-dark"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="editorial-label text-[11px] text-emerald-700 dark:text-emerald-400">Actively Watched</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-2 font-serif text-3xl font-bold text-ink-light dark:text-ink-dark">
              {watchedCount}
            </div>
            <p className="mt-1 text-xs text-muted-light dark:text-muted-dark">
              Reachable careers pages (HTTP 200). Snapshotted and diffed for new internship postings.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setWatchFilter(watchFilter === 'manual_check' ? 'all' : 'manual_check')}
            className={cn(
              "p-4 rounded-[12px] border text-left transition-all",
              watchFilter === 'manual_check'
                ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 ring-1 ring-amber-500"
                : "border-hairline-light dark:border-hairline-dark hover:border-muted-light/60 bg-background-light dark:bg-background-dark"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="editorial-label text-[11px] text-amber-700 dark:text-amber-400">Manual Check Required</span>
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="mt-2 font-serif text-3xl font-bold text-ink-light dark:text-ink-dark">
              {manualCheckCount}
            </div>
            <p className="mt-1 text-xs text-muted-light dark:text-muted-dark">
              Returned HTTP 403 (anti-bot / Cloudflare). Skipped to be polite; requires manual browser visit.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setWatchFilter(watchFilter === 'alerts' ? 'all' : 'alerts')}
            className={cn(
              "p-4 rounded-[12px] border text-left transition-all",
              watchFilter === 'alerts'
                ? "border-brass-light bg-brass-light/10 dark:border-brass-dark dark:bg-brass-dark/10 ring-1 ring-brass-light"
                : "border-hairline-light dark:border-hairline-dark hover:border-muted-light/60 bg-background-light dark:bg-background-dark"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="editorial-label text-[11px] text-brass-light dark:text-brass-dark">Internship Alerts</span>
              <Bell className="w-4 h-4 text-brass-light dark:text-brass-dark" />
            </div>
            <div className="mt-2 font-serif text-3xl font-bold text-ink-light dark:text-ink-dark">
              {alerts.length}
            </div>
            <p className="mt-1 text-xs text-muted-light dark:text-muted-dark">
              Matches for intern, internship, SIWES, industrial attachment, or trainee keywords.
            </p>
          </button>
        </div>

        {/* Active Alerts List */}
        {alerts.length > 0 && (
          <div className="p-4 sm:p-5 rounded-[12px] border border-brass-light/30 dark:border-brass-dark/30 bg-brass-light/5 dark:bg-brass-dark/5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Bell className="w-4 h-4 text-brass-light dark:text-brass-dark" />
                <h3 className="font-serif text-base font-bold text-ink-light dark:text-ink-dark">
                  Live Keyword Alerts ({alerts.length})
                </h3>
              </div>
              <span className="editorial-label text-[10px]">Detected from Careers Diff</span>
            </div>
            <div className="divide-y divide-hairline-light dark:divide-hairline-dark">
              {alerts.map((a: any) => (
                <div key={a.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex-1 min-w-[220px]">
                    <span className="font-semibold text-ink-light dark:text-ink-dark mr-2">{a.company}:</span>
                    <span className="italic text-muted-light dark:text-muted-dark font-serif">&ldquo;{a.matching_text}&rdquo;</span>
                  </div>
                  <div className="flex items-center space-x-3 shrink-0">
                    <span className="text-[11px] text-muted-light dark:text-muted-dark">
                      {new Date(a.detected_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    <a
                      href={a.job_url || a.careers_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1 text-brass-light dark:text-brass-dark hover:underline font-semibold"
                    >
                      <span>View Careers Page</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Search and Filters */}
      <div className="space-y-4 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-light dark:text-muted-dark" strokeWidth={1.5} />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter companies by name, location, or notes..."
              className="w-full pl-10 pr-4 py-2.5 rounded-[12px] bg-background-light dark:bg-background-dark border border-hairline-light dark:border-hairline-dark text-xs sm:text-sm text-ink-light dark:text-ink-dark placeholder-muted-light dark:placeholder-muted-dark focus:outline-none focus:ring-1 focus:ring-brass-light"
            />
          </div>

          {watchFilter !== 'all' && (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-muted-light dark:text-muted-dark">Active watcher filter:</span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-ink-light text-background-light dark:bg-ink-dark dark:text-background-dark">
                {watchFilter === 'watching' ? 'Actively Watched' : watchFilter === 'manual_check' ? 'Manual Check (403)' : 'Alerts Only'}
              </span>
              <button
                onClick={() => setWatchFilter('all')}
                className="text-xs text-brass-light dark:text-brass-dark hover:underline ml-1"
              >
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Outreach Pipeline Status Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-hairline-light dark:border-hairline-dark">
          <span className="editorial-label text-brass-light dark:text-brass-dark mr-1">Outreach Pipeline:</span>
          
          <button
            type="button"
            onClick={() => setOutreachFilter('all')}
            className={cn(
              "px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors",
              outreachFilter === 'all'
                ? "bg-ink-light text-background-light dark:bg-ink-dark dark:text-background-dark font-semibold shadow-xs"
                : "border border-hairline-light dark:border-hairline-dark text-muted-light dark:text-muted-dark hover:text-ink-light dark:hover:text-ink-dark"
            )}
          >
            All Organizations ({companies.length})
          </button>

          {(['To contact', 'Contacted', 'Replied', 'Closed'] as OutreachStatus[]).map((status) => {
            const count =
              status === 'To contact'
                ? outreachCounts.toContact
                : status === 'Contacted'
                ? outreachCounts.contacted
                : status === 'Replied'
                ? outreachCounts.replied
                : outreachCounts.closed;

            return (
              <button
                key={status}
                type="button"
                onClick={() => setOutreachFilter(outreachFilter === status ? 'all' : status)}
                className={cn(
                  "px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors flex items-center space-x-1.5",
                  outreachFilter === status
                    ? "bg-ink-light text-background-light dark:bg-ink-dark dark:text-background-dark font-semibold shadow-xs"
                    : "border border-hairline-light dark:border-hairline-dark text-muted-light dark:text-muted-dark hover:text-ink-light dark:hover:text-ink-dark"
                )}
              >
                <span>{status}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-hairline-light dark:bg-hairline-dark">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          [1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="p-6 rounded-[12px] border border-hairline-light dark:border-hairline-dark space-y-3">
              <div className="w-28 h-4 static-skeleton" />
              <div className="w-full h-12 static-skeleton" />
              <div className="w-1/2 h-4 static-skeleton" />
            </div>
          ))
        ) : filteredCompanies.length === 0 ? (
          <div className="col-span-full p-12 text-center rounded-[12px] border border-hairline-light dark:border-hairline-dark">
            <Building2 className="w-8 h-8 mx-auto text-muted-light dark:text-muted-dark mb-2" strokeWidth={1.5} />
            <p className="font-serif text-lg text-ink-light dark:text-ink-dark">No companies found</p>
          </div>
        ) : (
          filteredCompanies.map((company) => {
            const encodedComp = encodeURIComponent(company.name);
            const linkedInSearchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodedComp}+recruiter`;
            const outreachRec = outreachMap[company.id] || { status: 'To contact' };
            const isVerified = company.status === 'verified';
            const contact = company.contacts && company.contacts.length > 0 ? company.contacts[0] : null;

            return (
              <div
                key={company.id}
                className={cn(
                  "p-6 rounded-[12px] border flex flex-col justify-between space-y-4 transition-colors",
                  isVerified
                    ? "border-emerald-500/40 dark:border-emerald-600/40 bg-background-light dark:bg-background-dark shadow-xs"
                    : "border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark opacity-90 hover:opacity-100"
                )}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        {/* Verified vs Unverified Priority Badge */}
                        {isVerified ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                            ✓ Verified Company
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-[10px] font-medium bg-hairline-light/60 dark:bg-hairline-dark/60 text-muted-light dark:text-muted-dark">
                            Unverified
                          </span>
                        )}

                        {company.watching_status === 'watching' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                            ● Watched
                          </span>
                        )}
                        {company.watching_status === 'manual check' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                            ⚠ Manual Check (403)
                          </span>
                        )}
                        {Boolean(company.alert_count && company.alert_count > 0) && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-[10px] font-semibold bg-brass-light/20 text-ink-light dark:text-ink-dark border border-brass-light/40">
                            ★ Alert Detected
                          </span>
                        )}
                      </div>

                      <h3 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-ink-light dark:text-ink-dark mt-0.5">
                        {company.name}
                      </h3>
                    </div>

                    <a
                      href={company.careers_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open Careers Page"
                      className="hit-slop p-1.5 rounded-[8px] border border-hairline-light dark:border-hairline-dark text-muted-light hover:text-ink-light dark:hover:text-ink-dark shrink-0"
                    >
                      <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
                    </a>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-light dark:text-muted-dark">
                    <div className="flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span>{company.region}</span>
                    </div>

                    {company.last_change_seen && (
                      <div className="flex items-center space-x-1 text-[11px] text-muted-light/80 dark:text-muted-dark/80">
                        <Clock className="w-3 h-3" strokeWidth={1.5} />
                        <span className="truncate max-w-[180px]" title={company.last_change_seen}>
                          {company.last_change_seen}
                        </span>
                      </div>
                    )}
                  </div>

                  {company.notes && (
                    <p className="mt-3 text-xs text-ink-light/80 dark:text-ink-dark/80 line-clamp-3 leading-relaxed">
                      {company.notes}
                    </p>
                  )}

                  {/* Public Contact Links with Source Page Citation */}
                  <div className="mt-4 pt-3 border-t border-hairline-light dark:border-hairline-dark space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="editorial-label text-[10px] block">Verified Public Contact Route</span>
                      {contact?.email && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          Direct Email
                        </span>
                      )}
                    </div>

                    {contact ? (
                      <div className="text-xs space-y-1.5">
                        <div className="text-ink-light dark:text-ink-dark font-medium">
                          {contact.name} ({contact.role})
                        </div>

                        {contact.email ? (
                          <div>
                            <a href={`mailto:${contact.email}`} className="text-brass-light dark:text-brass-dark underline font-medium">
                              {contact.email}
                            </a>
                          </div>
                        ) : (
                          <div className="text-muted-light dark:text-muted-dark flex items-center justify-between">
                            <span>No raw email on page</span>
                            <a
                              href={linkedInSearchUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-1 text-brass-light dark:text-brass-dark hover:underline font-medium"
                            >
                              <span>Find on LinkedIn</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}

                        {/* Page Contact Came From */}
                        <div className="text-[11px] text-muted-light dark:text-muted-dark flex items-center justify-between gap-2 pt-1 border-t border-hairline-light/50 dark:border-hairline-dark/50">
                          <span className="font-medium shrink-0">Source Page:</span>
                          <a
                            href={contact.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brass-light dark:text-brass-dark underline inline-flex items-center gap-1 truncate max-w-[200px]"
                            title={contact.source_url}
                          >
                            <span className="truncate">{contact.source_url}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-light dark:text-muted-dark flex items-center justify-between">
                        <span>Approachable role: Engineering Talent Lead</span>
                        <a
                          href={linkedInSearchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-brass-light dark:text-brass-dark hover:underline"
                        >
                          <span>Find on LinkedIn</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Outreach Tracker Widget */}
                  <div className="mt-4 pt-3 border-t border-hairline-light dark:border-hairline-dark space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="editorial-label text-[10px]">Outreach Tracker</span>
                      <span className="text-[10px] font-semibold text-brass-light dark:text-brass-dark uppercase tracking-wider">
                        {outreachRec.status}
                      </span>
                    </div>

                    {/* Status Pills */}
                    <div className="grid grid-cols-4 gap-1">
                      {(['To contact', 'Contacted', 'Replied', 'Closed'] as OutreachStatus[]).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => updateOutreach(company.id, st)}
                          className={cn(
                            "py-1 px-1 rounded-[6px] text-[10px] font-medium transition-all text-center truncate",
                            outreachRec.status === st
                              ? "bg-ink-light text-background-light dark:bg-ink-dark dark:text-background-dark font-semibold shadow-xs"
                              : "border border-hairline-light dark:border-hairline-dark hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40 text-muted-light dark:text-muted-dark"
                          )}
                        >
                          {st}
                        </button>
                      ))}
                    </div>

                    {/* Follow-up Date Input */}
                    <div className="flex items-center justify-between text-xs text-muted-light dark:text-muted-dark pt-0.5">
                      <label htmlFor={`followup-${company.id}`} className="text-[11px] flex items-center gap-1 font-medium">
                        <Calendar className="w-3 h-3 text-brass-light dark:text-brass-dark" />
                        <span>Follow-up:</span>
                      </label>
                      <input
                        id={`followup-${company.id}`}
                        type="date"
                        value={outreachRec.follow_up_date || ''}
                        onChange={(e) => updateOutreach(company.id, outreachRec.status, e.target.value)}
                        className="px-2 py-0.5 rounded-[6px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark text-xs text-ink-light dark:text-ink-dark focus:outline-none focus:ring-1 focus:ring-brass-light"
                      />
                    </div>
                  </div>
                </div>

                {/* Bottom Pitch button with Safeguard */}
                <div className="pt-2">
                  {isVerified ? (
                    <button
                      onClick={() => setPitchTargetCompany(company)}
                      className="w-full py-2 px-3 rounded-[8px] border border-hairline-light dark:border-hairline-dark hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40 text-xs font-medium text-ink-light dark:text-ink-dark flex items-center justify-center space-x-1.5 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-brass-light dark:text-brass-dark" />
                      <span>Draft Tailored Cold Pitch</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPitchTargetCompany(company)}
                        className="flex-1 py-2 px-2 rounded-[8px] border border-hairline-light dark:border-hairline-dark text-muted-light hover:text-ink-light dark:hover:text-ink-dark text-xs font-medium flex items-center justify-center space-x-1 transition-colors"
                        title="Pitch drafter will refuse due to unverified contact page"
                      >
                        <Ban className="w-3 h-3 text-red-500 shrink-0" />
                        <span className="truncate">Pitch Locked</span>
                      </button>
                      <a
                        href={linkedInSearchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hit-slop px-3 py-2 rounded-[8px] bg-ink-light text-background-light dark:bg-ink-dark dark:text-background-dark text-xs font-semibold hover:opacity-90 flex items-center gap-1 shrink-0"
                        title="Search recruiters on LinkedIn"
                      >
                        <span>LinkedIn</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pitch Modal with strict verification safeguards */}
      {pitchTargetCompany && (
        <PitchModal
          isOpen={Boolean(pitchTargetCompany)}
          onClose={() => setPitchTargetCompany(null)}
          companyName={pitchTargetCompany.name}
          companyContext={pitchTargetCompany.notes || `Company based in ${pitchTargetCompany.region}`}
          hasVerifiedContactPage={pitchTargetCompany.status === 'verified'}
          contactSourceUrl={pitchTargetCompany.contacts?.[0]?.source_url || pitchTargetCompany.careers_url}
        />
      )}

      {/* Floating "Add Company" button on mobile per page 9 specification */}
      <button
        onClick={() => setShowAddForm(true)}
        aria-label="Add custom company"
        className="md:hidden hit-slop fixed bottom-20 right-6 z-30 p-3.5 rounded-full bg-ink-light text-background-light dark:bg-ink-dark dark:text-background-dark shadow-xl focus:outline-none"
      >
        <PlusCircle className="w-6 h-6" strokeWidth={1.5} />
      </button>
    </div>
  );
}

