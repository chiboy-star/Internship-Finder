'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import MiniSearch from 'minisearch';
import { Search, Compass, ExternalLink, Sparkles, CheckCircle2, Bookmark, ArrowUpRight } from 'lucide-react';
import { Listing, Application, PipelineMeta } from '@/types';
import { FilterBar, FilterState } from '@/components/FilterBar';
import { ListingCard } from '@/components/ListingCard';
import { ListingDetailPane } from '@/components/ListingDetailPane';
import { MobileDetailSheet } from '@/components/MobileDetailSheet';
import { PitchModal } from '@/components/PitchModal';
import { BackToTop } from '@/components/BackToTop';
import { getAllApplications, saveApplication, removeApplication } from '@/lib/db';
import { formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';

export default function FeedPage() {
  // Query listings, companies, and meta with stale-while-revalidate
  const { data, isLoading } = useQuery<{ listings: Listing[]; companies: any[]; meta: PipelineMeta }>({
    queryKey: ['feed-data'],
    queryFn: async () => {
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error('Failed to load feed data');
      return res.json();
    },
  });

  const listings: Listing[] = data?.listings || [];
  const meta: PipelineMeta | null = data?.meta || null;

  // Local state for IndexedDB applications
  const [applications, setApplications] = useState<Record<string, Application>>({});
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [pitchTarget, setPitchTarget] = useState<Listing | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filters state (Hick's Law 5 visible)
  const [filters, setFilters] = useState<FilterState>({
    region: 'all',
    internType: 'all',
    matchScore: 'all',
    status: 'open',
    sort: 'best_match',
    workMode: 'all',
    source: 'all',
  });

  // Load IndexedDB state on mount
  useEffect(() => {
    getAllApplications().then((apps) => {
      setApplications(apps);
    });
  }, []);

  // Set default selected listing on desktop once loaded
  useEffect(() => {
    if (listings.length > 0 && !selectedListing) {
      setSelectedListing(listings[0]);
    }
  }, [listings, selectedListing]);

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

  // Global keyboard shortcuts: / to search, J/K to navigate, S to save, D to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key.toLowerCase() === 'j') {
        // Next listing
        e.preventDefault();
        if (!selectedListing || filteredListings.length === 0) return;
        const currentIdx = filteredListings.findIndex((l) => l.id === selectedListing.id);
        if (currentIdx < filteredListings.length - 1) {
          setSelectedListing(filteredListings[currentIdx + 1]);
        }
      } else if (e.key.toLowerCase() === 'k') {
        // Previous listing
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

  // Filtered and searched listings
  const filteredListings = useMemo(() => {
    let result = [...listings];

    // MiniSearch query
    if (searchQuery.trim() && miniSearch) {
      const searchResults = miniSearch.search(searchQuery.trim());
      const idSet = new Set(searchResults.map((r) => r.id));
      result = result.filter((l) => idSet.has(l.id));
    }

    // Exclude dismissed unless filtered specifically
    result = result.filter((l) => {
      const app = applications[l.id];
      return app?.status !== 'dismissed';
    });

    // 1. Region
    if (filters.region === 'nigeria') {
      result = result.filter((l) => l.eligibility === 'open_to_nigeria');
    } else if (filters.region === 'lagos') {
      result = result.filter(
        (l) => l.location.toLowerCase().includes('lagos') || l.source === 'lagos-seed'
      );
    } else if (filters.region === 'region_locked') {
      result = result.filter((l) => l.eligibility === 'region_locked');
    }

    // 2. Intern Type
    if (filters.internType === 'frontend') {
      result = result.filter((l) => l.title.toLowerCase().includes('frontend') || l.title.toLowerCase().includes('front-end'));
    } else if (filters.internType === 'software') {
      result = result.filter((l) => l.title.toLowerCase().includes('software') || l.title.toLowerCase().includes('engineering'));
    } else if (filters.internType === 'fullstack') {
      result = result.filter((l) => l.title.toLowerCase().includes('full stack') || l.title.toLowerCase().includes('fullstack'));
    }

    // 3. Match score
    if (filters.matchScore === '80') {
      result = result.filter((l) => l.match_score >= 80);
    } else if (filters.matchScore === '60') {
      result = result.filter((l) => l.match_score >= 60);
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

    // Work mode filter
    if (filters.workMode !== 'all') {
      result = result.filter((l) => l.work_mode === filters.workMode);
    }

    // Source filter
    if (filters.source !== 'all') {
      result = result.filter((l) => l.source === filters.source);
    }

    // Sort: Serial position / Best match
    if (filters.sort === 'best_match') {
      result.sort((a, b) => b.match_score - a.match_score);
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
  }, [listings, searchQuery, miniSearch, applications, filters]);

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

    // Optimistic UI update
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
      dates: {
        dismissed_at: new Date().toISOString(),
      },
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
    // On mobile screens, open the drawer
    if (window.innerWidth < 1024) {
      setMobileSheetOpen(true);
    }
  };

  // Peak-end summary calculation
  const savedCount = Object.values(applications).filter((a) => a.status === 'saved' || a.status === 'applied').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
      {/* Editorial Headline (48-64px desktop, 32-40px mobile, text-wrap: balance) */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <span className="editorial-label text-brass-light dark:text-brass-dark">
            Live Matches & Outreach
          </span>
          {meta && (
            <span className="text-xs text-muted-light dark:text-muted-dark tabular-nums">
              Data updated {new Date(meta.last_run).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}, {new Date(meta.last_run).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} ({formatRelativeTime(meta.last_run)})
            </span>
          )}
        </div>

        <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-ink-light dark:text-ink-dark leading-[1.08] text-balance">
          Summer 2027 Software Internships
        </h1>

        <p className="mt-3 text-base sm:text-lg text-muted-light dark:text-muted-dark max-w-2xl leading-relaxed">
          Pre-filtered for Nigeria eligibility, ranked against your Next.js and Supabase projects, with zero-fluff outreach drafting.
        </p>

        {/* Peak-end Session Affirmation Banner */}
        <div className="mt-4 p-3.5 rounded-[12px] border border-hairline-light dark:border-hairline-dark bg-hairline-light/20 dark:bg-hairline-dark/30 flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-brass-light dark:text-brass-dark shrink-0" strokeWidth={1.5} />
            <span className="text-ink-light dark:text-ink-dark">
              {savedCount > 0
                ? `You have ${savedCount} active application targets tracked for Summer 2027.`
                : 'Browse verified listings below or use ⌘K to jump directly to target companies.'}
            </span>
          </div>
          <span className="editorial-label hidden sm:inline text-brass-light dark:text-brass-dark">
            Zero Unverified Roles
          </span>
        </div>
      </div>

      {/* MiniSearch Bar with shortcut hint / */}
      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-light dark:text-muted-dark" strokeWidth={1.5} />
        <input
          ref={searchInputRef}
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search listings by title, company, skills (e.g. Next.js, Supabase, Lagos)..."
          className="w-full pl-10 pr-12 py-3 rounded-[12px] bg-background-light dark:bg-background-dark border border-hairline-light dark:border-hairline-dark text-sm text-ink-light dark:text-ink-dark placeholder-muted-light dark:placeholder-muted-dark focus:outline-none focus:ring-1 focus:ring-brass-light transition-shadow"
          aria-label="Search listings"
        />
        <kbd className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] px-1.5 py-0.5 rounded border border-hairline-light dark:border-hairline-dark text-muted-light dark:text-muted-dark font-sans font-semibold">
          /
        </kbd>
      </div>

      {/* 5 Visible Filters (Hick's Law compliance) */}
      <FilterBar
        filters={filters}
        onChange={setFilters}
        totalCount={listings.length}
        filteredCount={filteredListings.length}
      />

      {/* Layout: Narrow reading column for feed (max 720px) + Two-pane desktop split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left column: Feed (7 cols on desktop, max-w-[720px]) */}
        <div className="lg:col-span-7 max-w-[720px] space-y-4">
          {isLoading ? (
            /* Static Skeletons - tinted blocks with NO shimmer */
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
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
            <div className="p-12 text-center rounded-[12px] border border-hairline-light dark:border-hairline-dark space-y-3">
              <Compass className="w-8 h-8 mx-auto text-muted-light dark:text-muted-dark" strokeWidth={1.5} />
              <h3 className="font-serif text-xl font-bold text-ink-light dark:text-ink-dark">
                No matching internships found
              </h3>
              <p className="text-sm text-muted-light dark:text-muted-dark">
                Try clearing your search filters or check back after the daily pipeline run.
              </p>
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

          {/* Nigerian Job Boards (Jobberman, MyJobMag) Saved Search Card */}
          <div className="mt-8 p-6 rounded-[12px] border border-hairline-light dark:border-hairline-dark bg-hairline-light/20 dark:bg-hairline-dark/20 space-y-3">
            <span className="editorial-label text-brass-light dark:text-brass-dark">Nigerian Job Boards</span>
            <h4 className="font-serif text-lg font-bold text-ink-light dark:text-ink-dark">
              Local Lagos Portals (Strictly Non-Scraped)
            </h4>
            <p className="text-xs text-muted-light dark:text-muted-dark leading-relaxed">
              In strict adherence to robots.txt and board terms, local listings from Jobberman and MyJobMag are curated through verified direct saved searches:
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <a
                href="https://www.jobberman.com/jobs?q=software+engineering+intern"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-[8px] border border-hairline-light dark:border-hairline-dark text-xs text-ink-light dark:text-ink-dark hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40"
              >
                <span>Jobberman Lagos Internships</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
              <a
                href="https://www.myjobmag.com/search/jobs?q=software+engineer+intern"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-[8px] border border-hairline-light dark:border-hairline-dark text-xs text-ink-light dark:text-ink-dark hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40"
              >
                <span>MyJobMag Tech Internships</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
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

      {/* Mobile Drawer (Vaul swipe-to-dismiss bottom sheet) */}
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

