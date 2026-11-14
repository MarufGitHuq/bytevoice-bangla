// Validation and normalisation of what callers say.
//
// Speech-to-text returns numbers in several shapes: Bangla digits (০১৭…),
// ASCII digits, with or without the +88 country code, with spaces or dashes.
// The language model is also unreliable with dates. Nothing reaches the
// database until it has passed through here.
import { CLINIC, SLOT_HOURS } from './clinic.ts';

const BANGLA_DIGITS = '০১২৩৪৫৬৭৮৯';

/** Converts Bangla digits to ASCII digits; leaves everything else alone. */
export function toAsciiDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d)));
}

export type PhoneResult = { ok: true; phone: string } | { ok: false; reason: string };

/**
 * Normalises a Bangladeshi mobile number to 11 digits (01XXXXXXXXX).
 * Accepts Bangla or ASCII digits and an optional +88 / 88 / 0088 prefix.
 */
export function normalisePhone(input: string): PhoneResult {
  let digits = toAsciiDigits(input).replace(/\D/g, '');
  if (digits.startsWith('0088')) digits = digits.slice(4);
  else if (digits.startsWith('88') && digits.length === 13) digits = digits.slice(2);

  if (digits.length !== 11) {
    return { ok: false, reason: `number has ${digits.length} digits, a mobile number has 11` };
  }
  if (!/^01[3-9]\d{8}$/.test(digits)) {
    return { ok: false, reason: 'number does not start like a Bangladeshi mobile number (013 to 019)' };
  }
  return { ok: true, phone: digits };
}

/** How a phone number should be read back: digit by digit, in Bangla words. */
export function phoneForSpeech(phone: string): string {
  const words = ['শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়'];
  const spoken = phone.split('').map((d) => words[Number(d)] ?? d);
  // Grouped 5-3-3, the way numbers are usually said aloud.
  return [spoken.slice(0, 5).join(' '), spoken.slice(5, 8).join(' '), spoken.slice(8).join(' ')].join(', ');
}

export function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`));
}

/** Weekday (0 = Sunday) of a calendar date. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Accepts "18:00", "18", "6:00" (24 hour only) and returns "HH:00", or null. */
export function normaliseTime(input: string): string | null {
  const match = toAsciiDigits(input).trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  if (hour < 0 || hour > 23) return null;
  return `${String(hour).padStart(2, '0')}:00`;
}

export type SlotCheck = { ok: true; slotStart: string } | { ok: false; reason: string };

/**
 * Checks that a date and time is a real appointment slot at this clinic and is
 * still in the future. Returns the slot as an ISO timestamp in clinic time.
 */
export function checkSlot(date: string, time: string, now = new Date()): SlotCheck {
  if (!isValidDate(date)) return { ok: false, reason: 'date is not a valid YYYY-MM-DD date' };
  const normalised = normaliseTime(time);
  if (!normalised) return { ok: false, reason: 'time is not a valid 24 hour HH:00 time' };
  if (weekdayOf(date) === CLINIC.closedWeekday) return { ok: false, reason: 'the clinic is closed on Fridays' };
  const hour = Number(normalised.slice(0, 2));
  if (!SLOT_HOURS.includes(hour)) {
    return { ok: false, reason: `no appointments start at ${normalised}; slots are ${SLOT_HOURS.join(', ')} o'clock` };
  }
  const slotStart = `${date}T${normalised}:00${CLINIC.utcOffset}`;
  if (new Date(slotStart).getTime() <= now.getTime()) return { ok: false, reason: 'that time has already passed' };
  return { ok: true, slotStart };
}

const bnWeekday = new Intl.DateTimeFormat('bn-BD', { timeZone: CLINIC.timeZone, weekday: 'long' });
const isoParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: CLINIC.timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Calendar date (YYYY-MM-DD) of an instant, on the clinic's clock. */
export function clinicDate(instant: Date): string {
  const parts = isoParts.formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Hour (0-23) of an instant, on the clinic's clock. */
export function clinicHour(instant: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: CLINIC.timeZone, hour: '2-digit', hourCycle: 'h23' }).format(instant),
  );
}

// Day of the month the way it is said aloud. Digits are avoided because a
// speech model may read them in the wrong language or as a plain number.
const DAY_WORDS = [
  'পহেলা', 'দোসরা', 'তেসরা', 'চৌঠা', 'পাঁচই', 'ছয়ই', 'সাতই', 'আটই', 'নয়ই', 'দশই',
  'এগারোই', 'বারোই', 'তেরোই', 'চৌদ্দই', 'পনেরোই', 'ষোলোই', 'সতেরোই', 'আঠারোই', 'উনিশে', 'বিশে',
  'একুশে', 'বাইশে', 'তেইশে', 'চব্বিশে', 'পঁচিশে', 'ছাব্বিশে', 'সাতাশে', 'আটাশে', 'উনত্রিশে', 'ত্রিশে', 'একত্রিশে',
];
const bnMonth = new Intl.DateTimeFormat('bn-BD', { timeZone: CLINIC.timeZone, month: 'long' });

/** "রবিবার, পনেরোই নভেম্বর" */
export function dateForSpeech(instant: Date): string {
  const day = Number(clinicDate(instant).slice(8, 10));
  return `${bnWeekday.format(instant)}, ${DAY_WORDS[day - 1]} ${bnMonth.format(instant)}`;
}

/** Bangla has a word for each part of the day; "ছয়টা" alone is ambiguous. */
export function hourForSpeech(hour: number): string {
  const words = ['বারোটা', 'একটা', 'দুইটা', 'তিনটা', 'চারটা', 'পাঁচটা', 'ছয়টা', 'সাতটা', 'আটটা', 'নয়টা', 'দশটা', 'এগারোটা'];
  const period = hour < 12 ? 'সকাল' : hour < 15 ? 'দুপুর' : hour < 18 ? 'বিকাল' : hour < 20 ? 'সন্ধ্যা' : 'রাত';
  return `${period} ${words[hour % 12]}`;
}

/**
 * Lookup table of the coming days. Language models are unreliable at weekday
 * arithmetic ("next Sunday" -> a date), so the model looks dates up here
 * instead of calculating them.
 */
export function upcomingDaysTable(count = 14, now = new Date()): string {
  return Array.from({ length: count }, (_, i) => {
    const day = new Date(now.getTime() + i * 86_400_000);
    const closed = weekdayOf(clinicDate(day)) === CLINIC.closedWeekday ? ' (বন্ধ)' : '';
    const label = i === 0 ? 'আজ' : i === 1 ? 'আগামীকাল' : i === 2 ? 'পরশু' : '';
    return `${clinicDate(day)} = ${dateForSpeech(day)}${label ? ` [${label}]` : ''}${closed}`;
  }).join('\n');
}
