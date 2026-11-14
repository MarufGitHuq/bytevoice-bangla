import type { Metadata } from 'next';
import { Noto_Sans_Bengali } from 'next/font/google';

// Bangla text (names, transcripts) needs a font with Bengali glyphs; Inter has
// none. The portal loads Noto Sans Bengali and lists it after the Latin font,
// so English uses Inter and Bangla falls through to Noto.
const bengali = Noto_Sans_Bengali({
  subsets: ['bengali'],
  weight: ['400', '500', '600'],
  variable: '--font-bengali',
});

export const metadata: Metadata = {
  title: 'Staff portal · Dhaka Dental Care',
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    // The portal has its own light look. `relative z-[60]` keeps it above the
    // site-wide fixed header from the root layout (z-50) until the landing page
    // rebuild replaces that header.
    <div
      className={`${bengali.variable} relative z-[60] min-h-screen bg-slate-50 text-slate-900 [color-scheme:light]`}
      style={{
        fontFamily:
          'var(--font-public-sans), var(--font-bengali), ui-sans-serif, system-ui, sans-serif',
      }}
    >
      {children}
    </div>
  );
}
