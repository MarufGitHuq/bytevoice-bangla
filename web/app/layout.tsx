import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Noto_Sans_Bengali } from 'next/font/google';
import '@/styles/globals.css';

// Inter for Latin text, Noto Sans Bengali for Bangla (Inter has no Bengali
// glyphs, so the browser falls through to Noto letter by letter), JetBrains
// Mono for numbers in the portal. The variable names are shared with the
// portal's styles.
const inter = Inter({ variable: '--font-public-sans', subsets: ['latin'] });
const bengali = Noto_Sans_Bengali({
  variable: '--font-bengali',
  subsets: ['bengali'],
  weight: ['400', '500', '600', '700'],
});
const mono = JetBrains_Mono({ variable: '--font-commit-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ByteVoice for Bangla · AI receptionist demo',
  description:
    'Talk to Mitu, a Bangla-speaking AI receptionist for a dental clinic. She books, moves and cancels appointments by voice.',
};

export const viewport: Viewport = { themeColor: '#020617' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${bengali.variable} ${mono.variable} scroll-smooth antialiased`}
    >
      <body className="overflow-x-hidden">{children}</body>
    </html>
  );
}
