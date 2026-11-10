'use client';

import React, { useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Sparkles,
  MapPin,
  Calendar,
  Clock,
  DollarSign,
  MoreHorizontal,
  EyeOff,
  Share2,
} from 'lucide-react';
import { Listing, Application } from '../types';
import { cn, formatDeadline } from '../lib/utils';
import { toast } from 'sonner';

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
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const isSaved = application?.status === 'saved' || application?.status === 'applied' || application?.status === 'interviewing';
  const deadlineInfo = formatDeadline(listing.deadline);

  // Best Match badge ONLY if >=80 and all gates passed, AND not unverified
  const isBestMatch = !listing.is_unverified && listing.final_score >= 80;

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(listing.apply_url);
    toast.success('Apply URL copied to clipboard');
    setShowMoreMenu(false);
  };

  return (
    <div
      onClick={() => onSelect(listing)}
      className={cn(
        'group relative p-4 sm:p-6 rounded-[12px] border bg-background-light dark:bg-background-dark cursor-pointer transition-all duration-200 focus-within:ring-1 focus-within:ring-brass-light w-full',
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
      {/* 1. Top row: Company name gets the FULL WIDTH (no crowded badge on mobile) */}
      <div className="w-full">
        <span className="editorial-label text-muted-light dark:text-muted-dark block">
          {listing.company}
        </span>
        <h3 className="font-serif text-[20px] sm:text-2xl font-bold tracking-tight text-ink-light dark:text-ink-dark mt-1 leading-[1.2] line-clamp-3 text-balance">
          {listing.title}
        </h3>
      </div>

      {/* 2. Meta row: Location, Work mode, Paid status, Start window, Duration, and Score */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-light dark:text-muted-dark">
        <span className="inline-flex items-center gap-1 font-medium text-ink-light/90 dark:text-ink-dark/90">
          <MapPin className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
          <span>{listing.location} ({listing.work_mode})</span>
        </span>

        {/* Paid status as plain text with icon */}
        <span className="inline-flex items-center gap-0.5">
          <DollarSign className="w-3.5 h-3.5 text-brass-light dark:text-brass-dark shrink-0" strokeWidth={1.5} />
          <span>{listing.paid === true ? 'Paid' : listing.paid === false ? 'Unpaid' : 'Stipend Unstated'}</span>
        </span>

        <span className="inline-flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
          <span>{listing.start_window || 'Summer 2027'}</span>
        </span>

        {listing.duration && (
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
            <span className="tabular-nums">{listing.duration}</span>
          </span>
        )}

        {/* Rank score as plain text in meta row */}
        <span className="tabular-nums text-xs font-semibold text-ink-light dark:text-ink-dark ml-auto">
          Score: {listing.final_score}/100 {listing.is_unverified && '(Unverified)'}
        </span>
      </div>

      {/* 3. Badges row: Reserved ONLY for Best Match and Closing Soon */}
      {(isBestMatch || deadlineInfo.isClosingSoon) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {isBestMatch && (
            <span className="text-[11px] font-semibold badge-brass px-2.5 py-0.5 rounded-[6px] tabular-nums">
              ★ Best Match ({listing.final_score}%)
            </span>
          )}
          {deadlineInfo.isClosingSoon && (
            <span className="text-[11px] font-medium badge-brass px-2.5 py-0.5 rounded-[6px] tabular-nums">
              {deadlineInfo.text}
            </span>
          )}
        </div>
      )}

      {/* 4. Match Reason / Role Text snippet (ZERO templated filler) */}
      <p className="mt-3 text-xs sm:text-sm text-ink-light/80 dark:text-ink-dark/80 line-clamp-2 leading-relaxed">
        {listing.match_reason}
      </p>

      {/* 5. Exactly three skill chips */}
      {listing.skills && listing.skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {listing.skills.slice(0, 3).map((skill) => (
            <span
              key={skill}
              className="text-[11px] px-2 py-0.5 rounded-[4px] bg-hairline-light/40 dark:bg-hairline-dark/50 text-muted-light dark:text-muted-dark font-sans"
            >
              {skill}
            </span>
          ))}
          {listing.skills.length > 3 && (
            <span className="text-[11px] text-muted-light dark:text-muted-dark self-center">
              +{listing.skills.length - 3}
            </span>
          )}
        </div>
      )}

      {/* 6. Action row: Save primary (first), Apply next to it, secondary in labeled "More" menu. All 44x44px tap targets */}
      <div
        className="mt-4 pt-3.5 border-t border-hairline-light dark:border-hairline-dark flex items-center justify-between gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center space-x-2">
          {/* Primary Action: Save button */}
          <button
            onClick={() => onSave(listing)}
            aria-label={isSaved ? 'Saved to tracker' : 'Save to tracker'}
            className={cn(
              'hit-slop min-h-[44px] px-4 py-2 rounded-[8px] text-xs font-semibold flex items-center space-x-2 transition-colors',
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
            <span>{isSaved ? 'Saved' : 'Save'}</span>
          </button>

          {/* Secondary Action: Apply link right next to Save */}
          <a
            href={listing.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Apply directly to ${listing.title} at ${listing.company}`}
            className="hit-slop min-h-[44px] px-4 py-2 rounded-[8px] text-xs font-medium border border-hairline-light dark:border-hairline-dark hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40 text-ink-light dark:text-ink-dark flex items-center space-x-1.5 transition-colors"
          >
            <span>Apply</span>
            <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
          </a>
        </div>

        {/* Labeled "More" Menu with 44px tap area */}
        <div className="relative">
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            aria-label="More actions menu"
            className="hit-slop min-h-[44px] min-w-[44px] px-2.5 py-2 rounded-[8px] border border-hairline-light dark:border-hairline-dark hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40 text-xs font-medium text-ink-light dark:text-ink-dark flex items-center space-x-1"
          >
            <MoreHorizontal className="w-4 h-4" strokeWidth={1.5} />
            <span className="hidden sm:inline">More</span>
          </button>

          {showMoreMenu && (
            <div
              className="absolute right-0 bottom-full mb-2 w-48 rounded-[8px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark shadow-xl z-20 py-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onOpenPitch(listing);
                }}
                aria-label="Draft outreach pitch"
                className="w-full px-3 py-2 text-left text-xs text-ink-light dark:text-ink-dark hover:bg-hairline-light/50 dark:hover:bg-hairline-dark/50 flex items-center space-x-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-brass-light dark:text-brass-dark" />
                <span>Draft Cold Pitch</span>
              </button>

              <button
                onClick={handleShare}
                aria-label="Copy apply link"
                className="w-full px-3 py-2 text-left text-xs text-ink-light dark:text-ink-dark hover:bg-hairline-light/50 dark:hover:bg-hairline-dark/50 flex items-center space-x-2"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Copy Posting URL</span>
              </button>

              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onDismiss(listing);
                }}
                aria-label="Dismiss this listing"
                className="w-full px-3 py-2 text-left text-xs text-muted-light hover:text-red-600 hover:bg-hairline-light/50 dark:hover:bg-hairline-dark/50 flex items-center space-x-2"
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>Dismiss Listing</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
