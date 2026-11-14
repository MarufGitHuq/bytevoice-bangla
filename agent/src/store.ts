// Storage for call data. This is the only file that talks to the database.
//
// Flow from a live call into storage:
//   call starts      -> startCall()        one row in `calls`
//   each spoken turn -> addTurn()          one row in `transcript_turns`
//   details captured -> saveExtraction()   one row in `call_extractions`, updated as we learn more
//   a tool acts      -> book / reschedule / cancel / createCallback
//   call ends        -> endCall()          duration, final status, summary
//
// Writes happen during the call, not at the end, so a dropped call still
// leaves an accurate record of everything up to that point.
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { CLINIC, DOCTORS, type DoctorId, SLOT_HOURS } from './clinic.ts';
import { clinicDate, clinicHour, isValidDate, weekdayOf } from './validation.ts';

let pool: pg.Pool | undefined;

function db(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not set');
    const isLocal = /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(connectionString);
    pool = new pg.Pool({
      connectionString,
      max: 5,
      // The local dev database has no TLS. A hosted database is always reached
      // over TLS with the server certificate verified. If the host's certificate
      // is signed by its own CA (Supabase publishes one), pass that CA in
      // DATABASE_CA_CERT rather than turning verification off.
      ssl: isLocal ? undefined : { rejectUnauthorized: true, ca: process.env.DATABASE_CA_CERT || undefined },
    });
  }
  return pool;
}

export async function closeStore() {
  await pool?.end();
  pool = undefined;
}

// ---------------------------------------------------------------- calls

export type CallStatus =
  | 'in_progress'
  | 'booked'
  | 'rescheduled'
  | 'cancelled'
  | 'enquiry'
  | 'follow_up_needed'
  | 'incomplete'
  | 'failed';

export interface CallModels {
  stt: string;
  llm: string;
  tts: string;
}

/** Creates the call record. Safe to call twice for the same room. */
export async function startCall(roomName: string, models: CallModels): Promise<string> {
  const { rows } = await db().query<{ id: string }>(
    `insert into calls (room_name, stt_model, llm_model, tts_model)
     values ($1, $2, $3, $4)
     on conflict (room_name) do update set room_name = excluded.room_name
     returning id`,
    [roomName, models.stt, models.llm, models.tts],
  );
  return rows[0]!.id;
}

export async function addTurn(callId: string, seq: number, speaker: 'agent' | 'caller', text: string, offsetMs: number) {
  await db().query(
    `insert into transcript_turns (call_id, seq, speaker, text_bn, offset_ms)
     values ($1, $2, $3, $4, $5)
     on conflict (call_id, seq) do nothing`,
    [callId, seq, speaker, text, Math.max(0, Math.round(offsetMs))],
  );
}

export interface Extraction {
  patientName?: string | undefined;
  phone?: string | undefined;
  phoneValid?: boolean | undefined;
  reasonForVisit?: string | undefined;
  preferredDate?: string | undefined;
  preferredTime?: string | undefined;
  doctor?: string | undefined;
  intent?: 'book' | 'reschedule' | 'cancel' | 'enquiry' | 'callback' | 'other' | undefined;
  notes?: string | undefined;
}

/** Merges newly learned fields into the call's extraction; never erases a known field. */
export async function saveExtraction(callId: string, fields: Extraction) {
  await db().query(
    `insert into call_extractions
       (call_id, patient_name, phone, phone_valid, reason_for_visit, preferred_date, preferred_time, doctor, intent, notes)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict (call_id) do update set
       patient_name     = coalesce(excluded.patient_name, call_extractions.patient_name),
       phone            = coalesce(excluded.phone, call_extractions.phone),
       phone_valid      = coalesce(excluded.phone_valid, call_extractions.phone_valid),
       reason_for_visit = coalesce(excluded.reason_for_visit, call_extractions.reason_for_visit),
       preferred_date   = coalesce(excluded.preferred_date, call_extractions.preferred_date),
       preferred_time   = coalesce(excluded.preferred_time, call_extractions.preferred_time),
       doctor           = coalesce(excluded.doctor, call_extractions.doctor),
       intent           = coalesce(excluded.intent, call_extractions.intent),
       notes            = coalesce(excluded.notes, call_extractions.notes),
       updated_at       = now()`,
    [
      callId,
      fields.patientName ?? null,
      fields.phone ?? null,
      fields.phoneValid ?? null,
      fields.reasonForVisit ?? null,
      fields.preferredDate ?? null,
      fields.preferredTime ?? null,
      fields.doctor ?? null,
      fields.intent ?? null,
      fields.notes ?? null,
    ],
  );
}

