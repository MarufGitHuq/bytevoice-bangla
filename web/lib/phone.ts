// Small helpers for the on-screen number keypad on the landing page.
//
// Speech recognition often drops digits from a spoken mobile number, so the
// caller can tap the number instead. The rules here are a copy of the ones the
// agent uses (normalisePhone in agent/src/validation.ts and the "is she asking
// for a number" check in agent/src/main.ts). The agent still checks the number
// itself; this copy only decides when the Send button lights up.

const BANGLA_DIGITS = '০১২৩৪৫৬৭৮৯';

/** A Bangladeshi mobile number has 11 digits. */
export const PHONE_LENGTH = 11;

/** Converts Bangla digits to ASCII digits; leaves everything else alone. */
export function toAsciiDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d)));
}

/** Converts ASCII digits to Bangla digits, for showing on a Bangla page. */
export function toBanglaDigits(input: string): string {
  return input.replace(/\d/g, (d) => BANGLA_DIGITS[Number(d)]);
}

/** True for 11 ASCII digits that start 01 and have 3 to 9 as the third digit. */
export function isValidMobile(digits: string): boolean {
  return /^01[3-9]\d{8}$/.test(digits);
}

/** Splits the digits typed so far into 3-4-4 for reading: "017 1234 5678". */
export function groupPhone(digits: string): string {
  return [digits.slice(0, 3), digits.slice(3, 7), digits.slice(7)].filter(Boolean).join(' ');
}

/**
 * True when a line from the receptionist is asking the caller for a number.
 *
 * She asks with one of the words নম্বর, নাম্বার or ডিজিট. She also uses those
 * words when she reads a number back to check it ("... ঠিক আছে?", "ঠিক
 * বলেছি?", "ঠিক তো?"); that is a yes/no question, so it does not count.
 */
export function asksForNumber(agentLine: string): boolean {
  const mentionsNumber = /নম্বর|নাম্বার|ডিজিট/.test(agentLine);
  const isReadBack = /ঠিক (আছে|বলেছি|তো)/.test(agentLine);
  return mentionsNumber && !isReadBack;
}
