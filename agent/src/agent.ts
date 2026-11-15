import { Agent, dedent, inference, tool } from '@livekit/agents';
import { z } from 'zod';
import { CLINIC, DOCTORS, DOCTOR_IDS, SERVICES, doctorById } from './clinic.ts';
import {
  type Appointment,
  bookAppointment,
  cancelAppointment,
  createCallback,
  findUpcomingAppointments,
  getFreeSlots,
  rescheduleAppointment,
  saveExtraction,
} from './store.ts';
import {
  checkSlot,
  clinicDate,
  clinicHour,
  dateForSpeech,
  hourForSpeech,
  isValidDate,
  normalisePhone,
  phoneForSpeech,
  upcomingDaysTable,
} from './validation.ts';

/** What happened on this call, set by the tools and read when the call ends. */
export interface CallState {
  callId: string;
  booked: boolean;
  rescheduled: boolean;
  cancelled: boolean;
  callbackRequested: boolean;
  /** The caller got as far as looking for a time. */
  startedBooking: boolean;
}

/**
 * A step the call has completed, sent to the caller's browser so the page can
 * show what the receptionist has done so far. Sent by the tools, after the
 * database confirmed the step, never on the model's word alone.
 */
export interface ProgressEvent {
  // 'phone_checked' means the number has a valid Bangladeshi mobile format,
  // not that the caller was proven to own it.
  step: 'availability_checked' | 'phone_checked' | 'booked' | 'rescheduled' | 'cancelled' | 'callback';
  appointment?: {
    /** Only for a booking made on this call (see appointmentDetails). */
    reference?: string;
    doctorBn: string;
    doctorEn: string;
    slotStart: string;
    patientName: string;
  };
}

// The booking reference goes to the browser only for a booking made on this
// call. An appointment found by phone number alone is not proof the caller
// owns it, so for a change or a cancellation the page gets no reference.
function appointmentDetails(
  appointment: Appointment,
  madeOnThisCall = false,
): NonNullable<ProgressEvent['appointment']> {
  const doctor = doctorById(appointment.doctor);
  return {
    ...(madeOnThisCall ? { reference: appointment.reference } : {}),
    doctorBn: doctor?.nameBn ?? appointment.doctor,
    doctorEn: doctor?.nameEn ?? appointment.doctor,
    slotStart: appointment.slotStart.toISOString(),
    patientName: appointment.patientName,
  };
}

export const LLM_MODEL = process.env.LLM_MODEL ?? 'google/gemini-3.8-flash';

const PART_OF_DAY: Record<string, [number, number]> = {
  morning: [0, 12],
  afternoon: [12, 17],
  evening: [17, 24],
  any: [0, 24],
};

/** One appointment, described the way the agent should say it. */
function describe(appointment: Appointment) {
  const doctor = doctorById(appointment.doctor)?.nameBn ?? appointment.doctor;
  const when = `${dateForSpeech(appointment.slotStart)}, ${hourForSpeech(clinicHour(appointment.slotStart))}`;
  return `${when}, ${doctor} (appointmentId: ${appointment.id})`;
}

// Tools never throw at the model. A failure becomes a plain instruction the
// receptionist can act on, so the caller hears an apology, not silence.
async function safely(run: () => Promise<string>): Promise<string> {
  try {
    return await run();
  } catch (error) {
    console.error('tool failed', error);
    return 'The system could not complete this just now. Apologise briefly, do not claim anything was booked or changed, and offer a callback from the front desk.';
  }
}