export async function endCall(
  callId: string,
  result: {
    status: CallStatus;
    summaryBn?: string | undefined;
    summaryEn?: string | undefined;
    error?: string | undefined;
  },
) {
  await db().query(
    `update calls set
       ended_at   = now(),
       duration_s = greatest(0, extract(epoch from (now() - started_at))::int),
       status     = $2,
       summary_bn = $3,
       summary_en = $4,
       error      = $5
     where id = $1`,
    [callId, result.status, result.summaryBn ?? null, result.summaryEn ?? null, result.error ?? null],
  );
}

// ------------------------------------------------------------- patients

async function upsertPatient(client: pg.PoolClient, fullName: string, phone: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `insert into patients (full_name, phone) values ($1, $2)
     on conflict (phone) do update set full_name = excluded.full_name, updated_at = now()
     returning id`,
    [fullName.trim(), phone],
  );
  return rows[0]!.id;
}

// --------------------------------------------------------- availability

export interface FreeSlot {
  doctor: DoctorId;
  hour: number;
}

/** Free slots on one date. Closed days and past times return nothing. */
export async function getFreeSlots(date: string, doctor?: DoctorId, now = new Date()): Promise<FreeSlot[]> {
  if (!isValidDate(date)) throw new Error('date must be YYYY-MM-DD');
  if (weekdayOf(date) === CLINIC.closedWeekday) return [];

  const { rows } = await db().query<{ doctor: string; slot_start: Date }>(
    `select doctor, slot_start from appointments
     where status = 'booked'
       and slot_start >= $1::timestamptz and slot_start < $1::timestamptz + interval '1 day'`,
    [`${date}T00:00:00${CLINIC.utcOffset}`],
  );
  const taken = new Set(rows.map((r) => `${r.doctor}@${clinicHour(r.slot_start)}`));

  const today = clinicDate(now);
  if (date < today) return [];
  const earliestHour = date === today ? clinicHour(now) + 1 : 0;

  const doctors = doctor ? [doctor] : DOCTORS.map((d) => d.id);
  const free: FreeSlot[] = [];
  for (const hour of SLOT_HOURS) {
    if (hour < earliestHour) continue;
    for (const id of doctors) {
      if (!taken.has(`${id}@${hour}`)) free.push({ doctor: id, hour });
    }
  }
  return free;
}

// --------------------------------------------------------- appointments

export interface Appointment {
  id: string;
  reference: string;
  doctor: string;
  reason: string | null;
  slotStart: Date;
  status: 'booked' | 'cancelled';
  patientName: string;
  phone: string;
}

function newReference() {
  // Short, unambiguous when read aloud: digits only.
  return `DDC-${(randomBytes(3).readUIntBE(0, 3) % 1_000_000).toString().padStart(6, '0')}`;
}

const APPOINTMENT_COLUMNS = `a.id, a.reference, a.doctor, a.reason, a.slot_start as "slotStart", a.status,
  p.full_name as "patientName", p.phone`;

export type BookResult =
  | { status: 'booked' | 'already_booked'; appointment: Appointment }
  | { status: 'slot_taken' };

/**
 * Books a slot. The whole thing is one transaction, and the database's unique
 * index on (doctor, slot) is what guarantees no double booking, even if two
 * calls try the same slot at the same moment.
 */
