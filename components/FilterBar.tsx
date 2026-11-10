'use client';

import React, { useState } from 'react';
import { SlidersHorizontal, RotateCcw, X } from 'lucide-react';
import { cn } from '../lib/utils';

export interface FilterState {
  region: string; // 'all' | 'nigeria' | 'lagos'
  internType: string; // 'all' | 'frontend' | 'software' | 'fullstack'
  matchScore: string; // 'all' | '80' | '60'
  status: string; // 'all' | 'open' | 'closing_soon'
  sort: string; // 'best_match' | 'deadline' | 'newest'
}

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  totalCount: number;
  filteredCount: number;
}

export function FilterBar({ filters, onChange, totalCount, filteredCount }: FilterBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

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
    });
  };

  const activeFilterCount =
    (filters.region !== 'all' ? 1 : 0) +
    (filters.internType !== 'all' ? 1 : 0) +
    (filters.matchScore !== 'all' ? 1 : 0) +
    (filters.status !== 'all' ? 1 : 0) +
    (filters.sort !== 'best_match' ? 1 : 0);

  return (
    <div className="w-full pb-4 mb-4 border-b border-hairline-light dark:border-hairline-dark">
      {/* Desktop View: Clean horizontal controls */}
      <div className="hidden md:flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick chip 1: Remote */}
          <button
            onClick={() => update('region', filters.region === 'nigeria' ? 'all' : 'nigeria')}
            className={cn(
              'hit-slop text-xs py-1.5 px-3 rounded-[8px] border transition-colors',
              filters.region === 'nigeria'
                ? 'badge-brass font-semibold'
                : 'bg-background-light dark:bg-background-dark border-hairline-light dark:border-hairline-dark text-muted-light dark:text-muted-dark hover:text-ink-light'
            )}
          >
            Remote (Open to Nigeria)
          </button>

          {/* Quick chip 2: Lagos */}
          <button
            onClick={() => update('region', filters.region === 'lagos' ? 'all' : 'lagos')}
            className={cn(
              'hit-slop text-xs py-1.5 px-3 rounded-[8px] border transition-colors',
              filters.region === 'lagos'
                ? 'badge-brass font-semibold'
                : 'bg-background-light dark:bg-background-dark border-hairline-light dark:border-hairline-dark text-muted-light dark:text-muted-dark hover:text-ink-light'
            )}
          >
            Lagos Onsite
          </button>

          {/* Type dropdown */}
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

          {/* Status dropdown */}
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

          {/* Sort dropdown */}
          <select
            aria-label="Sort listings"
            value={filters.sort}
            onChange={(e) => update('sort', e.target.value)}
            className="text-xs py-1.5 px-2.5 rounded-[8px] bg-background-light dark:bg-background-dark border border-hairline-light dark:border-hairline-dark text-ink-light dark:text-ink-dark focus:outline-none focus:ring-1 focus:ring-brass-light"
          >
            <option value="best_match">Sort: Highest Score</option>
            <option value="deadline">Sort: Deadline</option>
            <option value="newest">Sort: Newest</option>
          </select>
        </div>

        {/* Count & Reset */}
        <div className="flex items-center space-x-3 text-xs text-muted-light dark:text-muted-dark">
          <span className="tabular-nums">
            Showing <strong className="text-ink-light dark:text-ink-dark">{filteredCount}</strong> of {totalCount} verified
          </span>
          {activeFilterCount > 0 && (
            <button
              onClick={resetFilters}
              aria-label="Reset all filters"
              className="flex items-center space-x-1 hover:text-ink-light dark:hover:text-ink-dark transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile View: Quick chips row + Filters sheet trigger */}
      <div className="md:hidden flex items-center justify-between gap-2 overflow-x-auto py-1">
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => update('region', filters.region === 'nigeria' ? 'all' : 'nigeria')}
            className={cn(
              'hit-slop text-xs py-1.5 px-3 rounded-[8px] border shrink-0',
              filters.region === 'nigeria'
                ? 'badge-brass font-semibold'
                : 'bg-background-light dark:bg-background-dark border-hairline-light dark:border-hairline-dark text-muted-light'
            )}
          >
            Remote
          </button>
          <button
            onClick={() => update('region', filters.region === 'lagos' ? 'all' : 'lagos')}
            className={cn(
              'hit-slop text-xs py-1.5 px-3 rounded-[8px] border shrink-0',
              filters.region === 'lagos'
                ? 'badge-brass font-semibold'
                : 'bg-background-light dark:bg-background-dark border-hairline-light dark:border-hairline-dark text-muted-light'
            )}
          >
            Lagos Onsite
          </button>
        </div>

        <button
          onClick={() => setSheetOpen(true)}
          aria-label="Open filter options"
          className="hit-slop flex items-center space-x-1.5 text-xs py-1.5 px-3 rounded-[8px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark text-ink-light dark:text-ink-dark shrink-0"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-brass-light dark:bg-brass-dark text-[10px] text-white flex items-center justify-center font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Mobile Bottom Sheet for Filters */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-background-light dark:bg-background-dark border-t border-hairline-light dark:border-hairline-dark rounded-t-[16px] p-6 space-y-4 safe-bottom animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-hairline-light dark:border-hairline-dark">
              <span className="font-serif font-bold text-lg text-ink-light dark:text-ink-dark">Filters</span>
              <button
                onClick={() => setSheetOpen(false)}
                aria-label="Close filters"
                className="hit-slop p-1 text-muted-light hover:text-ink-light"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="editorial-label block mb-1">Region Target</label>
                <select
                  value={filters.region}
                  onChange={(e) => update('region', e.target.value)}
                  className="w-full py-2 px-3 rounded-[8px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark text-ink-light dark:text-ink-dark"
                >
                  <option value="all">All Eligible Regions</option>
                  <option value="nigeria">Remote (Open to Nigeria / Worldwide)</option>
                  <option value="lagos">Lagos (Onsite / Hybrid)</option>
                </select>
              </div>

              <div>
                <label className="editorial-label block mb-1">Internship Focus</label>
                <select
                  value={filters.internType}
                  onChange={(e) => update('internType', e.target.value)}
                  className="w-full py-2 px-3 rounded-[8px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark text-ink-light dark:text-ink-dark"
                >
                  <option value="all">All Tracks</option>
                  <option value="frontend">Frontend Intern</option>
                  <option value="software">Software Eng Intern</option>
                  <option value="fullstack">Fullstack Intern</option>
                </select>
              </div>

              <div>
                <label className="editorial-label block mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => update('status', e.target.value)}
                  className="w-full py-2 px-3 rounded-[8px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark text-ink-light dark:text-ink-dark"
                >
                  <option value="all">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="closing_soon">Closing Soon</option>
                </select>
              </div>

              <div>
                <label className="editorial-label block mb-1">Sort By</label>
                <select
                  value={filters.sort}
                  onChange={(e) => update('sort', e.target.value)}
                  className="w-full py-2 px-3 rounded-[8px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark text-ink-light dark:text-ink-dark"
                >
                  <option value="best_match">Highest Score</option>
                  <option value="deadline">Closing Soonest</option>
                  <option value="newest">Recently Discovered</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                onClick={resetFilters}
                className="text-xs text-muted-light hover:text-ink-light"
              >
                Reset Filters
              </button>
              <button
                onClick={() => setSheetOpen(false)}
                className="px-5 py-2 rounded-[8px] bg-ink-light text-background-light dark:bg-ink-dark dark:text-background-dark text-xs font-semibold"
              >
                Apply ({filteredCount})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
