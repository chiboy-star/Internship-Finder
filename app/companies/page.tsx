'use client';

import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { Company, Contact } from '@/types';
import { PitchModal } from '@/components/PitchModal';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function CompaniesPage() {
  const queryClient = useQueryClient();
  const { data: feedData, isLoading } = useQuery<{ companies: Company[] }>({
    queryKey: ['feed-data'],
    queryFn: async () => {
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error('Failed to load companies data');
      return res.json();
    },
  });

  const companies = feedData?.companies || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [pitchTargetCompany, setPitchTargetCompany] = useState<Company | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form state
  const [companyName, setCompanyName] = useState('');
  const [careersUrl, setCareersUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);
  const [formError, setFormError] = useState('');

  // Filtered companies
  const filteredCompanies = useMemo(() => {
    if (!searchQuery.trim()) return companies;
    const query = searchQuery.toLowerCase().trim();
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.region.toLowerCase().includes(query) ||
        (c.notes && c.notes.toLowerCase().includes(query))
    );
  }, [companies, searchQuery]);

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

      {/* Search Input */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-light dark:text-muted-dark" strokeWidth={1.5} />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter companies by name, location, or notes..."
          className="w-full pl-10 pr-4 py-2.5 rounded-[12px] bg-background-light dark:bg-background-dark border border-hairline-light dark:border-hairline-dark text-xs sm:text-sm text-ink-light dark:text-ink-dark placeholder-muted-light dark:placeholder-muted-dark focus:outline-none focus:ring-1 focus:ring-brass-light"
        />
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

            return (
              <div
                key={company.id}
                className="p-6 rounded-[12px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark flex flex-col justify-between space-y-4 hover:border-muted-light/40 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="editorial-label text-brass-light dark:text-brass-dark">
                        {company.takes_interns ? '★ Takes Interns' : 'Company'}
                      </span>
                      <h3 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-ink-light dark:text-ink-dark mt-0.5">
                        {company.name}
                      </h3>
                    </div>

                    <a
                      href={company.careers_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open Careers Page"
                      className="hit-slop p-1.5 rounded-[8px] border border-hairline-light dark:border-hairline-dark text-muted-light hover:text-ink-light dark:hover:text-ink-dark"
                    >
                      <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
                    </a>
                  </div>

                  <div className="mt-2 flex items-center text-xs text-muted-light dark:text-muted-dark space-x-1">
                    <MapPin className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span>{company.region}</span>
                  </div>

                  {company.notes && (
                    <p className="mt-3 text-xs text-ink-light/80 dark:text-ink-dark/80 line-clamp-3 leading-relaxed">
                      {company.notes}
                    </p>
                  )}

                  {/* Public Contact Links (Never guess email per Hard Rule 4) */}
                  <div className="mt-4 pt-3 border-t border-hairline-light dark:border-hairline-dark space-y-2">
                    <span className="editorial-label text-[10px] block">Verified Contact Route</span>

                    {company.contacts && company.contacts.length > 0 && company.contacts[0].email ? (
                      <div className="text-xs">
                        <span className="font-medium text-ink-light dark:text-ink-dark">{company.contacts[0].name}: </span>
                        <a href={`mailto:${company.contacts[0].email}`} className="text-brass-light dark:text-brass-dark underline">
                          {company.contacts[0].email}
                        </a>
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
                </div>

                {/* Bottom Pitch button */}
                <div className="pt-2">
                  <button
                    onClick={() => setPitchTargetCompany(company)}
                    className="w-full py-2 px-3 rounded-[8px] border border-hairline-light dark:border-hairline-dark hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40 text-xs font-medium text-ink-light dark:text-ink-dark flex items-center justify-center space-x-1.5 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-brass-light dark:text-brass-dark" />
                    <span>Draft Tailored Cold Pitch</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pitch Modal */}
      {pitchTargetCompany && (
        <PitchModal
          isOpen={Boolean(pitchTargetCompany)}
          onClose={() => setPitchTargetCompany(null)}
          companyName={pitchTargetCompany.name}
          companyContext={pitchTargetCompany.notes || `Company based in ${pitchTargetCompany.region}`}
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

