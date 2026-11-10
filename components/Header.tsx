'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Sun, Moon, Sparkles } from 'lucide-react';
import { useTheme } from './Providers';
import { cn } from '../lib/utils';

export function Header() {
  const pathname = usePathname();
  const { effectiveTheme, toggleTheme } = useTheme();
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (totalScroll > 0) {
        setScrollProgress((window.scrollY / totalScroll) * 100);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { href: '/', label: 'Feed' },
    { href: '/tracker', label: 'Tracker' },
    { href: '/companies', label: 'Companies' },
    { href: '/settings', label: 'Settings' },
  ];

  const openCommandMenu = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-background-light/90 dark:bg-background-dark/90 border-b border-hairline-light dark:border-hairline-dark transition-colors duration-200 safe-top">
      {/* 2px Scroll Progress Bar */}
      <div
        className="h-[2px] bg-brass-light dark:bg-brass-dark transition-all duration-150 ease-out origin-left"
        style={{ width: `${scrollProgress}%` }}
        role="progressbar"
        aria-valuenow={Math.round(scrollProgress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Page scroll progress"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Wordmark */}
        <div className="flex items-center space-x-6">
          <Link href="/" className="group flex items-baseline space-x-2 focus:outline-none focus:ring-1 focus:ring-brass-light dark:focus:ring-brass-dark rounded px-1">
            <span className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-ink-light dark:text-ink-dark">
              Internship Finder
            </span>
            <span className="editorial-label text-brass-light dark:text-brass-dark font-medium hidden sm:inline">
              Summer 2027
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-1" aria-label="Main Navigation">
            {navLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-[8px] transition-colors',
                    active
                      ? 'text-ink-light dark:text-ink-dark bg-hairline-light/50 dark:bg-hairline-dark/60'
                      : 'text-muted-light dark:text-muted-dark hover:text-ink-light dark:hover:text-ink-dark hover:bg-hairline-light/30 dark:hover:bg-hairline-dark/30'
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right side controls: Search chip + Theme toggle */}
        <div className="flex items-center space-x-3">
          <button
            onClick={openCommandMenu}
            aria-label="Open command palette (Press Command+K)"
            className="flex items-center space-x-2 px-3 py-1.5 text-sm text-muted-light dark:text-muted-dark bg-hairline-light/40 dark:bg-hairline-dark/40 hover:bg-hairline-light/70 dark:hover:bg-hairline-dark/70 rounded-[8px] border border-hairline-light dark:border-hairline-dark transition-colors focus:outline-none focus:ring-1 focus:ring-brass-light"
          >
            <Search className="w-4 h-4" strokeWidth={1.5} />
            <span className="hidden sm:inline">Search...</span>
            <kbd className="hidden sm:inline-block text-[11px] px-1.5 py-0.5 rounded bg-background-light dark:bg-background-dark border border-hairline-light dark:border-hairline-dark font-sans font-semibold">
              ⌘K
            </kbd>
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${effectiveTheme === 'dark' ? 'light' : 'dark'} mode`}
            className="hit-slop p-2 text-muted-light dark:text-muted-dark hover:text-ink-light dark:hover:text-ink-dark rounded-[8px] hover:bg-hairline-light/40 dark:hover:bg-hairline-dark/40 transition-colors focus:outline-none focus:ring-1 focus:ring-brass-light"
          >
            {effectiveTheme === 'dark' ? (
              <Sun className="w-5 h-5" strokeWidth={1.5} />
            ) : (
              <Moon className="w-5 h-5" strokeWidth={1.5} />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

