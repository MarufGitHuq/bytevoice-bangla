'use client';

import { useState } from 'react';
import { CallTranscript } from '@/components/landing/call-panel';
import { LanguageProvider, LanguageToggle } from '@/components/landing/language';
import type { TranscriptLine } from '@/components/landing/use-call';

// Shows CallTranscript the way it looks during a live call, with made-up
// lines instead of a real call. The last sample line is the receptionist
// asking for the mobile number, so the keypad should open by itself.
// Whatever the panel passes to onSend is listed underneath.

const SAMPLE_LINES: TranscriptLine[] = [
  { id: 'a1', fromAgent: true, text: 'আসসালামু আলাইকুম, ঢাকা ডেন্টাল কেয়ার থেকে মিতু বলছি।' },
  { id: 'u1', fromAgent: false, text: 'কালকে একটা অ্যাপয়েন্টমেন্ট লাগবে।' },
  { id: 'a2', fromAgent: true, text: 'জি, আপনার মোবাইল নম্বরটা বলবেন?' },
];

// Extra lines the buttons below can add, to try the opening rule by hand.
const ASK_AGAIN = 'দুঃখিত, ঠিকমতো বুঝতে পারিনি। নম্বরটা আরেকবার বলবেন?';
const READ_BACK = 'আপনার নম্বর শূন্য এক সাত এক দুই, তিন চার পাঁচ, ছয় সাত আট। ঠিক আছে?';

const buttonClass =
  'min-h-11 rounded-full border border-white/20 px-4 text-sm hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:outline-none';

export function CallPanelPreview() {
  const [lines, setLines] = useState(SAMPLE_LINES);
  const [sent, setSent] = useState<string[]>([]);

  const addAgentLine = (text: string) =>
    setLines((current) => [...current, { id: `a${current.length + 1}`, fromAgent: true, text }]);

  // Stands in for sendText from useCall: records the text and shows it in the
  // transcript as the caller's line.
  const onSend = async (text: string) => {
    setSent((current) => [...current, text]);
    setLines((current) => [...current, { id: `u${current.length + 1}`, fromAgent: false, text }]);
  };

  return (
    <LanguageProvider>
      <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6">
        <div className="mx-auto max-w-xl">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-semibold">Call panel preview (dev only)</h1>
            <LanguageToggle />
          </div>

          <div className="mt-4">
            <CallTranscript transcript={lines} live={true} isSending={false} onSend={onSend} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => addAgentLine(ASK_AGAIN)} className={buttonClass}>
              Agent asks for the number again
            </button>
            <button type="button" onClick={() => addAgentLine(READ_BACK)} className={buttonClass}>
              Agent reads the number back
            </button>
          </div>

          <h2 className="mt-6 text-sm font-medium text-slate-400">onSend received</h2>
          {sent.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">Nothing yet.</p>
          ) : (
            <ol data-testid="sent" className="mt-2 space-y-1 font-mono text-sm">
              {sent.map((text, i) => (
                <li key={i}>
                  {JSON.stringify(text)} ({text.length} characters)
                </li>
              ))}
            </ol>
          )}
        </div>
      </main>
    </LanguageProvider>
  );
}
