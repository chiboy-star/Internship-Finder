'use client';

import React, { useState } from 'react';
import { ExternalLink, Bookmark, BookmarkCheck, Sparkles, Copy, Check, Printer, AlertTriangle, MapPin, Calendar, Clock, Globe } from 'lucide-react';
import { Listing, Application } from '../types';
import { cn, formatDeadline, formatRelativeTime } from '../lib/utils';
import { toast } from 'sonner';

interface ListingDetailPaneProps {
  listing: Listing | null;
  application?: Application;
  onSave: (listing: Listing) => void;
  onOpenPitch: (listing: Listing) => void;
  onClose?: () => void;
}

export function ListingDetailPane({
  listing,
  application,
  onSave,
  onOpenPitch,
  onClose,
}: ListingDetailPaneProps) {
  const [copied, setCopied] = useState(false);

  if (!listing) {
    return (
      <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-8 text-center rounded-[12px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark">
        <p className="font-serif text-lg text-muted-light dark:text-muted-dark">
          Select an internship to view full details and analysis.
        </p>
        <p className="text-xs text-muted-light/70 dark:text-muted-dark/70 mt-2">
          Use J / K to navigate listings quickly.
        </p>
      </div>
    );
  }

  const isSaved = application?.status === 'saved' || application?.status === 'applied' || application?.status === 'interviewing';
  const deadlineInfo = formatDeadline(listing.deadline);
  const isBestMatch = listing.match_score >= 85;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(listing.apply_url);
    setCopied(true);
    toast.success('Apply URL copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-[12px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark p-6 sm:p-8 flex flex-col space-y-6">
      {/* Header info */}
      <div className="border-b border-hairline-light dark:border-hairline-dark pb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="editorial-label text-brass-light dark:text-brass-dark">{listing.company}</span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-ink-light dark:text-ink-dark mt-1 leading-tight">
              {listing.title}
            </h2>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => window.print()}
              aria-label="Print listing details"
              className="hit-slop p-2 rounded-[8px] border border-hairline-light dark:border-hairline-dark hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40 text-muted-light dark:text-muted-dark hover:text-ink-light dark:hover:text-ink-dark transition-colors"
            >
              <Printer className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <button
              onClick={handleCopyLink}
              aria-label="Copy apply link"
              className="hit-slop p-2 rounded-[8px] border border-hairline-light dark:border-hairline-dark hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40 text-muted-light dark:text-muted-dark hover:text-ink-light dark:hover:text-ink-dark transition-colors flex items-center space-x-1"
            >
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" strokeWidth={1.5} />}
              <span className="text-xs">{copied ? 'Copied' : 'Share'}</span>
            </button>
          </div>
        </div>

        {/* Status badges */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'text-xs font-semibold tabular-nums px-2.5 py-1 rounded-[8px] border',
              isBestMatch
                ? 'badge-brass'
                : 'bg-hairline-light/40 dark:bg-hairline-dark/40 border-hairline-light dark:border-hairline-dark text-ink-light dark:text-ink-dark'
            )}
          >
            {listing.match_score}% Match Score
          </span>

          <span
            className={cn(
              'text-xs px-2.5 py-1 rounded-[8px] border',
              listing.eligibility === 'open_to_nigeria'
                ? 'border-green-600/30 text-green-700 dark:text-green-400 bg-green-50/50 dark:bg-green-950/20'
                : listing.eligibility === 'region_locked'
                ? 'border-amber-600/30 text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20'
                : 'border-hairline-light dark:border-hairline-dark text-muted-light dark:text-muted-dark'
            )}
          >
            {listing.eligibility === 'open_to_nigeria'
              ? 'Open to Nigeria / Worldwide'
              : listing.eligibility === 'region_locked'
              ? 'Region-Locked (US/UK only)'
              : 'Eligibility Unclear'}
          </span>

          {deadlineInfo.isClosingSoon && (
            <span className="text-xs font-medium badge-brass px-2.5 py-1 rounded-[8px] tabular-nums">
              {deadlineInfo.text}
            </span>
          )}

          {listing.flags && listing.flags.includes('scam_pay_to_apply') && (
            <span className="text-xs px-2.5 py-1 rounded-[8px] bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Pay-to-Apply Flag
            </span>
          )}
        </div>

        {/* Fact grid */}
        <div className="mt-5 grid grid-cols-2 gap-4 text-xs text-muted-light dark:text-muted-dark">
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 shrink-0 text-ink-light dark:text-ink-dark" strokeWidth={1.5} />
            <div>
              <span className="editorial-label block text-[10px]">Location</span>
              <span className="text-ink-light dark:text-ink-dark font-medium">{listing.location} ({listing.work_mode})</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 shrink-0 text-ink-light dark:text-ink-dark" strokeWidth={1.5} />
            <div>
              <span className="editorial-label block text-[10px]">Start Window</span>
              <span className="text-ink-light dark:text-ink-dark font-medium">{listing.start_window || 'Summer 2027'}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 shrink-0 text-ink-light dark:text-ink-dark" strokeWidth={1.5} />
            <div>
              <span className="editorial-label block text-[10px]">Duration</span>
              <span className="text-ink-light dark:text-ink-dark font-medium tabular-nums">{listing.duration || 'Standard 10-12 weeks'}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 shrink-0 text-ink-light dark:text-ink-dark" strokeWidth={1.5} />
            <div>
              <span className="editorial-label block text-[10px]">Source</span>
              <a
                href={listing.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink-light dark:text-ink-dark underline hover:opacity-80 capitalize"
              >
                {listing.source}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Match Reason Section */}
      <div className="p-4 rounded-[8px] bg-hairline-light/20 dark:bg-hairline-dark/30 border border-hairline-light dark:border-hairline-dark">
        <span className="editorial-label text-brass-light dark:text-brass-dark">Profile Match Analysis</span>
        <p className="mt-1 text-sm text-ink-light dark:text-ink-dark leading-relaxed font-serif">
          "{listing.match_reason}"
        </p>
      </div>

      {/* Required Skills */}
      {listing.skills && listing.skills.length > 0 && (
        <div>
          <span className="editorial-label block mb-2">Required & Relevant Skills</span>
          <div className="flex flex-wrap gap-1.5">
            {listing.skills.map((skill) => (
              <span
                key={skill}
                className="text-xs px-2.5 py-1 rounded-[6px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark text-ink-light dark:text-ink-dark font-sans"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Role Requirements / Description snippet */}
      {listing.requirements && (
        <div className="space-y-2">
          <span className="editorial-label block">Listing Overview</span>
          <p className="text-sm text-ink-light/90 dark:text-ink-dark/90 leading-relaxed font-sans whitespace-pre-line">
            {listing.requirements}
          </p>
        </div>
      )}

      {/* Bottom Actions */}
      <div className="pt-4 border-t border-hairline-light dark:border-hairline-dark flex items-center justify-between gap-3">
        <button
          onClick={() => onSave(listing)}
          className={cn(
            'hit-slop flex items-center space-x-2 py-2.5 px-5 rounded-[8px] text-xs font-semibold transition-colors',
            isSaved
              ? 'bg-hairline-light/60 dark:bg-hairline-dark/60 text-ink-light dark:text-ink-dark border border-hairline-light dark:border-hairline-dark'
              : 'bg-ink-light text-background-light dark:bg-ink-dark dark:text-background-dark hover:opacity-90'
          )}
        >
          {isSaved ? <BookmarkCheck className="w-4 h-4 text-brass-light dark:text-brass-dark" /> : <Bookmark className="w-4 h-4" />}
          <span>{isSaved ? 'Saved in Tracker' : 'Save to Tracker'}</span>
        </button>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onOpenPitch(listing)}
            className="hit-slop flex items-center space-x-1.5 py-2.5 px-4 rounded-[8px] text-xs font-medium border border-hairline-light dark:border-hairline-dark hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40 text-ink-light dark:text-ink-dark transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-brass-light dark:text-brass-dark" />
            <span>Draft Pitch</span>
          </button>

          <a
            href={listing.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            className="hit-slop flex items-center space-x-1.5 py-2.5 px-5 rounded-[8px] text-xs font-medium bg-ink-light text-background-light dark:bg-ink-dark dark:text-background-dark hover:opacity-90 transition-opacity"
          >
            <span>Apply Directly</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

