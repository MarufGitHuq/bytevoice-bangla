// The text file a caller can download after a call: what was done, the
// appointment details, and the transcript. It is built in the browser from
// what the page already holds, so nothing extra is fetched or stored.
import type { CallStep, TranscriptLine } from '@/components/landing/use-call';
import type { Copy, Lang } from './landing-copy';

const TIME_ZONE = 'Asia/Dhaka';

/** "Sunday 15 November, 4:00 pm" in Dhaka time, in the page's language. */
export function formatAppointmentTime(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', {
    timeZone: TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

/** One line describing the appointment a step refers to. */
export function describeAppointment(appointment: NonNullable<CallStep['appointment']>, lang: Lang) {
  const doctor = lang === 'bn' ? appointment.doctorBn : appointment.doctorEn;
  return `${doctor} · ${formatAppointmentTime(appointment.slotStart, lang)}`;
}

export function buildCallRecord(input: {
  lang: Lang;
  t: Copy;
  seconds: number;
  steps: CallStep[];
  transcript: TranscriptLine[];
}): string {
  const { lang, t, seconds, steps, transcript } = input;
  const r = t.call.record;
  const now = new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', {
    timeZone: TIME_ZONE,
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date());
  const length = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  const lines = [r.title, '', `${r.date}: ${now}`, `${r.length}: ${length}`, '', `${r.outcome}:`];

  if (steps.length === 0) lines.push(`- ${r.nothing}`);
  for (const step of steps) {
    lines.push(`- ${t.call.steps[step.step]}`);
    if (step.appointment) {
      lines.push(`    ${describeAppointment(step.appointment, lang)}`);
      lines.push(`    ${r.patient}: ${step.appointment.patientName}`);
      lines.push(`    ${t.call.reference}: ${step.appointment.reference}`);
    }
  }

  lines.push('', `${r.transcript}:`);
  for (const line of transcript) {
    lines.push(`${line.fromAgent ? t.call.agent : t.call.you}: ${line.text}`);
  }
  lines.push('', r.note);
  return lines.join('\r\n');
}

/** Saves the record as a .txt file. */
export function downloadCallRecord(text: string) {
  // The byte order mark makes Windows Notepad read the Bangla correctly.
  const blob = new Blob(['﻿', text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'dhaka-dental-care-call.txt';
  link.click();
  URL.revokeObjectURL(url);
}
