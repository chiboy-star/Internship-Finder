'use client';

import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Eye, EyeOff, Sparkles, Printer, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

interface PitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
  companyContext?: string;
}

export function PitchModal({ isOpen, onClose, companyName, companyContext }: PitchModalProps) {
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [specificDetail, setSpecificDetail] = useState('');
  const [chosenProject, setChosenProject] = useState('Finance Manager PWA');
  const [pitchText, setPitchText] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const savedPass = localStorage.getItem('app-passphrase');
    if (savedPass) setPassphrase(savedPass);
  }, []);

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    try {
      if (passphrase) {
        localStorage.setItem('app-passphrase', passphrase);
      }

      const res = await fetch('/api/pitch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-app-passphrase': passphrase,
        },
        body: JSON.stringify({
          companyName,
          companyContext,
          specificDetail,
          chosenProject,
          passphrase,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate pitch');
      }

      setPitchText(data.draft);
      setWordCount(data.wordCount);
      toast.success('Outreach pitch generated successfully');
    } catch (err: any) {
      setErrorMessage(err.message || 'Error creating pitch');
      toast.error(err.message || 'Error creating pitch');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!pitchText) return;
    navigator.clipboard.writeText(pitchText);
    setCopied(true);
    toast.success('Pitch copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-background-light dark:bg-background-dark border border-hairline-light dark:border-hairline-dark rounded-[12px] p-6 sm:p-8 shadow-2xl relative my-8"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pitch-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-hairline-light dark:border-hairline-dark">
          <div>
            <span className="editorial-label text-brass-light dark:text-brass-dark">Outreach Drafter</span>
            <h2 id="pitch-modal-title" className="text-2xl font-serif font-bold text-ink-light dark:text-ink-dark mt-1">
              Draft Pitch to {companyName}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="hit-slop p-2 text-muted-light dark:text-muted-dark hover:text-ink-light dark:hover:text-ink-dark rounded-[8px]"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleGenerate} className="mt-6 space-y-4">
          {/* Passphrase Gate with Password Visibility Toggle */}
          <div>
            <label className="block editorial-label mb-1.5" htmlFor="passphrase-input">
              Quota Passphrase Gate
            </label>
            <div className="relative">
              <input
                id="passphrase-input"
                type={showPassphrase ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter APP_PASSPHRASE if set..."
                aria-describedby="passphrase-help"
                className="w-full px-3 py-2 pr-10 rounded-[8px] bg-background-light dark:bg-background-dark border border-hairline-light dark:border-hairline-dark text-sm text-ink-light dark:text-ink-dark focus:outline-none focus:ring-1 focus:ring-brass-light"
              />
              <button
                type="button"
                onClick={() => setShowPassphrase((v) => !v)}
                aria-label={showPassphrase ? 'Hide passphrase' : 'Show passphrase'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-light dark:text-muted-dark hover:text-ink-light dark:hover:text-ink-dark"
              >
                {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p id="passphrase-help" className="text-xs text-muted-light dark:text-muted-dark mt-1">
              Passphrase protects your free Gemini quota.
            </p>
          </div>

          {/* Project Choice */}
          <div>
            <label className="block editorial-label mb-1.5" htmlFor="project-select">
              Featured Project (Includes UTM tracking)
            </label>
            <select
              id="project-select"
              value={chosenProject}
              onChange={(e) => setChosenProject(e.target.value)}
              className="w-full px-3 py-2 rounded-[8px] bg-background-light dark:bg-background-dark border border-hairline-light dark:border-hairline-dark text-sm text-ink-light dark:text-ink-dark focus:outline-none focus:ring-1 focus:ring-brass-light"
            >
              <option value="Finance Manager PWA">Finance Manager PWA (Offline-capable, Next.js, Supabase)</option>
              <option value="Aurelia Grand Resort">Aurelia Grand Resort (Responsive hospitality luxury UI, Tailwind)</option>
              <option value="Developer Portfolio">Developer Portfolio (Minimalist editorial design)</option>
            </select>
          </div>

          {/* Specific Observation */}
          <div>
            <label className="block editorial-label mb-1.5" htmlFor="specific-detail">
              Specific Company Observation (Mandatory Rule)
            </label>
            <input
              id="specific-detail"
              type="text"
              value={specificDetail}
              onChange={(e) => setSpecificDetail(e.target.value)}
              placeholder="e.g. Loved your recent launch of the new developer payments SDK..."
              className="w-full px-3 py-2 rounded-[8px] bg-background-light dark:bg-background-dark border border-hairline-light dark:border-hairline-dark text-sm text-ink-light dark:text-ink-dark focus:outline-none focus:ring-1 focus:ring-brass-light"
            />
          </div>

          {errorMessage && (
            <div className="flex items-center text-xs text-red-600 dark:text-red-400 gap-1.5 py-1">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-[8px] bg-ink-light text-background-light dark:bg-ink-dark dark:text-background-dark font-medium text-sm hover:opacity-90 transition-opacity flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <span>Generating Draft...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-brass-light dark:text-brass-dark" />
                  <span>Generate Outreach Pitch</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Pitch Draft Result */}
        {pitchText && (
          <div className="mt-6 pt-6 border-t border-hairline-light dark:border-hairline-dark space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="editorial-label">Generated Pitch</span>
                <span
                  className={cn(
                    'text-xs tabular-nums px-2 py-0.5 rounded-[4px] border font-medium',
                    wordCount <= 120
                      ? 'border-hairline-light dark:border-hairline-dark text-muted-light dark:text-muted-dark'
                      : 'border-red-400 text-red-600 dark:text-red-400'
                  )}
                >
                  {wordCount} / 120 words {wordCount <= 120 ? '✓' : '(Over limit)'}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  aria-label="Print pitch"
                  className="p-1.5 rounded-[8px] hover:bg-hairline-light/50 dark:hover:bg-hairline-dark/50 text-muted-light dark:text-muted-dark hover:text-ink-light dark:hover:text-ink-dark transition-colors"
                >
                  <Printer className="w-4 h-4" strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="hit-slop flex items-center space-x-1.5 px-3 py-1 text-xs font-medium rounded-[8px] border border-hairline-light dark:border-hairline-dark bg-background-light dark:bg-background-dark text-ink-light dark:text-ink-dark hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <pre className="p-4 rounded-[8px] bg-hairline-light/30 dark:bg-hairline-dark/30 border border-hairline-light dark:border-hairline-dark text-xs sm:text-sm font-sans whitespace-pre-wrap text-ink-light dark:text-ink-dark leading-relaxed">
              {pitchText}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

