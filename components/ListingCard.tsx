'use client';

import React from 'react';
import { Bookmark, BookmarkCheck, ExternalLink, Sparkles, MapPin, Calendar, Clock, EyeOff } from 'lucide-react';
import { Listing, Application } from '../types';
import { cn, formatDeadline } from '../lib/utils';

interface ListingCardProps {
  listing: Listing;
  application?: Application;
  isSelected?: boolean;
  onSelect: (listing: Listing) => void;
  onSave: (listing: Listing) => void;
  onDismiss: (listing: Listing) => void;
  onOpenPitch: (listing: Listing) => void;
}

export function ListingCard({
  listing,
  application,
  isSelected,
  onSelect,
  onSave,
  onDismiss,
  onOpenPitch,
}: ListingCardProps) {
  const isSaved = application?.status === 'saved' || application?.status === 'applied' || application?.status === 'interviewing';
  const deadlineInfo = formatDeadline(listing.deadline);
  const isBestMatch = listing.match_score >= 85;

  return (
    <div
      onClick={() => onSelect(listing)}
      className={cn(
        'group relative p-6 rounded-[12px] border bg-background-light dark:bg-background-dark cursor-pointer transition-all duration-200 focus-within:ring-1 focus-within:ring-brass-light',
        isSelected
          ? 'border-brass-light dark:border-brass-dark ring-1 ring-brass-light/30'
          : 'border-hairline-light dark:border-hairline-dark hover:border-muted-light/40 dark:hover:border-muted-dark/40'
      )}
      tabIndex={0}
      role="article"
      aria-label={`${listing.title} at ${listing.company}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(listing);
        } else if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          onSave(listing);
        } else if (e.key.toLowerCase() === 'd') {
          e.preventDefault();
          onDismiss(listing);
        }
      }}
    >
      {/* Top row: Company name & Accents (Best match & Closing soon) */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="editorial-label text-muted-light dark:text-muted-dark">{listing.company}</span>
          <h3 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-ink-light dark:text-ink-dark mt-0.5 leading-snug">
            {listing.title}
          </h3>
        </div>

        {/* Accents (Only brass used for best match & closing soon per spec) */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex items-center space-x-1.5">
            <span
              className={cn(
                'text-xs font-semibold tabular-nums px-2 py-0.5 rounded-[8px] border',
                isBestMatch
                  ? 'badge-brass'
                  : 'bg-hairline-light/30 dark:bg-hairline-dark/30 border-hairline-light dark:border-hairline-dark text-muted-light dark:text-muted-dark'
              )}
            >
              {listing.match_score}% {isBestMatch ? '★ Best Match' : 'Match'}
            </span>
          </div>

          {deadlineInfo.isClosingSoon && (
            <span className="text-[11px] font-medium badge-brass px-2 py-0.5 rounded-[8px] tabular-nums">
              {deadlineInfo.text}
            </span>
          )}
        </div>
      </div>

      {/* Facts block (Proximity Law: Location, Duration, Start Window) */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-light dark:text-muted-dark">
        <span className="inline-flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" strokeWidth={1.5} />
          {listing.location} ({listing.work_mode})
        </span>

        {listing.duration && (
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span className="tabular-nums">{listing.duration}</span>
          </span>
        )}

        <span className="inline-flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span>{listing.start_window || 'Summer 2027'}</span>
        </span>
      </div>

      {/* Match Reason snippet */}
      <p className="mt-3 text-xs sm:text-sm text-ink-light/80 dark:text-ink-dark/80 line-clamp-2 leading-relaxed">
        {listing.match_reason}
      </p>

      {/* Skills preview tags */}
      {listing.skills && listing.skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {listing.skills.slice(0, 5).map((skill) => (
            <span
              key={skill}
              className="text-[11px] px-2 py-0.5 rounded-[4px] bg-hairline-light/40 dark:bg-hairline-dark/50 text-muted-light dark:text-muted-dark font-sans"
            >
              {skill}
            </span>
          ))}
          {listing.skills.length > 5 && (
            <span className="text-[11px] text-muted-light dark:text-muted-dark self-center">
              +{listing.skills.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Actions Row (Serial Position & Fitts's Law: Save first, Apply last) */}
      <div className="mt-5 pt-4 border-t border-hairline-light dark:border-hairline-dark flex items-center justify-between gap-3" onClick={(e) => e.stopPropagation()}>
        {/* Save button: Primary biggest target */}
        <button
          onClick={() => onSave(listing)}
          aria-label={isSaved ? 'Saved to tracker' : 'Save to tracker (press S)'}
          className={cn(
            'hit-slop flex items-center space-x-2 py-2 px-4 rounded-[8px] text-xs font-semibold transition-colors',
            isSaved
              ? 'bg-hairline-light/60 dark:bg-hairline-dark/60 text-ink-light dark:text-ink-dark border border-hairline-light dark:border-hairline-dark'
              : 'bg-ink-light text-background-light dark:bg-ink-dark dark:text-background-dark hover:opacity-90'
          )}
        >
          {isSaved ? (
            <BookmarkCheck className="w-4 h-4 text-brass-light dark:text-brass-dark" strokeWidth={1.5} />
          ) : (
            <Bookmark className="w-4 h-4" strokeWidth={1.5} />
          )}
          <span>{isSaved ? 'Saved in Tracker' : 'Save Listing'}</span>
          <kbd className="hidden sm:inline-block ml-1 text-[10px] opacity-75 font-normal">S</kbd>
        </button>

        {/* Middle action: Outreach Pitch & Dismiss */}
        <div className="flex items-center space-x-1 sm:space-x-2">
          <button
            onClick={() => onOpenPitch(listing)}
            aria-label="Draft outreach pitch"
            className="hit-slop p-2 text-muted-light dark:text-muted-dark hover:text-ink-light dark:hover:text-ink-dark rounded-[8px] hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40 text-xs flex items-center space-x-1 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-brass-light dark:text-brass-dark" />
            <span className="hidden sm:inline">Pitch</span>
          </button>

          <button
            onClick={() => onDismiss(listing)}
            aria-label="Dismiss listing (press D)"
            className="hit-slop p-2 text-muted-light dark:text-muted-dark hover:text-ink-light dark:hover:text-ink-dark rounded-[8px] hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40 text-xs flex items-center space-x-1 transition-colors"
          >
            <EyeOff className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span className="hidden sm:inline">Dismiss</span>
          </button>

          {/* Apply button: End position */}
          <a
            href={listing.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Apply to ${listing.title} at ${listing.company} (opens in new tab)`}
            className="hit-slop flex items-center space-x-1.5 py-2 px-3.5 rounded-[8px] text-xs font-medium border border-hairline-light dark:border-hairline-dark hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40 transition-colors text-ink-light dark:text-ink-dark"
          >
            <span>Apply</span>
            <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
          </a>
        </div>
      </div>
    </div>
  );
}

