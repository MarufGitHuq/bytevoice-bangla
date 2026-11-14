import { Inter, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/app/theme-provider';
import { cn } from '@/lib/shadcn/utils';
import '@/styles/globals.css';

// Meta Co-Founder brand type: Inter for display, body and UI; JetBrains Mono
// for labels and identifiers. The CSS variable names are the starter's, kept so
// the existing theme tokens in globals.css pick the fonts up unchanged.
const inter = Inter({
  variable: '--font-public-sans',
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-commit-mono',
  subsets: ['latin'],
});

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(inter.variable, jetbrainsMono.variable, 'scroll-smooth font-sans antialiased')}
    >
      <head>
        <title>Meta Co-Founder · Voice Receptionist</title>
        <meta
          name="description"
          content="Talk to Mira, the voice receptionist for Meta Co-Founder. She explains the platform and books a discovery call."
        />
      </head>
      <body className="brand-panel overflow-x-hidden" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          disableTransitionOnChange
        >
          <header className="fixed top-0 left-0 z-50 hidden w-full flex-row items-center justify-between p-6 md:flex">
            <a
              href="https://metacofounder.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mcf-logo-white.png" alt="Meta Co-Founder logo" className="size-7" />
              <span className="text-foreground text-sm font-semibold tracking-tight">
                Meta Co-Founder
              </span>
              <span className="hidden text-sm text-zinc-400 lg:inline">
                Your AI Business Operating System
              </span>
            </a>
            <span className="border-border rounded-full border px-3 py-1 font-mono text-[11px] tracking-wider text-zinc-400 uppercase">
              Voice Receptionist · Preview
            </span>
          </header>

          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
