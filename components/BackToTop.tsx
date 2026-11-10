'use client';

import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 800);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      className="hit-slop fixed bottom-20 md:bottom-8 right-6 z-30 p-3 rounded-[12px] bg-background-light dark:bg-background-dark border border-hairline-light dark:border-hairline-dark text-ink-light dark:text-ink-dark shadow-lg hover:border-brass-light dark:hover:border-brass-dark transition-all duration-200"
    >
      <ArrowUp className="w-5 h-5" strokeWidth={1.5} />
    </button>
  );
}

