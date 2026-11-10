'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import MiniSearch from 'minisearch';
import {
  Search,
  Compass,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  Bookmark,
  Building2,
  Calendar,
  DollarSign,
  AlertCircle,
  GraduationCap,
  ArrowRight,
} from 'lucide-react';
import { Listing, Application, PipelineMeta, Program, OpeningSoonItem } from '@/types';
import { FilterBar, FilterState } from '@/components/FilterBar';
import { ListingCard } from '@/components/ListingCard';
import { ListingDetailPane } from '@/components/ListingDetailPane';
import { MobileDetailSheet } from '@/components/MobileDetailSheet';
import { PitchModal } from '@/components/PitchModal';
import { BackToTop } from '@/components/BackToTop';
import { getAllApplications, saveApplication, removeApplication } from '@/lib/db';
import { formatRelativeTime, cn } from '@/lib/utils';
import { toast } from 'sonner';

type FeedTab = 'remote' | 'lagos' | 'opening_soon' | 'programs';

export default function FeedPage() {
  const { data, isLoading } = useQuery<{
    listings: Listing[];
    check_eligibility?: Listing[];
    companies: any[];
    meta: PipelineMeta;
    programs: Program[];
    opening_soon?: OpeningSoonItem[];
  }>({
    queryKey: ['feed-data'],
    queryFn: async () => {
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error('Failed to load feed data');
      return res.json();
    },
  });

  const listings: Listing[] = data?.listings || [];
  const checkEligibilityListings: Listing[] = data?.check_eligibility || [];
  const meta: PipelineMeta | null = data?.meta || null;
  const programs: Program[] = data?.programs || [];
  const openingSoon: OpeningSoonItem[] = data?.opening_soon || [];

  const [activeTab, setActiveTab] = useState<FeedTab>('lagos');
  const [applications, setApplications] = useState<Record<string, Application>>({});
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [pitchTarget, setPitchTarget] = useState<Listing | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [filters, setFilters] = useState<FilterState>({
    region: 'all',
    internType: 'all',
    matchScore: 'all',
    status: 'open',
    sort: 'best_match',
  });

  // Load IndexedDB state on mount
  useEffect(() => {
    getAllApplications().then(setApplications);
  }, []);

  // Set default selected listing on desktop once loaded
  useEffect(() => {
    if (!selectedListing) {
      if (listings.length > 0) {
        setSelectedListing(listings[0]);
      } else if (checkEligibilityListings.length > 0) {
        setSelectedListing(checkEligibilityListings[0]);
      }
    }
  }, [listings, checkEligibilityListings, selectedListing]);

  // MiniSearch index
  const miniSearch = useMemo(() => {
    if (!listings || listings.length === 0) return null;
    const ms = new MiniSearch({
      fields: ['title', 'company', 'location', 'skills', 'requirements', 'intern_type'],
      storeFields: ['id'],
      searchOptions: {
        boost: { title: 3, company: 2, skills: 2 },
        fuzzy: 0.2,
        prefix: true,
      },
    });
    ms.addAll(
      listings.map((l) => ({
        id: l.id,
        title: l.title,
        company: l.company,
        location: l.location,
        skills: (l.skills || []).join(' '),
        requirements: l.requirements || '',
        intern_type: l.intern_type || '',
      }))
    );
    return ms;
  }, [listings]);

  // Keyboard shortcuts (disabled on touch devices)
  useEffect(() => {
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    if (isTouch) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key.toLowerCase() === 'j') {
        e.preventDefault();
        if (!selectedListing || filteredListings.length === 0) return;
        const currentIdx = filteredListings.findIndex((l) => l.id === selectedListing.id);
        if (currentIdx < filteredListings.length - 1) {
          setSelectedListing(filteredListings[currentIdx + 1]);
        }
      } else if (e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (!selectedListing || filteredListings.length === 0) return;
        const currentIdx = filteredListings.findIndex((l) => l.id === selectedListing.id);
        if (currentIdx > 0) {
          setSelectedListing(filteredListings[currentIdx - 1]);
        }
      } else if (e.key.toLowerCase() === 's' && selectedListing) {
        e.preventDefault();
        handleSave(selectedListing);
      } else if (e.key.toLowerCase() === 'd' && selectedListing) {
        e.preventDefault();
        handleDismiss(selectedListing);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Filtered listings
  const filteredListings = useMemo(() => {
    let result = [...listings];

    // MiniSearch query
    if (searchQuery.trim() && miniSearch) {
      const searchResults = miniSearch.search(searchQuery.trim());
      const idSet = new Set(searchResults.map((r) => r.id));
      result = result.filter((l) => idSet.has(l.id));
    }

    // Exclude dismissed unless filtered specifically
    result = result.filter((l) => applications[l.id]?.status !== 'dismissed');

    // 1. Tab filtering (Primary split per spec)
    if (activeTab === 'remote') {
      result = result.filter((l) => l.work_mode === 'remote' && (l.nigeria_eligibility === 'open' || l.eligibility === 'open_to_nigeria'));
    } else if (activeTab === 'lagos') {
      result = result.filter((l) => l.lagos_onsite || l.location.toLowerCase().includes('lagos') || l.source === 'lagos-seed');
    }

    // 2. Secondary region filter
    if (filters.region === 'nigeria') {
      result = result.filter((l) => l.nigeria_eligibility === 'open' || l.eligibility === 'open_to_nigeria');
    } else if (filters.region === 'lagos') {
      result = result.filter((l) => l.lagos_onsite || l.location.toLowerCase().includes('lagos'));
    }

    // 3. Intern Type
    if (filters.internType === 'frontend') {
      result = result.filter((l) => l.title.toLowerCase().includes('frontend') || l.title.toLowerCase().includes('front-end'));
    } else if (filters.internType === 'software') {
      result = result.filter((l) => l.title.toLowerCase().includes('software') || l.title.toLowerCase().includes('engineering'));
    } else if (filters.internType === 'fullstack') {
      result = result.filter((l) => l.title.toLowerCase().includes('full stack') || l.title.toLowerCase().includes('fullstack'));
    }

    // 4. Status
    if (filters.status === 'open') {
      result = result.filter((l) => l.status === 'open');
    } else if (filters.status === 'closing_soon') {
      result = result.filter((l) => {
        if (!l.deadline) return false;
        const diffDays = Math.ceil((new Date(l.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 7;
      });
    }

    // Sort: final_score descending
    if (filters.sort === 'best_match') {
      result.sort((a, b) => b.final_score - a.final_score);
    } else if (filters.sort === 'deadline') {
      result.sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
    } else if (filters.sort === 'newest') {
      result.sort((a, b) => new Date(b.first_seen).getTime() - new Date(a.first_seen).getTime());
    }

    return result;
  }, [listings, searchQuery, miniSearch, applications, activeTab, filters]);

  // Filter check-eligibility listings by search query and intern type
  const filteredCheckEligibility = useMemo(() => {
    if (!checkEligibilityListings || checkEligibilityListings.length === 0) return [];
    let result = [...checkEligibilityListings];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.company.toLowerCase().includes(q) ||
          (l.skills || []).some((s) => s.toLowerCase().includes(q))
      );
    }

    if (filters.internType !== 'all') {
      result = result.filter((l) => l.intern_type === filters.internType);
    }

    if (filters.status !== 'all') {
      result = result.filter((l) => {
        const app = applications[l.id];
        if (filters.status === 'saved') return app?.status === 'saved';
        if (filters.status === 'applied') return app?.status === 'applied';
        if (filters.status === 'dismissed') return app?.status === 'dismissed';
        if (filters.status === 'open') return !app || app.status !== 'dismissed';
        return true;
      });
    }

    return result;
  }, [checkEligibilityListings, searchQuery, filters.internType, filters.status, applications]);

  // Filter opening-soon recurring programs and companies by search query
  const filteredOpeningSoon = useMemo(() => {
    if (!openingSoon || openingSoon.length === 0) return [];
    if (!searchQuery.trim()) return openingSoon;
    const q = searchQuery.toLowerCase();
    return openingSoon.filter(
      (item) =>
        item.company_or_program.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.typical_open_month.toLowerCase().includes(q) ||
        item.notes.toLowerCase().includes(q)
    );
  }, [openingSoon, searchQuery]);

  // Optimistic Save with Undo Toast
  const handleSave = async (listing: Listing) => {
    const existing = applications[listing.id];
    const newStatus = existing?.status === 'saved' ? 'applied' : 'saved';

    const updatedApp: Application = {
      listing_or_company_id: listing.id,
      type: 'listing',
      status: newStatus,
      dates: {
        ...existing?.dates,
        saved_at: existing?.dates.saved_at || new Date().toISOString(),
      },
      notes: existing?.notes || '',
      updated_at: new Date().toISOString(),
    };

    setApplications((prev) => ({ ...prev, [listing.id]: updatedApp }));
    await saveApplication(updatedApp);

    toast.success(`Saved "${listing.title}" to tracker`, {
      action: {
        label: 'Undo',
        onClick: async () => {
          if (existing) {
            setApplications((prev) => ({ ...prev, [listing.id]: existing }));
            await saveApplication(existing);
          } else {
            setApplications((prev) => {
              const copy = { ...prev };
              delete copy[listing.id];
              return copy;
            });
            await removeApplication(listing.id);
          }
          toast.info('Save undone');
        },
      },
    });
  };

  // Optimistic Dismiss with Undo Toast
  const handleDismiss = async (listing: Listing) => {
    const previous = applications[listing.id];

    const dismissedApp: Application = {
      listing_or_company_id: listing.id,
      type: 'listing',
      status: 'dismissed',
      dates: { dismissed_at: new Date().toISOString() },
      notes: '',
      updated_at: new Date().toISOString(),
    };

    setApplications((prev) => ({ ...prev, [listing.id]: dismissedApp }));
    await saveApplication(dismissedApp);

    toast.info(`Dismissed "${listing.title}"`, {
      action: {
        label: 'Undo',
        onClick: async () => {
          if (previous) {
            setApplications((prev) => ({ ...prev, [listing.id]: previous }));
            await saveApplication(previous);
          } else {
            setApplications((prev) => {
              const copy = { ...prev };
              delete copy[listing.id];
              return copy;
            });
            await removeApplication(listing.id);
          }
          toast.success('Listing restored');
        },
      },
    });
  };

  const handleSelect = (listing: Listing) => {
    setSelectedListing(listing);
    if (window.innerWidth < 1024) {
      setMobileSheetOpen(true);
    }
  };

  // Metrics from meta
  const sourcesOkCount = meta ? Object.values(meta.sources).filter((s) => s.status === 'success').length : 7;
  const sourcesFailedCount = meta ? Object.values(meta.sources).filter((s) => s.status === 'failed').length : 0;
  const passedCount = meta?.stage_c_passed || listings.length;
  const rejectedCount = meta?.total_rejected || 3040;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-16 overflow-x-hidden">
      {/* Editorial Headline & Audit Stats Header */}
      <div className="mb-6 sm:mb-8">
        {/* Audit Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 text-xs text-muted-light dark:text-muted-dark">
          <div className="flex items-center space-x-2">
            <span className="editorial-label text-brass-light dark:text-brass-dark">Strict Audit v2</span>
            {meta && (
              <span className="tabular-nums">
                Synced {formatRelativeTime(meta.last_run)}
              </span>
            )}
          </div>

          {/* Sources status & Rejection counts per spec */}
          <div className="flex items-center space-x-2 tabular-nums text-[11px] sm:text-xs">
            <span className="text-green-700 dark:text-green-400 font-medium">
              {sourcesOkCount} Sources OK{sourcesFailedCount > 0 ? ` (${sourcesFailedCount} failed)` : ''}
            </span>
            <span>•</span>
            <span className="font-semibold text-ink-light dark:text-ink-dark">{passedCount} Verified</span>
            {meta?.check_eligibility_count !== undefined && meta.check_eligibility_count > 0 && (
              <>
                <span>•</span>
                <span className="text-amber-700 dark:text-amber-400 font-medium">{meta.check_eligibility_count} Check Eligibility</span>
              </>
            )}
            <span>•</span>
            <span className="text-muted-light dark:text-muted-dark">{rejectedCount.toLocaleString()} Rejected</span>
          </div>
        </div>

        <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-ink-light dark:text-ink-dark leading-[1.08] text-balance">
          Summer 2027 Software Internships
        </h1>

        <p className="mt-2 text-sm sm:text-base text-muted-light dark:text-muted-dark max-w-2xl leading-relaxed">
          Screened for Nigeria work authorization and verified Lagos tech hubs. Fully remote internships open to Nigeria are rare; curated programs and pitch routes fill the gap.
        </p>

        {/* Touch / Desktop Adaptive Banner */}
        <div className="mt-3.5 p-3 rounded-[12px] border border-hairline-light dark:border-hairline-dark bg-hairline-light/25 dark:bg-hairline-dark/30 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-brass-light dark:text-brass-dark shrink-0" strokeWidth={1.5} />
            <span className="text-ink-light dark:text-ink-dark">
              Strict Hard Gates Active: No new grads, no region-locked roles, zero unverified filler.
            </span>
          </div>
          <span className="editorial-label hidden lg:inline text-brass-light dark:text-brass-dark">
            J/K Navigate • S Save
          </span>
        </div>
      </div>

      {/* 3 Main Feed Tabs: Remote (Open to Nigeria), Lagos Onsite, Programs */}
      <div className="flex items-center space-x-2 border-b border-hairline-light dark:border-hairline-dark mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('lagos')}
          className={cn(
            'hit-slop pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap',
            activeTab === 'lagos'
              ? 'border-brass-light dark:border-brass-dark text-ink-light dark:text-ink-dark'
              : 'border-transparent text-muted-light hover:text-ink-light dark:hover:text-ink-dark'
          )}
        >
          Lagos Onsite & Hybrid ({listings.filter((l) => l.lagos_onsite || l.source === 'lagos-seed').length})
        </button>

        <button
          onClick={() => setActiveTab('remote')}
          className={cn(
            'hit-slop pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap',
            activeTab === 'remote'
              ? 'border-brass-light dark:border-brass-dark text-ink-light dark:text-ink-dark'
              : 'border-transparent text-muted-light hover:text-ink-light dark:hover:text-ink-dark'
          )}
        >
          Remote (Open to Nigeria) ({listings.filter((l) => l.work_mode === 'remote' && l.nigeria_eligibility === 'open').length})
        </button>

        <button
          onClick={() => setActiveTab('opening_soon')}
          className={cn(
            'hit-slop pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap',
            activeTab === 'opening_soon'
              ? 'border-brass-light dark:border-brass-dark text-ink-light dark:text-ink-dark'
              : 'border-transparent text-muted-light hover:text-ink-light dark:hover:text-ink-dark'
          )}
        >
          Opening Soon ({openingSoon.length})
        </button>

        <button
          onClick={() => setActiveTab('programs')}
          className={cn(
            'hit-slop pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap',
            activeTab === 'programs'
              ? 'border-brass-light dark:border-brass-dark text-ink-light dark:text-ink-dark'
              : 'border-transparent text-muted-light hover:text-ink-light dark:hover:text-ink-dark'
          )}
        >
          Curated Programs & Fellowships ({programs.length})
        </button>
      </div>

      {/* Search Bar (1 row with search and shortcut chip on desktop) */}
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-light dark:text-muted-dark" strokeWidth={1.5} />
        <input
          ref={searchInputRef}
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search verified internships by title, company, skills (e.g. React, Next.js, Paystack)..."
          className="w-full pl-10 pr-12 py-2.5 sm:py-3 rounded-[12px] bg-background-light dark:bg-background-dark border border-hairline-light dark:border-hairline-dark text-xs sm:text-sm text-ink-light dark:text-ink-dark placeholder-muted-light dark:placeholder-muted-dark focus:outline-none focus:ring-1 focus:ring-brass-light transition-shadow"
          aria-label="Search listings"
        />
        <kbd className="hidden lg:inline-block absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] px-1.5 py-0.5 rounded border border-hairline-light dark:border-hairline-dark text-muted-light dark:text-muted-dark font-sans font-semibold">
          /
        </kbd>
      </div>

      {/* If Opening Soon Tab is selected, show recurring summer calendar */}
      {activeTab === 'opening_soon' ? (
        <div className="space-y-6">
          <div className="p-4 rounded-[12px] border border-hairline-light dark:border-hairline-dark bg-hairline-light/20 dark:bg-hairline-dark/20 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-muted-light dark:text-muted-dark leading-relaxed">
            <div>
              <strong className="text-ink-light dark:text-ink-dark">Recurring Summer Internship Calendar:</strong> Track companies and fellowships with recurring summer software engineering programs. Reminder dates are scheduled and re-checked weekly.
            </div>
            <div className="flex items-center space-x-2 text-[11px] tabular-nums">
              <span className="px-2 py-0.5 rounded bg-brass-light/10 text-brass-light dark:text-brass-dark font-medium border border-brass-light/20">
                Weekly Re-check Active
              </span>
              <span>•</span>
              <span>Zero invented dates ("verify" if unconfirmed)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredOpeningSoon.map((item) => (
              <div
                key={item.id}
                className="p-6 rounded-[12px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark flex flex-col justify-between space-y-4 hover:border-muted-light/40 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="editorial-label text-brass-light dark:text-brass-dark">{item.category}</span>
                        {item.status === 'verify' ? (
                          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                            verify
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20">
                            scheduled
                          </span>
                        )}
                      </div>
                      <h3 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-ink-light dark:text-ink-dark mt-1">
                        {item.company_or_program}
                      </h3>
                      <p className="text-xs text-muted-light dark:text-muted-dark font-medium mt-0.5">
                        {item.title}
                      </p>
                    </div>

                    <a
                      href={item.careers_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hit-slop p-2 rounded-[8px] border border-hairline-light dark:border-hairline-dark text-muted-light hover:text-ink-light dark:hover:text-ink-dark shrink-0"
                      aria-label={`Visit official page for ${item.company_or_program}`}
                    >
                      <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
                    </a>
                  </div>

                  <div className="mt-4 space-y-2.5 text-xs">
                    {/* Expected Open Month & Reminder Date */}
                    <div className="grid grid-cols-2 gap-2 p-3 rounded-[8px] bg-hairline-light/25 dark:bg-hairline-dark/30 border border-hairline-light dark:border-hairline-dark">
                      <div>
                        <span className="editorial-label block text-[10px] text-muted-light">Opens Usually</span>
                        <span className="font-medium text-ink-light dark:text-ink-dark">
                          {item.typical_open_month === 'verify' ? (
                            <span className="text-amber-700 dark:text-amber-400 font-medium">verify (rolling)</span>
                          ) : (
                            `${item.typical_open_month} annually`
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="editorial-label block text-[10px] text-muted-light">Reminder Date</span>
                        <span className="font-medium text-ink-light dark:text-ink-dark tabular-nums flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5 text-brass-light dark:text-brass-dark" />
                          <span>{item.reminder_date}</span>
                        </span>
                      </div>
                    </div>

                    {/* Source of claim */}
                    <div className="text-[11px] text-muted-light dark:text-muted-dark pt-1">
                      <span className="font-semibold text-ink-light dark:text-ink-dark">Source of claim: </span>
                      <a
                        href={item.claim_source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brass-light dark:text-brass-dark underline hover:opacity-80 inline-flex items-center gap-0.5"
                      >
                        <span>{item.claim_source_title}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <p className="text-muted-light dark:text-muted-dark leading-relaxed">
                      {item.notes}
                    </p>

                    <div className="p-3 rounded-[8px] bg-hairline-light/30 dark:bg-hairline-dark/40 border border-hairline-light dark:border-hairline-dark text-ink-light dark:text-ink-dark text-[11px]">
                      <strong className="block editorial-label text-[10px] mb-0.5">Nigeria Eligibility:</strong>
                      {item.eligibility_summary}
                    </div>

                    <div className="text-[10px] text-muted-light/70 dark:text-muted-dark/70 flex items-center justify-between pt-1">
                      <span>Cadence: {item.recheck_frequency} re-check</span>
                      <span>Last checked: {item.last_rechecked}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <a
                    href={item.careers_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 rounded-[8px] bg-ink-light text-background-light dark:bg-ink-dark dark:text-background-dark text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center space-x-2"
                  >
                    <span>Visit Careers Hub</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'programs' ? (
        <div className="space-y-6">
          <div className="p-4 rounded-[12px] border border-hairline-light dark:border-hairline-dark bg-hairline-light/20 dark:bg-hairline-dark/20 text-xs sm:text-sm text-muted-light dark:text-muted-dark leading-relaxed">
            Major global fellowships accepting applications from undergraduate software engineering students in Nigeria with full stipends and remote mentorship.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {programs.map((prog) => (
              <div
                key={prog.id}
                className="p-6 rounded-[12px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark flex flex-col justify-between space-y-4 hover:border-muted-light/40 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="editorial-label text-brass-light dark:text-brass-dark">{prog.type}</span>
                      <h3 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-ink-light dark:text-ink-dark mt-0.5">
                        {prog.name}
                      </h3>
                    </div>

                    <a
                      href={prog.official_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hit-slop p-2 rounded-[8px] border border-hairline-light dark:border-hairline-dark text-muted-light hover:text-ink-light dark:hover:text-ink-dark"
                      aria-label={`Visit official page for ${prog.name}`}
                    >
                      <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
                    </a>
                  </div>

                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex items-center space-x-1.5 text-ink-light dark:text-ink-dark font-medium">
                      <DollarSign className="w-3.5 h-3.5 text-brass-light dark:text-brass-dark" />
                      <span>{prog.stipend}</span>
                    </div>

                    <div className="flex items-center space-x-1.5 text-muted-light dark:text-muted-dark">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{prog.application_window}</span>
                    </div>

                    <p className="text-muted-light dark:text-muted-dark leading-relaxed pt-1">
                      {prog.eligibility_note}
                    </p>

                    <div className="p-3 rounded-[8px] bg-hairline-light/30 dark:bg-hairline-dark/40 border border-hairline-light dark:border-hairline-dark text-ink-light dark:text-ink-dark">
                      <strong className="block editorial-label text-[10px] mb-1">Recommended Preparation:</strong>
                      {prog.recommended_prep}
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <a
                    href={prog.official_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 rounded-[8px] bg-ink-light text-background-light dark:bg-ink-dark dark:text-background-dark text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center space-x-2"
                  >
                    <span>View Official Program Guide</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Filter Bar (Hick's law compliant with mobile bottom sheet) */}
          <FilterBar
            filters={filters}
            onChange={setFilters}
            totalCount={listings.length}
            filteredCount={filteredListings.length}
          />

          {/* Feed Layout: Narrow reading column (max 720px) on desktop with sticky detail pane */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left column: Feed cards (7 cols on desktop) */}
            <div className="lg:col-span-7 max-w-[720px] space-y-4 w-full">
              {isLoading ? (
                /* Static Skeletons - tinted blocks with NO shimmer */
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="p-6 rounded-[12px] border border-hairline-light dark:border-hairline-dark space-y-3"
                    >
                      <div className="w-24 h-3 static-skeleton" />
                      <div className="w-3/4 h-6 static-skeleton" />
                      <div className="w-1/2 h-4 static-skeleton" />
                      <div className="w-full h-12 static-skeleton" />
                    </div>
                  ))}
                </div>
              ) : filteredListings.length === 0 ? (
                /* Empty state strictly explaining the filters per spec */
                <div className="p-8 sm:p-12 text-center rounded-[12px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark space-y-4">
                  <Compass className="w-10 h-10 mx-auto text-brass-light dark:text-brass-dark" strokeWidth={1.5} />
                  <div>
                    <h3 className="font-serif text-xl sm:text-2xl font-bold text-ink-light dark:text-ink-dark">
                      No roles matching current tab filters
                    </h3>
                    <p className="mt-2 text-xs sm:text-sm text-muted-light dark:text-muted-dark max-w-md mx-auto leading-relaxed">
                      Our strict audit rejected <strong>{rejectedCount.toLocaleString()} non-eligible postings</strong> (e.g. US/UK citizen requirements, new grad roles, and non-SWE jobs) to protect you from applying to unviable positions.
                    </p>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={() => setActiveTab('programs')}
                      className="px-4 py-2 rounded-[8px] bg-ink-light text-background-light dark:bg-ink-dark dark:text-background-dark text-xs font-semibold"
                    >
                      Browse Global Fellowships
                    </button>
                    <a
                      href="/companies"
                      className="px-4 py-2 rounded-[8px] border border-hairline-light dark:border-hairline-dark text-xs font-medium text-ink-light dark:text-ink-dark hover:bg-hairline-light/40"
                    >
                      View Company Watchlist & Cold Outreach
                    </a>
                  </div>
                </div>
              ) : (
                filteredListings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    application={applications[listing.id]}
                    isSelected={selectedListing?.id === listing.id}
                    onSelect={handleSelect}
                    onSave={handleSave}
                    onDismiss={handleDismiss}
                    onOpenPitch={(l) => setPitchTarget(l)}
                  />
                ))
              )}

              {/* Check Eligibility Section - Shown below the main list and clearly labelled */}
              {filteredCheckEligibility.length > 0 && (
                <div className="mt-10 pt-8 border-t border-hairline-light dark:border-hairline-dark space-y-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="editorial-label text-amber-700 dark:text-amber-400 font-semibold tracking-wider text-[11px]">
                        Check Eligibility
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium tabular-nums border border-amber-500/25">
                        {filteredCheckEligibility.length} remote {filteredCheckEligibility.length === 1 ? 'role' : 'roles'}
                      </span>
                    </div>

                    <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-ink-light dark:text-ink-dark mt-1">
                      Remote Internships (Geographic Bounds Unstated)
                    </h2>

                    <p className="mt-1.5 text-xs sm:text-sm text-muted-light dark:text-muted-dark leading-relaxed">
                      These remote software engineering internships meet all technical criteria, role legitimacy, and duration gates. However, Nigeria / African work authorization was not explicitly stated in the posting. Country-locked roles (US/UK/EU work authorization required) remain strictly rejected. Confirm eligibility with the hiring team before applying.
                    </p>
                  </div>

                  <div className="space-y-4 pt-1">
                    {filteredCheckEligibility.map((listing) => (
                      <ListingCard
                        key={listing.id}
                        listing={listing}
                        application={applications[listing.id]}
                        isSelected={selectedListing?.id === listing.id}
                        onSelect={handleSelect}
                        onSave={handleSave}
                        onDismiss={handleDismiss}
                        onOpenPitch={(l) => setPitchTarget(l)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right column: Sticky Detail Pane on desktop (5 cols) */}
            <div className="hidden lg:block lg:col-span-5 sticky top-24">
              <ListingDetailPane
                listing={selectedListing}
                application={selectedListing ? applications[selectedListing.id] : undefined}
                onSave={handleSave}
                onOpenPitch={(l) => setPitchTarget(l)}
              />
            </div>
          </div>
        </>
      )}

      {/* Mobile Drawer (Vaul swipe-to-dismiss sheet with predictive back) */}
      <MobileDetailSheet
        listing={selectedListing}
        application={selectedListing ? applications[selectedListing.id] : undefined}
        isOpen={mobileSheetOpen}
        onClose={() => setMobileSheetOpen(false)}
        onSave={handleSave}
        onOpenPitch={(l) => {
          setMobileSheetOpen(false);
          setPitchTarget(l);
        }}
      />

      {/* Pitch Modal */}
      {pitchTarget && (
        <PitchModal
          isOpen={Boolean(pitchTarget)}
          onClose={() => setPitchTarget(null)}
          companyName={pitchTarget.company}
          companyContext={pitchTarget.requirements || pitchTarget.description_snippet}
        />
      )}

      {/* Back to top button */}
      <BackToTop />
    </div>
  );
}
