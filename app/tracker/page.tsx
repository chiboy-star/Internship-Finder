'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle,
  Clock,
  ExternalLink,
  Trash2,
  Edit3,
  TrendingUp,
  Sparkles,
  Download,
  Upload,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { Listing, Application, ApplicationStatus, UserProfile } from '@/types';
import { getAllApplications, saveApplication, removeApplication, exportAllData, importAllData, getSetting, saveSetting } from '@/lib/db';
import { cn, formatDeadline } from '@/lib/utils';
import { PitchModal } from '@/components/PitchModal';
import { toast } from 'sonner';

const STATUS_COLUMNS: { key: ApplicationStatus; label: string }[] = [
  { key: 'saved', label: 'Saved' },
  { key: 'applied', label: 'Applied' },
  { key: 'interviewing', label: 'Interviewing' },
  { key: 'offer', label: 'Offer' },
  { key: 'rejected', label: 'Rejected' },
];

export default function TrackerPage() {
  const { data: feedData } = useQuery<{ listings: Listing[] }>({
    queryKey: ['feed-data'],
    queryFn: async () => {
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error('Failed to load feed data');
      return res.json();
    },
  });

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const res = await fetch('/config/profile.json');
      if (!res.ok) return {} as UserProfile;
      return res.json();
    },
  });

  const listings = feedData?.listings || [];
  const listingsMap = useMemo(() => new Map(listings.map((l) => [l.id, l])), [listings]);

  const [applications, setApplications] = useState<Record<string, Application>>({});
  const [goalCount, setGoalCount] = useState(15);
  const [editingGoal, setEditingGoal] = useState(false);
  const [pitchTarget, setPitchTarget] = useState<Listing | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  // Load IndexedDB state on mount
  useEffect(() => {
    getAllApplications().then(setApplications);
    getSetting('application_goal', 15).then(setGoalCount);
  }, []);

  // Compute Goal-gradient progress
  const appliedOrLaterCount = useMemo(() => {
    return Object.values(applications).filter(
      (a) => a.status === 'applied' || a.status === 'interviewing' || a.status === 'offer'
    ).length;
  }, [applications]);

  // Skill-gap view calculation:
  // Count skills in saved/applied listings that are not in user's profile
  const skillGaps = useMemo(() => {
    const userSkills = new Set(
      (profile?.core_skills || ['React', 'Next.js', 'JavaScript', 'TypeScript', 'HTML', 'CSS', 'Tailwind CSS'])
        .concat(profile?.backend_and_tools || ['Supabase', 'Git', 'GitHub', 'Vercel'])
        .map((s) => s.toLowerCase().trim())
    );

    const counts: Record<string, number> = {};

    for (const app of Object.values(applications)) {
      if (app.status === 'dismissed') continue;
      const listing = listingsMap.get(app.listing_or_company_id);
      if (!listing || !listing.skills) continue;

      for (const skill of listing.skills) {
        const norm = skill.trim();
        if (!userSkills.has(norm.toLowerCase())) {
          counts[norm] = (counts[norm] || 0) + 1;
        }
      }
    }

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [applications, listingsMap, profile]);

  // Update status optimistically with undo toast
  const handleStatusChange = async (appId: string, newStatus: ApplicationStatus) => {
    const previous = applications[appId];
    if (!previous) return;

    const updated: Application = {
      ...previous,
      status: newStatus,
      dates: {
        ...previous.dates,
        [`${newStatus}_at`]: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    };

    setApplications((prev) => ({ ...prev, [appId]: updated }));
    await saveApplication(updated);

    toast.success(`Status updated to "${newStatus}"`, {
      action: {
        label: 'Undo',
        onClick: async () => {
          setApplications((prev) => ({ ...prev, [appId]: previous }));
          await saveApplication(previous);
          toast.info('Status change undone');
        },
      },
    });
  };

  // Remove application
  const handleRemove = async (appId: string) => {
    const previous = applications[appId];
    if (!previous) return;

    setApplications((prev) => {
      const copy = { ...prev };
      delete copy[appId];
      return copy;
    });
    await removeApplication(appId);

    toast.info('Application removed from tracker', {
      action: {
        label: 'Undo',
        onClick: async () => {
          setApplications((prev) => ({ ...prev, [appId]: previous }));
          await saveApplication(previous);
          toast.success('Restored application');
        },
      },
    });
  };

  // Save notes
  const handleSaveNotes = async (appId: string) => {
    const app = applications[appId];
    if (!app) return;

    const updated = { ...app, notes: noteText, updated_at: new Date().toISOString() };
    setApplications((prev) => ({ ...prev, [appId]: updated }));
    await saveApplication(updated);
    setEditingNotesId(null);
    toast.success('Notes saved');
  };

  // Export CSV
  const handleExportCSV = () => {
    const rows = [
      ['Company', 'Title', 'Status', 'Location', 'Match Score', 'Deadline', 'Apply URL', 'Notes'],
    ];

    for (const app of Object.values(applications)) {
      if (app.status === 'dismissed') continue;
      const listing = listingsMap.get(app.listing_or_company_id);
      rows.push([
        listing?.company || 'Custom Company',
        listing?.title || 'Internship',
        app.status,
        listing?.location || 'Remote',
        listing ? `${listing.match_score}%` : 'N/A',
        listing?.deadline || 'Rolling',
        listing?.apply_url || '',
        `"${(app.notes || '').replace(/"/g, '""')}"`,
      ]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `summer-2027-internship-tracker-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exported tracker CSV');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
      {/* Header & Goal-Gradient Progress */}
      <div className="mb-8 border-b border-hairline-light dark:border-hairline-dark pb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="editorial-label text-brass-light dark:text-brass-dark">Pipeline Management</span>
            <h1 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-ink-light dark:text-ink-dark mt-1 text-balance">
              Application Tracker
            </h1>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportCSV}
              className="hit-slop flex items-center space-x-1.5 px-3 py-2 text-xs font-medium rounded-[8px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-muted-light dark:text-muted-dark" strokeWidth={1.5} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Goal-Gradient Card */}
        <div className="mt-6 p-6 rounded-[12px] border border-hairline-light dark:border-hairline-dark bg-hairline-light/20 dark:bg-hairline-dark/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5 w-full sm:w-auto">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-brass-light dark:text-brass-dark" />
              <span className="editorial-label">Goal-Gradient Progress</span>
            </div>
            <div className="text-xl sm:text-2xl font-serif font-bold text-ink-light dark:text-ink-dark tabular-nums">
              {appliedOrLaterCount} of {goalCount} applications sent
            </div>
            <p className="text-xs text-muted-light dark:text-muted-dark">
              Aiming for {goalCount} tailored Summer 2027 applications gives you the highest conversion without burnout.
            </p>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            <div className="w-36 h-2 bg-hairline-light dark:bg-hairline-dark rounded-full overflow-hidden">
              <div
                className="h-full bg-brass-light dark:bg-brass-dark transition-all duration-300"
                style={{ width: `${Math.min(100, (appliedOrLaterCount / (goalCount || 1)) * 100)}%` }}
              />
            </div>
            {editingGoal ? (
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={goalCount}
                  onChange={(e) => setGoalCount(parseInt(e.target.value) || 15)}
                  className="w-16 px-2 py-1 text-xs border rounded bg-background-light dark:bg-background-dark"
                />
                <button
                  onClick={() => {
                    saveSetting('application_goal', goalCount);
                    setEditingGoal(false);
                  }}
                  className="text-xs px-2 py-1 bg-ink-light text-background-light dark:bg-ink-dark dark:text-background-dark rounded"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingGoal(true)}
                className="text-xs text-muted-light dark:text-muted-dark hover:underline"
              >
                Set Goal
              </button>
            )}
          </div>
        </div>

        {/* Skill-Gap Insights Card */}
        {skillGaps.length > 0 && (
          <div className="mt-4 p-4 rounded-[12px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-brass-light dark:text-brass-dark" />
              <span className="editorial-label">Skill-Gap Insights</span>
            </div>
            <span className="text-xs text-muted-light dark:text-muted-dark">
              Most requested skills across your saved roles not yet in your profile:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {skillGaps.map((item) => (
                <span
                  key={item.name}
                  className="text-xs px-2.5 py-0.5 rounded-[4px] border border-hairline-light dark:border-hairline-dark bg-hairline-light/30 dark:bg-hairline-dark/30 font-medium tabular-nums"
                >
                  {item.name} <strong className="text-brass-light dark:text-brass-dark">({item.count})</strong>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Kanban / Status Board with Sticky Column Headers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {STATUS_COLUMNS.map((col) => {
          const colApps = Object.values(applications).filter((a) => a.status === col.key);

          return (
            <div
              key={col.key}
              className="flex flex-col rounded-[12px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark min-h-[450px]"
            >
              {/* Sticky Column Header */}
              <div className="sticky top-16 z-10 px-4 py-3 border-b border-hairline-light dark:border-hairline-dark bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm flex items-center justify-between rounded-t-[12px]">
                <span className="editorial-label font-bold text-ink-light dark:text-ink-dark">
                  {col.label}
                </span>
                <span className="text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full bg-hairline-light/50 dark:bg-hairline-dark/50 text-muted-light dark:text-muted-dark">
                  {colApps.length}
                </span>
              </div>

              {/* Column Content */}
              <div className="p-3 flex-1 space-y-3 overflow-y-auto">
                {colApps.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-center p-4 text-xs text-muted-light/60 dark:text-muted-dark/60">
                    No roles in {col.label.toLowerCase()}
                  </div>
                ) : (
                  colApps.map((app) => {
                    const listing = listingsMap.get(app.listing_or_company_id);
                    const deadlineInfo = formatDeadline(listing?.deadline || null);

                    return (
                      <div
                        key={app.listing_or_company_id}
                        className="p-4 rounded-[8px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark space-y-2.5 transition-shadow hover:border-muted-light/40"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="editorial-label text-[10px] text-muted-light dark:text-muted-dark block">
                              {listing?.company || 'Company'}
                            </span>
                            <h4 className="font-serif font-bold text-sm text-ink-light dark:text-ink-dark leading-snug">
                              {listing?.title || 'Software Engineering Intern'}
                            </h4>
                          </div>

                          {listing && (
                            <span
                              className={cn(
                                'text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded border shrink-0',
                                listing.match_score >= 85
                                  ? 'badge-brass'
                                  : 'bg-hairline-light/30 border-hairline-light dark:border-hairline-dark text-muted-light dark:text-muted-dark'
                              )}
                            >
                              {listing.match_score}%
                            </span>
                          )}
                        </div>

                        {/* Location and Deadline */}
                        <div className="text-[11px] text-muted-light dark:text-muted-dark space-y-1">
                          <div>{listing?.location || 'Remote'}</div>
                          {deadlineInfo.isClosingSoon && (
                            <div className="badge-brass text-[10px] px-1.5 py-0.5 rounded inline-block font-medium tabular-nums">
                              {deadlineInfo.text}
                            </div>
                          )}
                        </div>

                        {/* Notes preview or editor */}
                        {editingNotesId === app.listing_or_company_id ? (
                          <div className="space-y-1.5 pt-1">
                            <textarea
                              value={noteText}
                              onChange={(e) => setNoteText(e.target.value)}
                              placeholder="Interview notes, recruiter info, next steps..."
                              className="w-full text-xs p-2 rounded border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark text-ink-light dark:text-ink-dark resize-none focus:outline-none"
                              rows={3}
                            />
                            <div className="flex items-center space-x-1.5 justify-end">
                              <button
                                onClick={() => setEditingNotesId(null)}
                                className="text-[10px] px-2 py-0.5 text-muted-light"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveNotes(app.listing_or_company_id)}
                                className="text-[10px] px-2 py-0.5 bg-ink-light text-background-light dark:bg-ink-dark dark:text-background-dark rounded font-medium"
                              >
                                Save Note
                              </button>
                            </div>
                          </div>
                        ) : (
                          app.notes && (
                            <p
                              onClick={() => {
                                setEditingNotesId(app.listing_or_company_id);
                                setNoteText(app.notes);
                              }}
                              className="text-xs p-2 rounded bg-hairline-light/20 dark:bg-hairline-dark/20 text-ink-light/80 dark:text-ink-dark/80 italic cursor-pointer line-clamp-2"
                            >
                              "{app.notes}"
                            </p>
                          )
                        )}

                        {/* Card footer controls */}
                        <div className="pt-2 border-t border-hairline-light/60 dark:border-hairline-dark/60 flex items-center justify-between text-xs">
                          {/* Move to another status */}
                          <select
                            value={app.status}
                            onChange={(e) => handleStatusChange(app.listing_or_company_id, e.target.value as ApplicationStatus)}
                            className="text-[10px] py-1 px-1.5 rounded border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark text-ink-light dark:text-ink-dark"
                          >
                            {STATUS_COLUMNS.map((s) => (
                              <option key={s.key} value={s.key}>
                                Move: {s.label}
                              </option>
                            ))}
                          </select>

                          <div className="flex items-center space-x-1">
                            {listing && (
                              <button
                                onClick={() => setPitchTarget(listing)}
                                title="Draft Pitch"
                                className="p-1 rounded hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40 text-muted-light dark:text-muted-dark hover:text-ink-light dark:hover:text-ink-dark"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-brass-light dark:text-brass-dark" />
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setEditingNotesId(app.listing_or_company_id);
                                setNoteText(app.notes || '');
                              }}
                              title="Edit Notes"
                              className="p-1 rounded hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40 text-muted-light dark:text-muted-dark hover:text-ink-light dark:hover:text-ink-dark"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleRemove(app.listing_or_company_id)}
                              title="Remove from Tracker"
                              className="p-1 rounded hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40 text-muted-light hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pitch Modal */}
      {pitchTarget && (
        <PitchModal
          isOpen={Boolean(pitchTarget)}
          onClose={() => setPitchTarget(null)}
          companyName={pitchTarget.company}
          companyContext={pitchTarget.requirements || pitchTarget.description_snippet}
        />
      )}
    </div>
  );
}

