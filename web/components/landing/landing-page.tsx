'use client';

import Link from 'next/link';
import { CalendarClock, CalendarPlus, CalendarX, Check, Info } from 'lucide-react';
import { SAMPLE_EXCHANGE } from '@/lib/landing-copy';
import { Hero } from './hero';
import { LanguageProvider, LanguageToggle, useLanguage } from './language';

// The home page: header and hero (dark, with the live call), what callers can
// do, what staff get, footer. All text comes from lib/landing-copy.ts.

export function LandingPage() {
  return (
    <LanguageProvider>
      <Page />
    </LanguageProvider>
  );
}

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#2dd4bf" />
        <path
          d="M9 18v-4M13 21V11M17 19v-6M21 22V10M25 17v-2"
          stroke="#042f2e"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
      <span className="font-semibold tracking-tight">
        ByteVoice <span className="font-normal text-teal-300">for Bangla</span>
      </span>
    </span>
  );
}

const CALLER_ICONS = [CalendarPlus, CalendarClock, CalendarX, Info];

function Page() {
  const { t } = useLanguage();

  return (
    <>
      <div className="relative overflow-hidden bg-slate-950 text-white">
        {/* Soft teal glow behind the orb. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_circle_at_75%_40%,rgb(20_184_166/0.22),transparent_70%)]"
        />
        <header className="relative mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" aria-label="ByteVoice for Bangla">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1 text-sm sm:gap-2">
            <a
              href="#callers"
              className="hidden rounded-md px-3 py-1.5 text-slate-300 hover:text-white md:inline"
            >
              {t.nav.callers}
            </a>
            <a
              href="#staff"
              className="hidden rounded-md px-3 py-1.5 text-slate-300 hover:text-white md:inline"
            >
              {t.nav.staff}
            </a>
            <Link
              href="/portal"
              className="hidden rounded-md px-3 py-1.5 text-slate-300 hover:text-white sm:inline"
            >
              {t.nav.portal}
            </Link>
            <LanguageToggle />
          </nav>
        </header>
        <main className="relative">
          <Hero />
        </main>
      </div>

      <section id="callers" className="scroll-mt-4 bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t.callers.title}</h2>
          <p className="mt-3 max-w-2xl text-slate-600">{t.callers.lead}</p>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {t.callers.items.map((item, i) => {
              const Icon = CALLER_ICONS[i];
              return (
                <li
                  key={item.title}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                >
                  <Icon className="size-6 text-teal-700" aria-hidden="true" />
                  <h3 className="mt-4 font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section id="staff" className="scroll-mt-4 bg-slate-50 py-16 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t.staff.title}</h2>
            <p className="mt-3 text-slate-600">{t.staff.lead}</p>
            <ul className="mt-6 space-y-3">
              {t.staff.items.map((item) => (
                <li key={item} className="flex gap-3">
                  <Check className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden="true" />
                  <span className="text-slate-700">{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/portal"
              className="mt-8 inline-flex min-h-11 items-center rounded-full bg-teal-700 px-5 font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {t.staff.cta}
            </Link>
            <p className="mt-3 text-sm text-slate-500">{t.staff.note}</p>
          </div>

          {/* A picture of a stored call, styled like the portal. */}
          <div
            aria-hidden="true"
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 text-sm">
              <span className="font-semibold">Dhaka Dental Care</span>
              <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-800">
                {t.staff.sampleOutcome}
              </span>
            </div>
            <ul className="mt-4 space-y-3 text-sm">
              {SAMPLE_EXCHANGE.map((line) => (
                <li key={line.text} className="flex gap-2">
                  <span
                    className={
                      line.who === 'agent'
                        ? 'shrink-0 font-medium text-teal-700'
                        : 'shrink-0 font-medium text-slate-500'
                    }
                  >
                    {line.who === 'agent' ? t.staff.sampleAgent : t.staff.sampleCaller}:
                  </span>
                  <span className="text-slate-800">{line.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <footer className="bg-slate-950 py-8 text-sm text-slate-400">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 sm:px-6">
          <p>{t.footer.line}</p>
          <p>{t.footer.fiction}</p>
        </div>
      </footer>
    </>
  );
}
