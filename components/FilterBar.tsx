'use client';

import React, { useState } from 'react';
import { SlidersHorizontal, X, RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';

export interface FilterState {
  region: string; // 'all' | 'nigeria' | 'lagos' | 'region_locked'
  internType: string; // 'all' | 'frontend' | 'software' | 'fullstack'
  matchScore: string; // 'all' | '80' | '60'
  status: string; // 'all' | 'open' | 'closing_soon'
  sort: string; // 'best_match' | 'deadline' | 'newest'
  // More filters
  workMode: string; // 'all' | 'remote' | 'hybrid' | 'onsite'
  source: string; // 'all' | 'greenhouse' | 'ashby' | 'hackernews' | 'lagos-seed' | 'remotive'
}

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  totalCount: number;
  filteredCount: number;
}

export function FilterBar({ filters, onChange, totalCount, filteredCount }: FilterBarProps) {
  const [showMore, setShowMore] = useState(false);

  const update = (key: keyof FilterState, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const resetFilters = () => {
    onChange({
      region: 'all',
      internType: 'all',
      matchScore: 'all',
      status: 'all',
      sort: 'best_match',
      workMode: 'all',
      source: 'all',
    });
  };

  const hasActiveMoreFilters = filters.workMode !== 'all' || filters.source !== 'all';

  return (
    <div className="w-full bg-background-light dark:bg-background-dark border-b border-hairline-light dark:border-hairline-dark pb-4 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* 5 Visible Filters (Hick's Law compliance) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 1. Region */}
          <div className="relative">
            <select
              aria-label="Filter by region"
              value={filters.region}
              onChange={(e) => update('region', e.target.value)}
              className="text-xs py-1.5 px-2.5 rounded-[8px] bg-background-light dark:bg-background-dark border border-hairline-light dark:border-hairline-dark text-ink-light dark:text-ink-dark focus:outline-none focus:ring-1 focus:ring-brass-light"
            >
              <option value="all">Region: All</option>
              <option value="nigeria">Open to Nigeria / Worldwide</option>
              <option value="lagos">Lagos (Onsite / Hybrid)</option>
              <option value="region_locked">Region-locked (US/UK only)</option>
            </select>
          </div>

          {/* 2. Intern Type */}
          <div className="relative">
            <select
              aria-label="Filter by intern type"
              value={filters.internType}
              onChange={(e) => update('internType', e.target.value)}
              className="text-xs py-1.5 px-2.5 rounded-[8px] bg-background-light dark:bg-background-dark border border-hairline-light dark:border-hairline-dark text-ink-light dark:text-ink-dark focus:outline-none focus:ring-1 focus:ring-brass-light"
            >
              <option value="all">Type: All</option>
              <option value="frontend">Frontend Intern</option>
              <option value="software">Software Eng Intern</option>
              <option value="fullstack">Fullstack Intern</option>
            </select>
          </div>

          {/* 3. Match Score */}
          <div className="relative">
            <select
              aria-label="Filter by match score"
              value={filters.matchScore}
              onChange={(e) => update('matchScore', e.target.value)}
              className="text-xs py-1.5 px-2.5 rounded-[8px] bg-background-light dark:bg-background-dark border border-hairline-light dark:border-hairline-dark text-ink-light dark:text-ink-dark focus:outline-none focus:ring-1 focus:ring-brass-light"
            >
              <option value="all">Match: Any</option>
              <option value="80">80%+ (Best Match)</option>
              <option value="60">60%+ (Good Match)</option>
            </select>
          </div>

          {/* 4. Status */}
          <div className="relative">
            <select
              aria-label="Filter by status"
              value={filters.status}
              onChange={(e) => update('status', e.target.value)}
              className="text-xs py-1.5 px-2.5 rounded-[8px] bg-background-light dark:bg-background-dark border border-hairline-light dark:border-hairline-dark text-ink-light dark:text-ink-dark focus:outline-none focus:ring-1 focus:ring-brass-light"
            >
              <option value="all">Status: All</option>
              <option value="open">Open</option>
              <option value="closing_soon">Closing Soon</option>
            </select>
          </div>

          {/* 5. Sort */}
          <div className="relative">
            <select
              aria-label="Sort listings"
              value={filters.sort}
              onChange={(e) => update('sort', e.target.value)}
              className="text-xs py-1.5 px-2.5 rounded-[8px] bg-background-light dark:bg-background-dark border border-hairline-light dark:border-hairline-dark text-ink-light dark:text-ink-dark focus:outline-none focus:ring-1 focus:ring-brass-light"
            >
              <option value="best_match">Sort: Best Match</option>
              <option value="deadline">Sort: Deadline</option>
              <option value="newest">Sort: Newest</option>
            </select>
          </div>

          {/* More Filters Toggle */}
          <button
            onClick={() => setShowMore(!showMore)}
            aria-label="Toggle extra filters"
            className={cn(
              'hit-slop flex items-center space-x-1.5 text-xs py-1.5 px-2.5 rounded-[8px] border transition-colors',
              hasActiveMoreFilters || showMore
                ? 'bg-hairline-light/50 dark:bg-hairline-dark/60 border-brass-light dark:border-brass-dark text-ink-light dark:text-ink-dark'
                : 'bg-background-light dark:bg-background-dark border-hairline-light dark:border-hairline-dark text-muted-light dark:text-muted-dark hover:text-ink-light dark:hover:text-ink-dark'
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>More filters</span>
            {hasActiveMoreFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-brass-light dark:bg-brass-dark" />
            )}
          </button>
        </div>

        {/* Count and Reset */}
        <div className="flex items-center space-x-3 text-xs text-muted-light dark:text-muted-dark">
          <span className="tabular-nums">
            Showing <strong className="text-ink-light dark:text-ink-dark">{filteredCount}</strong> of {totalCount}
          </span>
          {(filters.region !== 'all' || filters.internType !== 'all' || filters.matchScore !== 'all' || filters.status !== 'all' || filters.sort !== 'best_match' || hasActiveMoreFilters) && (
            <button
              onClick={resetFilters}
              aria-label="Reset all filters"
              className="flex items-center space-x-1 text-xs hover:text-ink-light dark:hover:text-ink-dark transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Expanded "More Filters" */}
      {showMore && (
        <div className="mt-3 pt-3 border-t border-hairline-light/60 dark:border-hairline-dark/60 flex flex-wrap gap-3 items-center">
          <div>
            <label className="editorial-label block mb-1">Work Mode</label>
            <select
              value={filters.workMode}
              onChange={(e) => update('workMode', e.target.value)}
              className="text-xs py-1.5 px-2.5 rounded-[8px] bg-background-light dark:bg-background-dark border border-hairline-light dark:border-hairline-dark text-ink-light dark:text-ink-dark"
            >
              <option value="all">All Modes</option>
              <option value="remote">Remote Only</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">Onsite Only</option>
            </select>
          </div>

          <div>
            <label className="editorial-label block mb-1">Source Provider</label>
            <select
              value={filters.source}
              onChange={(e) => update('source', e.target.value)}
              className="text-xs py-1.5 px-2.5 rounded-[8px] bg-background-light dark:bg-background-dark border border-hairline-light dark:border-hairline-dark text-ink-light dark:text-ink-dark"
            >
              <option value="all">All Sources</option>
              <option value="greenhouse">Greenhouse Boards</option>
              <option value="ashby">Ashby Boards</option>
              <option value="hackernews">Hacker News</option>
              <option value="lagos-seed">Lagos Seed Companies</option>
              <option value="remotive">Remotive API</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

