'use client';

import Link from 'next/link';
import { Loader2, Phone, PhoneOff, RotateCcw } from 'lucide-react';
import { RoomAudioRenderer, SessionProvider } from '@livekit/components-react';
import { HeroOrb } from './hero-orb';
import { useLanguage } from './language';
import { useCall } from './use-call';

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

function formatTimer(seconds: number, lang: 'en' | 'bn') {
  const text = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return lang === 'bn' ? text.replace(/\d/g, (d) => BN_DIGITS[Number(d)]) : text;
}

const primaryButton =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-teal-400 px-6 py-3 text-base font-semibold text-slate-950 shadow-[0_0_40px_rgb(45_212_191/0.35)] transition-colors hover:bg-teal-300 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none disabled:cursor-wait disabled:opacity-80';

export function Hero() {
  const { lang, t } = useLanguage();
  const call = useCall();

  return (
    <SessionProvider session={call.session}>
      {/* Plays the receptionist's voice. */}
      <RoomAudioRenderer />

      <div className="mx-auto grid max-w-6xl items-center gap-6 px-4 pt-4 pb-16 sm:px-6 md:grid-cols-[1.1fr_1fr] md:gap-10 md:pt-12 md:pb-24">
        <div className="order-2 md:order-1">
          <p className="text-sm font-medium tracking-wide text-teal-300">{t.hero.eyebrow}</p>
          <h1 className="mt-3 text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
            {t.hero.title}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
            {t.hero.subtitle}
          </p>

          <div className="mt-8" aria-live="polite">
            {call.phase === 'idle' && (
              <>
                <button type="button" onClick={call.startCall} className={primaryButton}>
                  <Phone className="size-5" aria-hidden="true" />
                  {t.hero.cta}
                </button>
                <p className="mt-3 text-sm text-slate-400">{t.hero.idleHint}</p>
              </>
            )}

            {call.phase === 'connecting' && (
              <button type="button" disabled className={primaryButton}>
                <Loader2
                  className="size-5 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                {t.call.connecting}
              </button>
            )}

            {call.phase === 'live' && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex min-h-12 items-center gap-2 rounded-full border border-teal-400/40 bg-teal-400/10 px-4 text-sm">
                  <span
                    className="size-2 rounded-full bg-teal-300 motion-safe:animate-pulse"
                    aria-hidden="true"
                  />
                  {call.look === 'thinking'
                    ? t.call.thinking
                    : call.look === 'speaking'
                      ? t.call.speaking
                      : t.call.listening}
                  <span className="font-mono text-slate-300 tabular-nums">
                    {formatTimer(call.seconds, lang)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={call.endCall}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-rose-500 px-5 font-semibold text-white transition-colors hover:bg-rose-400 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                >
                  <PhoneOff className="size-5" aria-hidden="true" />
                  {t.call.end}
                </button>
              </div>
            )}

            {call.phase === 'ended' && (
              <div className="max-w-xl rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="font-semibold">{t.call.endedTitle}</p>
                <p className="mt-1 text-slate-300">{t.call.endedBody}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={call.startCall} className={primaryButton}>
                    <Phone className="size-5" aria-hidden="true" />
                    {t.call.again}
                  </button>
                  <Link href="/portal" className="text-teal-300 underline-offset-4 hover:underline">
                    {t.call.openPortal} →
                  </Link>
                </div>
              </div>
            )}

            {call.phase === 'error' && call.error && (
              <div
                role="alert"
                className="max-w-xl rounded-2xl border border-rose-400/40 bg-rose-500/10 p-5"
              >
                <p className="text-rose-100">{t.call.errors[call.error]}</p>
                <button
                  type="button"
                  onClick={call.startCall}
                  className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/30 px-5 font-medium hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  {t.call.retry}
                </button>
              </div>
            )}
          </div>

          {call.phase === 'live' && call.transcript.length > 0 && (
            <section className="mt-6 max-w-xl" aria-label={t.call.transcript}>
              <h2 className="text-xs font-medium tracking-wider text-slate-400 uppercase">
                {t.call.transcript}
              </h2>
              <ul className="mt-2 space-y-2 text-sm">
                {call.transcript.map((line) => (
                  <li key={line.id} className="flex gap-2">
                    <span
                      className={
                        line.fromAgent ? 'shrink-0 text-teal-300' : 'shrink-0 text-slate-400'
                      }
                    >
                      {line.fromAgent ? t.call.agent : t.call.you}:
                    </span>
                    <span className="text-slate-100">{line.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="order-1 mx-auto aspect-square w-full max-w-[260px] sm:max-w-[340px] md:order-2 md:max-w-[460px]">
          <HeroOrb look={call.look} level={call.level} />
        </div>
      </div>
    </SessionProvider>
  );
}
