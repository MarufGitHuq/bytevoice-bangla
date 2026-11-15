// Display helpers for the staff portal. Times are always shown in the clinic's
// time zone (Asia/Dhaka), whatever time zone the server or the reviewer is in.
import type { CallStatus } from './db';

const TIME_ZONE = 'Asia/Dhaka';

const dateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const weekdayDateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** "12 Nov 2026, 10:12 am" in Dhaka time. */
export function formatDateTime(value: Date | string | null): string {
  return value ? dateTime.format(new Date(value)) : '—';
}

/** "Tue, 17 Nov, 11:00 am" in Dhaka time: for appointment slots. */
export function formatSlot(value: Date | string | null): string {
  return value ? weekdayDateTime.format(new Date(value)) : '—';
}

/** "2m 22s". */
export function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
}

/** Position in the call, from transcript_turns.offset_ms: "1:05". */
export function formatOffset(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
}

/** A calendar date with no time zone ("2026-11-17") as "Tue, 17 Nov 2026". */
export function formatPlainDate(value: string | null): string {
  if (!value) return '—';
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** A time with no zone ("17:00:00") as "5:00 pm". */
export function formatPlainTime(value: string | null): string {
  if (!value) return '—';
  const [h, m] = value.split(':').map(Number);
  const suffix = h! >= 12 ? 'pm' : 'am';
  return `${((h! + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`;
}

// Doctor ids are stored as short keys; these match agent/src/clinic.ts.
const DOCTORS: Record<string, string> = {
  farhana: 'Dr. Farhana Ahmed',
  tanvir: 'Dr. Tanvir Hasan',
};

export function doctorName(id: string | null): string {
  if (!id) return '—';
  return DOCTORS[id] ?? id;
}

export const STATUS_LABELS: Record<CallStatus, string> = {
  in_progress: 'In progress',
  booked: 'Booked',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
  enquiry: 'Enquiry',
  follow_up_needed: 'Follow-up needed',
  incomplete: 'Incomplete',
  failed: 'Failed',
};

// Tailwind classes per status. Listed in full so Tailwind finds them.
export const STATUS_STYLES: Record<CallStatus, string> = {
  in_progress: 'bg-sky-50 text-sky-800 ring-sky-200',
  booked: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  rescheduled: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  cancelled: 'bg-slate-100 text-slate-700 ring-slate-300',
  enquiry: 'bg-teal-50 text-teal-800 ring-teal-200',
  follow_up_needed: 'bg-amber-50 text-amber-900 ring-amber-300',
  incomplete: 'bg-orange-50 text-orange-800 ring-orange-200',
  failed: 'bg-rose-50 text-rose-800 ring-rose-200',
};

export const INTENT_LABELS: Record<string, string> = {
  book: 'Book',
  reschedule: 'Reschedule',
  cancel: 'Cancel',
  enquiry: 'Enquiry',
  callback: 'Callback',
  other: 'Other',
};

/**
 * A calendar file (.ics) for one appointment, as a link the browser can
 * download. Staff open it to put the visit in the doctor's calendar (Google,
 * Outlook and Apple calendars all read this format). It is built from data
 * already on the page, so no email or SMS service is involved.
 */
export function appointmentCalendarLink(a: {
  reference: string;
  doctor: string;
  reason: string | null;
  slotStart: Date;
  patientName: string;
  patientPhone: string;
}): string {
  // Calendar files give times in UTC as 20261115T100000Z.
  const stamp = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  // Backslashes, commas and semicolons have a meaning in the format, and a
  // line break would start a new field. Names and reasons come from callers,
  // so they are escaped and control characters are removed.
  const text = (value: string) =>
    value
      .replace(/[\u0000-\u001f\u007f]+/g, ' ')
      .replace(/\\/g, '\\\\')
      .replace(/[;,]/g, (mark) => `\\${mark}`);
  const start = new Date(a.slotStart);
  const end = new Date(start.getTime() + 45 * 60_000);
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dhaka Dental Care//Staff portal//EN',
    'BEGIN:VEVENT',
    `UID:${a.reference}@dhaka-dental-care.demo`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${text(`${a.patientName} (${a.reason ?? 'visit'})`)}`,
    `DESCRIPTION:${text(`Patient: ${a.patientName}, ${a.patientPhone}. Doctor: ${doctorName(a.doctor)}. Booking reference ${a.reference}. Booked by phone through ByteVoice.`)}`,
    'LOCATION:Dhaka Dental Care',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}
