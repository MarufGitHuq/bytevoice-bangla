'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Check, SendHorizontal } from 'lucide-react';
import { describeAppointment } from '@/lib/call-record';
import { useLanguage } from './language';
import type { CallStep, TranscriptLine } from './use-call';

// What the caller sees over the orb during a call, top to bottom:
//   1. the steps the receptionist has completed (reported by the agent's tools),
//   2. the transcript, as it is spoken or typed,
//   3. a text box, for callers who would rather type or were misheard.

export function CallPanel({
  steps,
  transcript,
  live,
  isSending,
  onSend,
}: {
  steps: CallStep[];
  transcript: TranscriptLine[];
  /** The text box is shown only while the call is live. */
  live: boolean;
  isSending: boolean;
  onSend: (text: string) => Promise<void>;
}) {
  const { lang, t } = useLanguage();
  const [draft, setDraft] = useState('');
  const scroller = useRef<HTMLDivElement>(null);

  // Keep the newest line in view.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    void onSend(text);
  };

  // The appointment shown is the one from the latest step that has one.
  const appointment = [...steps].reverse().find((s) => s.appointment)?.appointment;

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950/55 backdrop-blur-[2px]">
      {steps.length > 0 && (
        <section
          aria-label={t.call.progress}
          aria-live="polite"
          className="border-b border-white/10 p-3 sm:p-4"
        >
          <ul className="flex flex-wrap gap-2">
            {steps.map((s) => (
              <li
                key={s.step}
                className="inline-flex items-center gap-1.5 rounded-full border border-teal-400/40 bg-teal-400/15 px-3 py-1 text-xs font-medium text-teal-100"
              >
                <Check className="size-3.5" aria-hidden="true" />
                {t.call.steps[s.step]}
              </li>
            ))}
          </ul>
          {appointment && (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
              <p className="font-medium text-slate-50">{describeAppointment(appointment, lang)}</p>
              <p className="mt-1 text-slate-300">
                {appointment.patientName}
                <span className="mx-2 text-slate-500">·</span>
                {t.call.reference}: <span className="font-mono">{appointment.reference}</span>
              </p>
            </div>
          )}
        </section>
      )}

      <div
        ref={scroller}
        role="log"
        aria-label={t.call.transcript}
        className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4"
      >
        <h2 className="text-xs font-medium tracking-wider text-slate-400 uppercase">
          {t.call.transcript}
        </h2>
        {transcript.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">{t.call.transcriptEmpty}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {transcript.map((line) => (
              <li key={line.id} className={line.fromAgent ? 'pr-8' : 'pl-8 text-right'}>
                <span className="block text-[11px] text-slate-400">
                  {line.fromAgent ? t.call.agent : t.call.you}
                </span>
                <span
                  className={`mt-0.5 inline-block rounded-2xl px-3 py-2 text-left text-sm leading-relaxed ${
                    line.fromAgent
                      ? 'rounded-tl-sm bg-teal-400/15 text-teal-50'
                      : 'rounded-tr-sm bg-white/10 text-slate-50'
                  }`}
                >
                  {line.text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {live && (
        <form onSubmit={submit} className="flex gap-2 border-t border-white/10 p-3">
          <label htmlFor="call-text" className="sr-only">
            {t.call.typeLabel}
          </label>
          <input
            id="call-text"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={500}
            autoComplete="off"
            placeholder={t.call.typePlaceholder}
            className="min-h-11 min-w-0 flex-1 rounded-full border border-white/15 bg-slate-950/70 px-4 text-sm text-slate-50 placeholder:text-slate-500 focus:border-teal-300 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isSending || !draft.trim()}
            aria-label={t.call.send}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-teal-400 text-slate-950 transition-colors hover:bg-teal-300 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-50"
          >
            <SendHorizontal className="size-5" aria-hidden="true" />
          </button>
        </form>
      )}
    </div>
  );
}
