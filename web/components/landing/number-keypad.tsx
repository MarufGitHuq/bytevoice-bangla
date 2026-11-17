'use client';

import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Delete, SendHorizontal } from 'lucide-react';
import {
  PHONE_LENGTH,
  groupPhone,
  isValidMobile,
  toAsciiDigits,
  toBanglaDigits,
} from '@/lib/phone';
import { useLanguage } from './language';

// A phone-style keypad for entering a mobile number during a call.
//
// It keeps the digits as a plain ASCII string ("01712345678"). Bangla digits
// are only for showing: the keys and the display follow the page language, but
// what is sent is always ASCII, which is what the agent expects.
//
// The keypad is mounted only while it is open, so closing it also clears it.

// Keys in the order they are drawn, three per row. The last row is
// backspace, 0, send.
const DIGIT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

const keyClass =
  'flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-lg font-medium text-slate-50 transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:outline-none active:bg-teal-400/25';

export function NumberKeypad({
  id,
  disabled,
  onSend,
}: {
  /** Lets the open/close button point at this keypad (aria-controls). */
  id: string;
  /** True while an earlier message is still being sent. */
  disabled: boolean;
  /** Receives the 11 ASCII digits when the caller presses Send. */
  onSend: (digits: string) => void;
}) {
  const { lang, t } = useLanguage();
  const [digits, setDigits] = useState('');
  const box = useRef<HTMLDivElement>(null);

  // Move keyboard focus to the keypad when it opens, so a hardware keyboard
  // works straight away. If the caller is busy typing in the text box, leave
  // them there.
  useEffect(() => {
    if (document.activeElement?.tagName !== 'INPUT') box.current?.focus();
  }, []);

  const valid = isValidMobile(digits);
  // After three digits we can already tell a wrong start (for example 012).
  const wrongStart = digits.length >= 3 && !/^01[3-9]/.test(digits);

  // Shows digits in the page language.
  const show = (text: string) => (lang === 'bn' ? toBanglaDigits(text) : text);

  const addDigit = (digit: string) =>
    setDigits((current) => (current.length < PHONE_LENGTH ? current + digit : current));
  const removeDigit = () => setDigits((current) => current.slice(0, -1));
  const send = () => {
    if (valid && !disabled) onSend(digits);
  };

  // Hardware keyboard: digits (ASCII or Bangla), Backspace and Enter.
  // Enter always means Send, even when a digit key has the focus; Space still
  // presses the focused key as usual.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = toAsciiDigits(event.key);
    if (/^\d$/.test(key)) {
      addDigit(key);
    } else if (event.key === 'Backspace') {
      removeDigit();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      send();
    }
  };

  return (
    <div
      id={id}
      ref={box}
      role="group"
      aria-label={t.call.keypad.title}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="border-t border-white/10 px-3 pt-3 focus:outline-none"
    >
      {/* What has been entered so far. The height is fixed so nothing moves
          when the first digit or the hint appears. */}
      <div className="flex h-12 items-center justify-between gap-3 rounded-xl border border-teal-400/30 bg-slate-950/70 px-4">
        <p aria-live="polite" className="min-w-0 truncate text-lg tracking-wider tabular-nums">
          {digits ? (
            <span className="text-teal-50">{show(groupPhone(digits))}</span>
          ) : (
            <span className="text-sm tracking-normal text-slate-400">{t.call.keypad.hint}</span>
          )}
        </p>
        <p
          className={`shrink-0 text-sm tabular-nums ${valid ? 'text-teal-300' : 'text-slate-400'}`}
        >
          {show(`${digits.length} / ${PHONE_LENGTH}`)}
        </p>
      </div>
      {/* One fixed line for the "wrong start" message, empty most of the time. */}
      <p role="alert" className="h-5 px-1 text-xs leading-5 text-rose-300">
        {wrongStart ? t.call.keypad.wrongStart : ''}
      </p>

      <div className="grid grid-cols-3 gap-1.5">
        {DIGIT_KEYS.map((digit) => (
          <button key={digit} type="button" onClick={() => addDigit(digit)} className={keyClass}>
            {show(digit)}
          </button>
        ))}
        <button
          type="button"
          onClick={removeDigit}
          disabled={!digits}
          aria-label={t.call.keypad.backspace}
          className={`${keyClass} disabled:opacity-40`}
        >
          <Delete className="size-5" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => addDigit('0')} className={keyClass}>
          {show('0')}
        </button>
        <button
          type="button"
          onClick={send}
          disabled={!valid || disabled}
          className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-teal-400 px-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-teal-300 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-40"
        >
          <SendHorizontal className="size-4 shrink-0" aria-hidden="true" />
          {t.call.keypad.send}
        </button>
      </div>
    </div>
  );
}
