'use client';

import React, { useState } from 'react';
import {
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Sparkles,
  Copy,
  Check,
  Printer,
  MapPin,
  Calendar,
  Clock,
  DollarSign,
  Quote,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { Listing, Application } from '../types';
import { cn, formatDeadline } from '../lib/utils';
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
  const isBestMatch = !listing.is_unverified && listing.final_score >= 80;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(listing.apply_url);
    setCopied(true);
    toast.success('Apply URL copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const breakdown = listing.score_breakdown || {
    experience_value: Math.round((listing.experience_value || 70) * 0.35),
    attainability: Math.round((listing.attainability || 65) * 0.35),
    paid_score: listing.paid === true ? 20 : 7,
    timing_fit: 5,
  };

  return (
    <div className="rounded-[12px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark p-6 sm:p-8 flex flex-col space-y-6">
      {/* Header info */}
      <div className="border-b border-hairline-light dark:border-hairline-dark pb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="editorial-label text-brass-light dark:text-brass-dark">{listing.company}</span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-ink-light dark:text-ink-dark mt-1 leading-tight text-balance">
              {listing.title}
            </h2>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => window.print()}
              aria-label="Print listing details"
              className="hit-slop p-2.5 rounded-[8px] border border-hairline-light dark:border-hairline-dark hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40 text-muted-light dark:text-muted-dark hover:text-ink-light dark:hover:text-ink-dark transition-colors"
            >
              <Printer className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <button
              onClick={handleCopyLink}
              aria-label="Copy apply link"
              className="hit-slop p-2.5 rounded-[8px] border border-hairline-light dark:border-hairline-dark hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40 text-muted-light dark:text-muted-dark hover:text-ink-light dark:hover:text-ink-dark transition-colors flex items-center space-x-1"
            >
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" strokeWidth={1.5} />}
              <span className="text-xs">{copied ? 'Copied' : 'Share'}</span>
            </button>
          </div>
        </div>

        {/* Accents row */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {isBestMatch && (
            <span className="text-xs font-semibold badge-brass px-2.5 py-1 rounded-[6px] tabular-nums">
              ★ Best Match ({listing.final_score}%)
            </span>
          )}

          <span
            className={cn(
              'text-xs px-2.5 py-1 rounded-[6px] border',
              listing.nigeria_eligibility === 'open' || listing.lagos_onsite
                ? 'border-green-600/30 text-green-700 dark:text-green-400 bg-green-50/50 dark:bg-green-950/20'
                : 'border-hairline-light dark:border-hairline-dark text-muted-light dark:text-muted-dark'
            )}
          >
            {listing.lagos_onsite ? 'Lagos, Nigeria (Onsite/Hybrid)' : 'Open to Nigeria / Worldwide'}
          </span>

          {deadlineInfo.isClosingSoon && (
            <span className="text-xs font-medium badge-brass px-2.5 py-1 rounded-[6px] tabular-nums">
              {deadlineInfo.text}
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
              <span className="text-ink-light dark:text-ink-dark font-medium tabular-nums">{listing.duration || 'Standard 8-16 weeks'}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <DollarSign className="w-4 h-4 shrink-0 text-ink-light dark:text-ink-dark" strokeWidth={1.5} />
            <div>
              <span className="editorial-label block text-[10px]">Compensation</span>
              <span className="text-ink-light dark:text-ink-dark font-medium">
                {listing.paid === true ? 'Paid / Stipend' : listing.paid === false ? 'Unpaid' : 'Stipend Unstated'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* "Why it ranks here" Section (Strict Formula Breakdown & Evidence Phrases) */}
      <div className="p-4 rounded-[8px] bg-hairline-light/25 dark:bg-hairline-dark/30 border border-hairline-light dark:border-hairline-dark space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <TrendingUp className="w-4 h-4 text-brass-light dark:text-brass-dark" />
            <span className="editorial-label text-brass-light dark:text-brass-dark">Why It Ranks Here</span>
          </div>
          <span className="text-xs font-serif font-bold text-ink-light dark:text-ink-dark tabular-nums">
            Total Score: {listing.final_score}/100
          </span>
        </div>

        {/* 4-Factor Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
          <div className="p-2 rounded bg-background-light dark:bg-background-dark border border-hairline-light dark:border-hairline-dark">
            <span className="text-[10px] text-muted-light dark:text-muted-dark block">Experience (35%)</span>
            <span className="text-xs font-bold tabular-nums text-ink-light dark:text-ink-dark">+{breakdown.experience_value}</span>
          </div>
          <div className="p-2 rounded bg-background-light dark:bg-background-dark border border-hairline-light dark:border-hairline-dark">
            <span className="text-[10px] text-muted-light dark:text-muted-dark block">Attainability (35%)</span>
            <span className="text-xs font-bold tabular-nums text-ink-light dark:text-ink-dark">+{breakdown.attainability}</span>
          </div>
          <div className="p-2 rounded bg-background-light dark:bg-background-dark border border-hairline-light dark:border-hairline-dark">
            <span className="text-[10px] text-muted-light dark:text-muted-dark block">Paid Status (20%)</span>
            <span className="text-xs font-bold tabular-nums text-ink-light dark:text-ink-dark">+{breakdown.paid_score}</span>
          </div>
          <div className="p-2 rounded bg-background-light dark:bg-background-dark border border-hairline-light dark:border-hairline-dark">
            <span className="text-[10px] text-muted-light dark:text-muted-dark block">Timing Fit (10%)</span>
            <span className="text-xs font-bold tabular-nums text-ink-light dark:text-ink-dark">+{breakdown.timing_fit}</span>
          </div>
        </div>

        {/* Direct Quote Evidence from Posting */}
        {listing.evidence && (
          <div className="mt-2 space-y-1.5 text-xs text-muted-light dark:text-muted-dark border-t border-hairline-light/60 dark:border-hairline-dark/60 pt-2.5">
            <div className="flex items-start space-x-1.5">
              <Quote className="w-3.5 h-3.5 shrink-0 mt-0.5 text-brass-light dark:text-brass-dark" />
              <span>
                <strong className="text-ink-light dark:text-ink-dark font-medium">Work mode evidence:</strong> "{listing.evidence.work_mode_quote}"
              </span>
            </div>
            <div className="flex items-start space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-brass-light dark:text-brass-dark" />
              <span>
                <strong className="text-ink-light dark:text-ink-dark font-medium">Eligibility evidence:</strong> "{listing.evidence.nigeria_eligibility_quote}"
              </span>
            </div>
          </div>
        )}
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

      {/* Role Description */}
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
            'hit-slop min-h-[44px] px-5 py-2.5 rounded-[8px] text-xs font-semibold flex items-center space-x-2 transition-colors',
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
            className="hit-slop min-h-[44px] px-4 py-2.5 rounded-[8px] text-xs font-medium border border-hairline-light dark:border-hairline-dark hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40 text-ink-light dark:text-ink-dark flex items-center space-x-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-brass-light dark:text-brass-dark" />
            <span>Draft Cold Pitch</span>
          </button>

          <a
            href={listing.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            className="hit-slop min-h-[44px] px-5 py-2.5 rounded-[8px] text-xs font-medium bg-ink-light text-background-light dark:bg-ink-dark dark:text-background-dark hover:opacity-90 transition-opacity flex items-center space-x-1.5"
          >
            <span>Apply Directly</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