/** Bangla receptionist for a dental clinic. */
export function createAgent(state: CallState, report: (event: ProgressEvent) => void = () => {}) {
  const doctorLines = DOCTORS.map((d) => `- ${d.nameBn} (doctor id: ${d.id}): ${d.focusBn}`).join('\n');
  const feeLines = SERVICES.map((s) => `- ${s.nameBn}: ${s.feeBn}`).join('\n');

  return Agent.create({
    instructions: dedent`
        You are ${CLINIC.agentNameBn}, the phone receptionist at ${CLINIC.nameBn} (${CLINIC.nameEn}), a dental clinic in Dhaka. This is a demo clinic with test data.

        # Language

        - Speak only Bangla, the everyday spoken Bangla of Bangladesh. Never the West Bengal or Kolkata variety.
        - Sound like a warm, capable receptionist on the phone, not a textbook. Use natural fillers such as "জি", "আচ্ছা", "ঠিক আছে", "একটু দেখছি".
        - Use Bangladeshi words: "পানি" not "জল", "দাওয়াত" not "নিমন্ত্রণ", "জি" not "হ্যাঁ গো". Greet with "আসসালামু আলাইকুম". Never say "নমস্কার".
        - Address the caller as "আপনি". Call them "স্যার" or "ম্যাডাম" only if it is clear which fits; otherwise use neither.
        - Callers mix English into Bangla. Understand it, and use the common English words people really say: অ্যাপয়েন্টমেন্ট, ডাক্তার, সিরিয়াল, চেকআপ, স্কেলিং, ফিলিং, রুট ক্যানাল, ক্যানসেল.
        - If the caller speaks only English, still answer in simple Bangla, and add a short English phrase only if they clearly do not understand.

        # How you speak

        Your words are turned into speech.

        - One or two short sentences per turn. Ask one question at a time.
        - Write every number in Bangla words, never digits: "সন্ধ্যা ছয়টা", "পাঁচশো টাকা".
        - Read a phone number back digit by digit in Bangla words.
        - Plain text only. No lists, symbols, emojis, or English letters.
        - Never mention tools, systems, ids, or reference codes unless the caller asks for their booking reference.

        # Today and dates

        Now is ${dateForSpeech(new Date())}, ${hourForSpeech(clinicHour(new Date()))}, Dhaka time. Today's date is ${clinicDate(new Date())}.

        When the caller names a day ("কাল", "পরশু", "আগামী রবিবার", "next Sunday"), look it up in this table. Never work out a date yourself. If the day is not in the table, ask for a day within the next two weeks.

        ${upcomingDaysTable()}

        Parts of the day: সকাল is before twelve, দুপুর is twelve to three, বিকাল is three to six, সন্ধ্যা is six to eight.

        # Clinic facts (the only facts you may state)

        - Hours: ${CLINIC.hoursBn}
        - Address: ${CLINIC.addressBn}
        - Front desk phone: ${CLINIC.phoneBn}
        - Doctors:
        ${doctorLines}
        - Fees:
        ${feeLines}
        - Appointments start on the hour and take about forty five minutes.
        - Before a visit: bring any old prescriptions or x-rays, and come ten minutes early.

        # What you do

        Booking:
        1. Find out the reason for the visit in a few words.
        2. Ask which day and roughly what time suits them.
        3. Check availability before offering any time. Offer at most three times.
        4. Ask the caller's full name. Say it back exactly as you heard it and ask only whether it is right. Stop there and wait for their answer.
        5. Ask their mobile number, and add that they can also type it in the box on the page if that is easier. Check what you heard with checkPhoneNumber before you read anything back. Then read it back digit by digit and wait for them to confirm.
        6. Repeat the doctor, day and time, and wait for a clear yes.
        7. Only then book. Afterwards confirm in one sentence, and ask if they need anything else.

        Names: what you receive is a speech recogniser's guess, and names are where it is most often wrong. Never replace the name you heard with a more common or more correct-looking name. If the caller says the name is wrong, ask them to say it once more slowly, and say it back again. If it is still wrong after two tries, keep their latest version and tell them the front desk will check the spelling when they come.

        A confirmation question always stands alone. Never ask for the next detail in the same turn as "is that right?". Only a clear yes ("জি", "হ্যাঁ", "ঠিক আছে") counts. If the answer is unclear or sounds like something else, ask the same question once more.

        Changing or cancelling:
        1. Ask for the mobile number the booking was made with (they can also type it in the box on the page). Check it with checkPhoneNumber, then read it back.
        2. Look up their appointments. If there is more than one, ask which.
        3. For a change, find a new time the same way as for a booking. For a cancellation, confirm they want to cancel.
        4. Wait for a clear yes before changing or cancelling.

        Ending: before saying goodbye, summarise in one sentence what was agreed. Then say "ধন্যবাদ, ভালো থাকবেন।"

        # What you must not do

        - No medical advice. Do not suggest medicines, doses, home remedies, or guess what is wrong. Say the doctor will look at it, and offer an appointment.
        - If the caller describes heavy bleeding, a swollen face, trouble breathing, or an injury, tell them to go to the nearest hospital emergency department now, and offer the earliest appointment.
        - Never state a fee, doctor, time, or fact that is not listed above or returned by a tool. If you do not know, say so and offer a call back from the front desk.
        - Questions that have nothing to do with the clinic (news, weather, sport, general knowledge, other businesses): say politely that you can only help with ${CLINIC.nameBn}, and ask if they need an appointment or clinic information. Do not answer the question.
        - Never say a booking, change, or cancellation is done unless the tool confirmed it.

        # When things go wrong

        - If you did not catch something, say so and ask again. Do not guess a name, number, or date.
        - If the caller is silent, ask gently whether they are still there.
        - If they change their mind mid-way, follow them without complaint.
        - If they want a person, or you cannot help, take a callback request.
      `,

    llm: new inference.LLM({ model: LLM_MODEL }),

    tools: [
      tool({
        name: 'checkAvailability',
        description: dedent`
          Look up free appointment times for one date. Always call this before offering any time.
          Returns free times per doctor, already worded in Bangla. An empty result means closed or full.
        `,
        parameters: z.object({
          date: z.string().describe('Date to check, YYYY-MM-DD, taken from the dates table'),
          partOfDay: z
            .enum(['morning', 'afternoon', 'evening', 'any'])
            .describe('Part of the day the caller prefers; "any" if they did not say'),
          doctor: z.enum(DOCTOR_IDS).nullable().describe('Doctor id if the caller asked for one, otherwise null'),
        }),
        execute: async ({ date, partOfDay, doctor }, { ctx }) => {
          try {
            ctx.session.say('জি, একটু দেখছি।');
          } catch {
            // No speech output available (text-only test run).
          }
          return safely(async () => {
            if (!isValidDate(date)) return 'That is not a valid date. Ask the caller which day they mean.';
            state.startedBooking = true;
            await saveExtraction(state.callId, { preferredDate: date, doctor: doctor ?? undefined });
            report({ step: 'availability_checked' });

            const slots = await getFreeSlots(date, doctor ?? undefined);
            const [from, to] = PART_OF_DAY[partOfDay] ?? PART_OF_DAY.any!;
            const wanted = slots.filter((s) => s.hour >= from && s.hour < to);
            const day = dateForSpeech(new Date(`${date}T12:00:00${CLINIC.utcOffset}`));

            if (slots.length === 0) {
              return `No free times on ${day} (${date}). The clinic is closed that day or fully booked. Offer another day.`;
            }
            const list = (items: typeof slots) =>
              DOCTORS.map((d) => {
                const hours = items.filter((s) => s.doctor === d.id).map((s) => `${hourForSpeech(s.hour)} (${String(s.hour).padStart(2, '0')}:00)`);
                return hours.length ? `${d.nameBn} [${d.id}]: ${hours.join(', ')}` : null;
              })
                .filter(Boolean)
                .join(' | ');

            if (wanted.length === 0) {
              return `Nothing free in the ${partOfDay} on ${day} (${date}). Other free times that day: ${list(slots)}. Offer at most three.`;
            }
            return `Free on ${day} (${date}): ${list(wanted)}. Offer at most three, and let the caller choose.`;
          });
        },
      }),

      tool({
        name: 'checkPhoneNumber',
        description: dedent`
          Check a mobile number the caller has just said or typed, before reading it back to them.
          Speech recognition often drops or doubles a digit, and this finds that out straight away.
        `,
        parameters: z.object({
          phone: z.string().describe('The number exactly as heard, as digits'),
        }),
        execute: async ({ phone }) =>
          safely(async () => {
            const phoneCheck = normalisePhone(phone);
            await saveExtraction(state.callId, {
              phone: phoneCheck.ok ? phoneCheck.phone : phone,
              phoneValid: phoneCheck.ok,
            });
            if (!phoneCheck.ok) {
              return `Not a valid mobile number: ${phoneCheck.reason}. Do not read it back. Say you did not catch the whole number, and ask the caller to say it again slowly or to type it in the box on the page.`;
            }
            report({ step: 'phone_checked' });
            return `Valid number. Read it back exactly like this and wait for a clear yes: ${phoneForSpeech(phoneCheck.phone)}`;
          }),
      }),

      tool({
        name: 'bookAppointment',
        description: dedent`
          Book an appointment. Call only after the caller has confirmed their name, their phone number
          (read back digit by digit), and the doctor, day and time.
        `,
        parameters: z.object({
          fullName: z.string().describe("Caller's full name, in Bangla script if they said it in Bangla"),
          phone: z.string().describe('Mobile number as digits, for example 01711234567'),
          reason: z.string().describe('Reason for the visit in a few words, in Bangla'),
          doctor: z.enum(DOCTOR_IDS).describe('Doctor id'),
          date: z.string().describe('Appointment date, YYYY-MM-DD'),
          time: z.string().describe('Start time, 24 hour HH:00, for example 18:00'),
        }),
        execute: async ({ fullName, phone, reason, doctor, date, time }, { ctx }) => {
          // A booking is a write: an interruption must not leave it half done.
          ctx.disallowInterruptions();
          return safely(async () => {
            const phoneCheck = normalisePhone(phone);
            await saveExtraction(state.callId, {
              patientName: fullName,
              phone: phoneCheck.ok ? phoneCheck.phone : phone,
              phoneValid: phoneCheck.ok,
              reasonForVisit: reason,
              preferredDate: isValidDate(date) ? date : undefined,
              doctor,
              intent: 'book',
            });
            if (!phoneCheck.ok) {
              return `The phone number is not valid: ${phoneCheck.reason}. Nothing was booked. Ask for the mobile number again and read it back.`;
            }
            report({ step: 'phone_checked' });
            const slot = checkSlot(date, time);
            if (!slot.ok) return `Cannot book: ${slot.reason}. Nothing was booked. Check availability and offer another time.`;

            const result = await bookAppointment({
              callId: state.callId,
              fullName,
              phone: phoneCheck.phone,
              doctor,
              reason,
              slotStart: slot.slotStart,
            });
            if (result.status === 'slot_taken') {
              return 'That time was just taken by someone else. Nothing was booked. Check availability again and offer another time.';
            }
            state.booked = true;
            report({ step: 'booked', appointment: appointmentDetails(result.appointment, true) });
            await saveExtraction(state.callId, { preferredTime: time });
            return `Booked. ${describe(result.appointment)}. Patient: ${result.appointment.patientName}, phone ${phoneForSpeech(result.appointment.phone)}. Confirm to the caller in one sentence.`;
          });
        },
      }),

      tool({
        name: 'findAppointments',
        description:
          "Find a caller's upcoming appointments by the mobile number they booked with. Use this before changing or cancelling.",
        parameters: z.object({
          phone: z.string().describe('Mobile number as digits'),
        }),
        execute: async ({ phone }) =>
          safely(async () => {
            const phoneCheck = normalisePhone(phone);
            await saveExtraction(state.callId, {
              phone: phoneCheck.ok ? phoneCheck.phone : phone,
              phoneValid: phoneCheck.ok,
            });
            if (!phoneCheck.ok) return `The phone number is not valid: ${phoneCheck.reason}. Ask for it again and read it back.`;

            report({ step: 'phone_checked' });
            const appointments = await findUpcomingAppointments(phoneCheck.phone);
            if (appointments.length === 0) {
              return `No upcoming appointment under ${phoneForSpeech(phoneCheck.phone)}. Check the number with the caller, or offer to make a new booking.`;
            }
            // Each appointment carries its own name: one phone number can hold
            // bookings for different people.
            const list = appointments.map((a) => `${a.patientName}: ${describe(a)}`).join(' ; ');
            return `Upcoming appointments under this number, each with the name it was booked in: ${list}. Say each name with its own appointment; never give one name for all of them.`;
          }),
      }),

      tool({
        name: 'rescheduleAppointment',
        description: dedent`
          Move an existing appointment to a new date and time. Call only after findAppointments,
          after checking availability for the new time, and after the caller clearly agreed to it.
        `,
        parameters: z.object({
          appointmentId: z.string().describe('The appointmentId returned by findAppointments'),
          date: z.string().describe('New date, YYYY-MM-DD'),
          time: z.string().describe('New start time, 24 hour HH:00'),
          doctor: z.enum(DOCTOR_IDS).nullable().describe('New doctor id, or null to keep the same doctor'),
        }),
        execute: async ({ appointmentId, date, time, doctor }, { ctx }) => {
          ctx.disallowInterruptions();
          return safely(async () => {
            await saveExtraction(state.callId, { intent: 'reschedule', preferredDate: isValidDate(date) ? date : undefined });
            const slot = checkSlot(date, time);
            if (!slot.ok) return `Cannot move it: ${slot.reason}. Nothing was changed. Offer another time.`;

            const result = await rescheduleAppointment({
              callId: state.callId,
              appointmentId,
              slotStart: slot.slotStart,
              doctor: doctor ?? undefined,
            });
            if (result.status === 'not_found') return 'That appointment was not found or is already cancelled. Nothing was changed. Look it up again.';
            if (result.status === 'slot_taken') return 'That time is already taken. Nothing was changed. Check availability and offer another time.';
            state.rescheduled = true;
            report({ step: 'rescheduled', appointment: appointmentDetails(result.appointment) });
            await saveExtraction(state.callId, { preferredTime: time, patientName: result.appointment.patientName });
            return `Moved. New time: ${describe(result.appointment)}. Confirm the new time to the caller in one sentence.`;
          });
        },
      }),

      tool({
        name: 'cancelAppointment',
        description:
          'Cancel an existing appointment. Call only after findAppointments and after the caller clearly confirmed they want to cancel.',
        parameters: z.object({
          appointmentId: z.string().describe('The appointmentId returned by findAppointments'),
        }),
        execute: async ({ appointmentId }, { ctx }) => {
          ctx.disallowInterruptions();
          return safely(async () => {
            await saveExtraction(state.callId, { intent: 'cancel' });
            const result = await cancelAppointment({ callId: state.callId, appointmentId });
            if (result.status === 'not_found') return 'That appointment was not found or is already cancelled. Nothing was changed.';
            state.cancelled = true;
            report({ step: 'cancelled', appointment: appointmentDetails(result.appointment) });
            await saveExtraction(state.callId, { patientName: result.appointment.patientName });
            return `Cancelled: ${describe(result.appointment)}. Tell the caller it is cancelled, and offer to book another time if they wish.`;
          });
        },
      }),

      tool({
        name: 'requestCallback',
        description: dedent`
          Record a request for the front desk to call the caller back. Use when the caller wants a person,
          asks something you cannot answer (medical advice, fees not listed, complaints), or you cannot complete what they need.
        `,
        parameters: z.object({
          reason: z.string().describe('What the caller needs, in a short Bangla sentence'),
          name: z.string().nullable().describe("Caller's name if known, otherwise null"),
          phone: z.string().nullable().describe('Mobile number to call back, if given, otherwise null'),
        }),
        execute: async ({ reason, name, phone }) =>
          safely(async () => {
            const phoneCheck = phone ? normalisePhone(phone) : null;
            await saveExtraction(state.callId, {
              intent: 'callback',
              notes: reason,
              patientName: name ?? undefined,
              phone: phoneCheck?.ok ? phoneCheck.phone : (phone ?? undefined),
              phoneValid: phoneCheck ? phoneCheck.ok : undefined,
            });
            if (phoneCheck && !phoneCheck.ok) {
              return `The phone number is not valid: ${phoneCheck.reason}. Ask for the number again, read it back, then record the callback.`;
            }
            await createCallback({
              callId: state.callId,
              reason,
              name: name ?? undefined,
              phone: phoneCheck?.ok ? phoneCheck.phone : undefined,
            });
            state.callbackRequested = true;
            report({ step: 'callback' });
            return phoneCheck?.ok
              ? 'Callback recorded. Tell the caller someone from the front desk will call them during opening hours.'
              : 'Callback recorded without a phone number. Ask for a mobile number so the front desk can call back, then record it again.';
          }),
      }),
    ],
  });
}
