'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { Search, Compass, CheckSquare, Building2, Sliders, Moon, Sun, PlusCircle, Download, RefreshCw } from 'lucide-react';
import { useTheme } from './Providers';
import { exportAllData } from '../lib/db';
import { toast } from 'sonner';

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { effectiveTheme, toggleTheme } = useTheme();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA')) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleExport = async () => {
    try {
      const dataStr = await exportAllData();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `internship-finder-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Application and tracker state exported successfully');
      setOpen(false);
    } catch {
      toast.error('Export failed');
    }
  };

  const handleTriggerRefresh = async () => {
    setOpen(false);
    const pass = localStorage.getItem('app-passphrase') || '';
    toast.info('Triggering pipeline refresh...');
    try {
      const res = await fetch('/api/pipeline/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-app-passphrase': pass,
        },
        body: JSON.stringify({ passphrase: pass }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to trigger refresh');
      } else {
        toast.success(data.message || 'Started, new data appears in a few minutes.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to trigger refresh');
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/40 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-background-light dark:bg-background-dark border border-hairline-light dark:border-hairline-dark rounded-[12px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Command Palette" className="w-full">
          <div className="flex items-center px-4 border-b border-hairline-light dark:border-hairline-dark">
            <Search className="w-4 h-4 text-muted-light dark:text-muted-dark mr-2 shrink-0" strokeWidth={1.5} />
            <Command.Input
              placeholder="Type a command or search..."
              className="w-full py-3.5 bg-transparent text-ink-light dark:text-ink-dark placeholder-muted-light dark:placeholder-muted-dark text-sm outline-none"
              autoFocus
            />
            <kbd className="text-[11px] px-1.5 py-0.5 rounded bg-hairline-light/50 dark:bg-hairline-dark/50 text-muted-light dark:text-muted-dark">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="p-4 text-center text-sm text-muted-light dark:text-muted-dark">
              No results found.
            </Command.Empty>

            <Command.Group heading="Navigation" className="text-[11px] uppercase tracking-wider text-muted-light dark:text-muted-dark px-2 py-1.5 font-semibold">
              <Command.Item
                onSelect={() => {
                  router.push('/');
                  setOpen(false);
                }}
                className="flex items-center px-3 py-2 text-sm rounded-[8px] cursor-pointer text-ink-light dark:text-ink-dark hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40"
              >
                <Compass className="w-4 h-4 mr-2" strokeWidth={1.5} />
                <span>Go to Internship Feed</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  router.push('/tracker');
                  setOpen(false);
                }}
                className="flex items-center px-3 py-2 text-sm rounded-[8px] cursor-pointer text-ink-light dark:text-ink-dark hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40"
              >
                <CheckSquare className="w-4 h-4 mr-2" strokeWidth={1.5} />
                <span>Go to Application Tracker</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  router.push('/companies');
                  setOpen(false);
                }}
                className="flex items-center px-3 py-2 text-sm rounded-[8px] cursor-pointer text-ink-light dark:text-ink-dark hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40"
              >
                <Building2 className="w-4 h-4 mr-2" strokeWidth={1.5} />
                <span>Go to Companies Watchlist & Contacts</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  router.push('/settings');
                  setOpen(false);
                }}
                className="flex items-center px-3 py-2 text-sm rounded-[8px] cursor-pointer text-ink-light dark:text-ink-dark hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40"
              >
                <Sliders className="w-4 h-4 mr-2" strokeWidth={1.5} />
                <span>Go to Settings & Profile</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Quick Actions" className="text-[11px] uppercase tracking-wider text-muted-light dark:text-muted-dark px-2 py-1.5 font-semibold mt-2">
              <Command.Item
                onSelect={handleTriggerRefresh}
                className="flex items-center px-3 py-2 text-sm rounded-[8px] cursor-pointer text-ink-light dark:text-ink-dark hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40"
              >
                <RefreshCw className="w-4 h-4 mr-2" strokeWidth={1.5} />
                <span>Refresh Pipeline (Run Ingestion Now)</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  router.push('/companies?action=add');
                  setOpen(false);
                }}
                className="flex items-center px-3 py-2 text-sm rounded-[8px] cursor-pointer text-ink-light dark:text-ink-dark hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40"
              >
                <PlusCircle className="w-4 h-4 mr-2" strokeWidth={1.5} />
                <span>Add Custom Company to Watchlist</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  toggleTheme();
                  setOpen(false);
                }}
                className="flex items-center px-3 py-2 text-sm rounded-[8px] cursor-pointer text-ink-light dark:text-ink-dark hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40"
              >
                {effectiveTheme === 'dark' ? (
                  <Sun className="w-4 h-4 mr-2" strokeWidth={1.5} />
                ) : (
                  <Moon className="w-4 h-4 mr-2" strokeWidth={1.5} />
                )}
                <span>Toggle Theme ({effectiveTheme === 'dark' ? 'Light' : 'Dark'})</span>
              </Command.Item>
              <Command.Item
                onSelect={handleExport}
                className="flex items-center px-3 py-2 text-sm rounded-[8px] cursor-pointer text-ink-light dark:text-ink-dark hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40"
              >
                <Download className="w-4 h-4 mr-2" strokeWidth={1.5} />
                <span>Export Tracker & State to JSON</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

