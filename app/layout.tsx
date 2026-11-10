import type { Metadata, Viewport } from 'next';
import { Playfair_Display, Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Header } from '@/components/Header';
import { MobileTabs } from '@/components/MobileTabs';
import { CommandMenu } from '@/components/CommandMenu';

const serifFont = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

const sansFont = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Internship Finder — Summer 2027',
  description: 'Private software engineering internship matcher and outreach platform.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6F2EA' },
    { media: '(prefers-color-scheme: dark)', color: '#0F0E0D' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${serifFont.variable} ${sansFont.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background-light dark:bg-background-dark text-ink-light dark:text-ink-dark transition-colors duration-200">
        <Providers>
          {/* Skip to Content for WCAG Accessibility */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 px-4 py-2 bg-ink-light text-background-light dark:bg-ink-dark dark:text-background-dark rounded-[8px] text-sm font-medium shadow-md outline-none"
          >
            Skip to main content
          </a>

          <div className="flex flex-col min-h-screen">
            <Header />
            <main id="main-content" className="flex-1 pb-20 md:pb-12">
              {children}
            </main>
            <MobileTabs />
          </div>

          <CommandMenu />
        </Providers>
      </body>
    </html>
  );
}

