'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { COPY, type Copy, type Lang } from '@/lib/landing-copy';

// Holds the page language. English is the default; a visitor's choice is kept
// in localStorage and mirrored to <html lang> so screen readers and fonts
// switch with it. The server always renders English; a saved Bangla choice is
// applied right after the page loads.

const STORAGE_KEY = 'bytevoice-lang';

type LanguageContextValue = { lang: Lang; t: Copy; toggle: () => void };

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('en');

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'bn') setLang('bn');
    } catch {
      // Storage can be blocked (private mode); English is fine then.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const toggle = useCallback(() => {
    setLang((current) => {
      const next = current === 'en' ? 'bn' : 'en';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Not remembered, but the switch still works for this visit.
      }
      return next;
    });
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, t: COPY[lang], toggle }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider');
  return value;
}

export function LanguageToggle({ className = '' }: { className?: string }) {
  const { t, toggle } = useLanguage();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t.meta.toggleLabel}
      className={`rounded-full border border-white/20 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:outline-none ${className}`}
    >
      {t.meta.toggle}
    </button>
  );
}
