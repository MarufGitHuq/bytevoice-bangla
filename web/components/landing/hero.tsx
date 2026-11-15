'use client';

import Link from 'next/link';
import { Download, Loader2, Phone, PhoneOff, RotateCcw } from 'lucide-react';
import { RoomAudioRenderer, SessionProvider } from '@livekit/components-react';
import { buildCallRecord, downloadCallRecord } from '@/lib/call-record';
import { CallTranscript, CallUpdates } from './call-panel';
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

  // "inCall" changes the layout: the heading shrinks and the transcript opens
  // under it (left); completed steps appear over the orb (right). It stays on
  // after the call while there is something to read or download.
  const inCall =
    call.phase === 'connecting' ||
    call.phase === 'live' ||
    (call.phase === 'ended' && (call.transcript.length > 0 || call.steps.length > 0));

  const download = () =>
    downloadCallRecord(
      buildCallRecord({
        lang,
        t,
        seconds: call.seconds,
        steps: call.steps,
        transcript: call.transcript,
      })
    );

  return (
    <SessionProvider session={call.session}>
      {/* Plays the receptionist's voice. */}
      <RoomAudioRenderer />

      <div className="mx-auto grid max-w-6xl items-center gap-6 px-4 pt-4 pb-16 sm:px-6 md:grid-cols-[1.1fr_1fr] md:gap-10 md:pt-12 md:pb-24">
        <div className="order-2 md:order-1">
          <p className="text-sm font-medium tracking-wide text-teal-300">{t.hero.eyebrow}</p>
          <h1
            className={`mt-3 leading-tight font-semibold tracking-tight text-balance transition-[font-size] duration-500 ease-out motion-reduce:transition-none ${
              inCall ? 'text-xl sm:text-2xl' : 'text-3xl sm:text-4xl lg:text-5xl'
            }`}
          >
            {t.hero.title}
          </h1>
          {/* The subtitle folds away during a call to give the transcript room. */}
          <div
            className={`grid transition-[grid-template-rows,opacity] duration-500 ease-out motion-reduce:transition-none ${
              inCall ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
            }`}
            aria-hidden={inCall}
          >
            <p className="max-w-xl overflow-hidden text-base leading-relaxed text-slate-300 sm:text-lg">
              <span className="block pt-4">{t.hero.subtitle}</span>
            </p>
          </div>

          <div className={inCall ? 'mt-4' : 'mt-8'} aria-live="polite">
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
              <div className="max-w-xl">
                <p className="font-semibold">{t.call.endedTitle}</p>
                <p className="mt-1 text-sm text-slate-300">{t.call.endedBody}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
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

          {inCall && (
            <div className="mt-4 max-w-xl motion-safe:animate-[fade-in_0.5s_ease-out]">
              <CallTranscript
                transcript={call.transcript}
                live={call.phase === 'live'}
                isSending={call.isSending}
                onSend={call.sendText}
              />
            </div>
          )}
        </div>

        {/* Right: the orb, with the steps done so far over it, and the download
            once the call has ended. */}
        <div className="order-1 md:order-2">
          <div
            className={`relative mx-auto aspect-square w-full transition-[max-width] duration-500 md:max-w-[460px] ${
              inCall ? 'max-w-[220px] sm:max-w-[300px]' : 'max-w-[260px] sm:max-w-[340px]'
            }`}
          >
            <div
              className={`size-full transition-opacity duration-500 ${call.steps.length > 0 ? 'opacity-60' : ''}`}
            >
              <HeroOrb look={call.look} level={call.level} />
            </div>
            {/* Wide screens: the steps sit over the orb. */}
            <div className="absolute inset-x-4 top-4 hidden md:block">
              <CallUpdates steps={call.steps} />
            </div>
          </div>
          {/* Phones: the orb is small, so the steps go under it. */}
          <div className="mt-3 md:hidden">
            <CallUpdates steps={call.steps} />
          </div>

          {call.phase === 'ended' && inCall && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={download}
                className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/30 px-5 font-medium hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
              >
                <Download className="size-5" aria-hidden="true" />
                {t.call.download}
              </button>
            </div>
          )}
        </div>
      </div>
    </SessionProvider>
  );
}