export async function bookAppointment(input: {
  callId: string;
  fullName: string;
  phone: string;
  doctor: DoctorId;
  reason: string;
  slotStart: string;
}): Promise<BookResult> {
  const client = await db().connect();
  try {
    await client.query('begin');
    const patientId = await upsertPatient(client, input.fullName, input.phone);

    // The same patient asking for the same slot again (a repeated tool call or
    // a retry) gets their existing booking back instead of an error.
    const existing = await client.query<Appointment>(
      `select ${APPOINTMENT_COLUMNS} from appointments a join patients p on p.id = a.patient_id
       where a.patient_id = $1 and a.doctor = $2 and a.slot_start = $3 and a.status = 'booked'`,
      [patientId, input.doctor, input.slotStart],
    );
    if (existing.rows[0]) {
      await client.query('commit');
      return { status: 'already_booked', appointment: existing.rows[0] };
    }

    const inserted = await client.query<{ id: string }>(
      `insert into appointments (reference, patient_id, call_id, doctor, reason, slot_start)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (doctor, slot_start) where status = 'booked' do nothing
       returning id`,
      [newReference(), patientId, input.callId, input.doctor, input.reason, input.slotStart],
    );
    if (!inserted.rows[0]) {
      await client.query('rollback');
      return { status: 'slot_taken' };
    }

    const appointmentId = inserted.rows[0].id;
    await client.query(
      `insert into appointment_events (appointment_id, call_id, event, to_slot) values ($1, $2, 'booked', $3)`,
      [appointmentId, input.callId, input.slotStart],
    );
    await client.query(`update calls set patient_id = $2 where id = $1`, [input.callId, patientId]);
    const { rows } = await client.query<Appointment>(
      `select ${APPOINTMENT_COLUMNS} from appointments a join patients p on p.id = a.patient_id where a.id = $1`,
      [appointmentId],
    );
    await client.query('commit');
    return { status: 'booked', appointment: rows[0]! };
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** Upcoming live appointments for a phone number, soonest first. */
export async function findUpcomingAppointments(phone: string, now = new Date()): Promise<Appointment[]> {
  const { rows } = await db().query<Appointment>(
    `select ${APPOINTMENT_COLUMNS} from appointments a join patients p on p.id = a.patient_id
     where p.phone = $1 and a.status = 'booked' and a.slot_start > $2
     order by a.slot_start`,
    [phone, now],
  );
  return rows;
}

export type RescheduleResult =
  | { status: 'rescheduled'; appointment: Appointment; previousSlot: Date }
  | { status: 'slot_taken' }
  | { status: 'not_found' };

/** Moves an appointment to a new slot and records the old one in the history. */
export async function rescheduleAppointment(input: {
  callId: string;
  appointmentId: string;
  slotStart: string;
  doctor?: DoctorId | undefined;
}): Promise<RescheduleResult> {
  const client = await db().connect();
  try {
    await client.query('begin');
    const current = await client.query<{ slot_start: Date; doctor: string; patient_id: string }>(
      `select slot_start, doctor, patient_id from appointments where id = $1 and status = 'booked' for update`,
      [input.appointmentId],
    );
    if (!current.rows[0]) {
      await client.query('rollback');
      return { status: 'not_found' };
    }
    const doctor = input.doctor ?? current.rows[0].doctor;

    const clash = await client.query(
      `select 1 from appointments where doctor = $1 and slot_start = $2 and status = 'booked' and id <> $3`,
      [doctor, input.slotStart, input.appointmentId],
    );
    if (clash.rowCount) {
      await client.query('rollback');
      return { status: 'slot_taken' };
    }

    await client.query(`update appointments set slot_start = $2, doctor = $3, updated_at = now() where id = $1`, [
      input.appointmentId,
      input.slotStart,
      doctor,
    ]);
    await client.query(
      `insert into appointment_events (appointment_id, call_id, event, from_slot, to_slot)
       values ($1, $2, 'rescheduled', $3, $4)`,
      [input.appointmentId, input.callId, current.rows[0].slot_start, input.slotStart],
    );
    await client.query(`update calls set patient_id = $2 where id = $1`, [input.callId, current.rows[0].patient_id]);
    const { rows } = await client.query<Appointment>(
      `select ${APPOINTMENT_COLUMNS} from appointments a join patients p on p.id = a.patient_id where a.id = $1`,
      [input.appointmentId],
    );
    await client.query('commit');
    return { status: 'rescheduled', appointment: rows[0]!, previousSlot: current.rows[0].slot_start };
  } catch (error) {
    await client.query('rollback').catch(() => {});
    // Two calls racing for the same slot: the unique index rejects the loser.
    if ((error as { code?: string }).code === '23505') return { status: 'slot_taken' };
    throw error;
  } finally {
    client.release();
  }
}

export type CancelResult = { status: 'cancelled'; appointment: Appointment } | { status: 'not_found' };

/** Cancels an appointment. The row is kept and marked, never deleted. */
export async function cancelAppointment(input: { callId: string; appointmentId: string }): Promise<CancelResult> {
  const client = await db().connect();
  try {
    await client.query('begin');
    const updated = await client.query<{ slot_start: Date; patient_id: string }>(
      `update appointments set status = 'cancelled', updated_at = now()
       where id = $1 and status = 'booked' returning slot_start, patient_id`,
      [input.appointmentId],
    );
    if (!updated.rows[0]) {
      await client.query('rollback');
      return { status: 'not_found' };
    }
    await client.query(
      `insert into appointment_events (appointment_id, call_id, event, from_slot) values ($1, $2, 'cancelled', $3)`,
      [input.appointmentId, input.callId, updated.rows[0].slot_start],
    );
    await client.query(`update calls set patient_id = $2 where id = $1`, [input.callId, updated.rows[0].patient_id]);
    const { rows } = await client.query<Appointment>(
      `select ${APPOINTMENT_COLUMNS} from appointments a join patients p on p.id = a.patient_id where a.id = $1`,
      [input.appointmentId],
    );
    await client.query('commit');
    return { status: 'cancelled', appointment: rows[0]! };
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// ------------------------------------------------------------ callbacks

/** Records a request the agent could not handle, for staff to follow up. */
export async function createCallback(input: {
  callId: string;
  name?: string | undefined;
  phone?: string | undefined;
  reason: string;
}) {
  await db().query(`insert into callbacks (call_id, name, phone, reason) values ($1, $2, $3, $4)`, [
    input.callId,
    input.name ?? null,
    input.phone ?? null,
    input.reason,
  ]);
}
