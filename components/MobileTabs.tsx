'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, CheckSquare, Building2, Sliders } from 'lucide-react';
import { cn } from '../lib/utils';

export function MobileTabs() {
  const pathname = usePathname();

  const tabs = [
    { href: '/', label: 'Feed', icon: Compass },
    { href: '/tracker', label: 'Tracker', icon: CheckSquare },
    { href: '/companies', label: 'Companies', icon: Building2 },
    { href: '/settings', label: 'Settings', icon: Sliders },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-t border-hairline-light dark:border-hairline-dark safe-bottom transition-colors duration-200 bottom-tabs"
      aria-label="Mobile Navigation"
    >
      <div className="grid grid-cols-4 h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'hit-slop flex flex-col items-center justify-center space-y-1 transition-colors',
                active
                  ? 'text-ink-light dark:text-ink-dark font-medium'
                  : 'text-muted-light dark:text-muted-dark hover:text-ink-light dark:hover:text-ink-dark'
              )}
            >
              <Icon className="w-5 h-5" strokeWidth={1.5} />
              <span className="text-[11px] font-sans tracking-tight">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

