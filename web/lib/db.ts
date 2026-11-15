// Read-only database access for the staff portal. Every portal query lives in
// this file, and every query is parameterised: user input (search text, ids)
// is passed as $1, $2 ..., never pasted into SQL. Only server code imports it.
import pg from 'pg';

let pool: pg.Pool | undefined;

function db(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not set');
    // Same rule as agent/src/store.ts: the local dev database has no TLS; any
    // other host is reached over TLS with its certificate verified. A private
    // CA (Supabase publishes one) goes in DATABASE_CA_CERT.
    const isLocal = /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(connectionString);
    pool = new pg.Pool({
      connectionString,
      max: 3,
      ssl: isLocal ? undefined : { rejectUnauthorized: true, ca: caCertificate() },
    });
  }
  return pool;
}

// Return `date` and `time` columns as plain strings ("2026-11-17", "11:00:00")
// instead of JS Dates, so no time zone is applied to values that have none.
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);
pg.types.setTypeParser(pg.types.builtins.TIME, (v) => v);

export const CALL_STATUSES = [
  'in_progress',
  'booked',
  'rescheduled',
  'cancelled',
  'enquiry',
  'follow_up_needed',
  'incomplete',
  'failed',
] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

export function isCallStatus(value: string | undefined): value is CallStatus {
  return CALL_STATUSES.includes(value as CallStatus);
}

// ------------------------------------------------------------ call list

export interface CallRow {
  id: string;
  startedAt: Date;
  durationS: number | null;
  status: CallStatus;
  // Best known name and phone: the linked patient first, else what the call captured.
  callerName: string | null;
  callerPhone: string | null;
  summaryEn: string | null;
}

/** Calls, newest first. `search` matches name or phone; `status` filters exactly. */
export async function listCalls(filter: {
  search?: string;
  status?: CallStatus;
}): Promise<CallRow[]> {
  const search = filter.search?.trim() || null;
  const { rows } = await db().query<CallRow>(
    `select c.id,
            c.started_at as "startedAt",
            c.duration_s as "durationS",
            c.status,
            coalesce(p.full_name, x.patient_name) as "callerName",
            coalesce(p.phone, x.phone)            as "callerPhone",
            c.summary_en as "summaryEn"
       from calls c
       left join patients p         on p.id = c.patient_id
       left join call_extractions x on x.call_id = c.id
      where ($1::text is null or c.status = $1)
        and ($2::text is null
             or coalesce(p.full_name, x.patient_name, '') ilike '%' || $2 || '%'
             or coalesce(p.phone, x.phone, '')            like  '%' || $2 || '%')
      order by c.started_at desc
      limit 200`,
    [filter.status ?? null, search]
  );
  return rows;
}

export interface Overview {
  total: number;
  byStatus: Partial<Record<CallStatus, number>>;
  openCallbacks: number;
  upcomingAppointments: number;
}

export async function getOverview(): Promise<Overview> {
  const [statuses, extra] = await Promise.all([
    db().query<{ status: CallStatus; n: number }>(
      `select status, count(*)::int as n from calls group by status`
    ),
    db().query<{ open_callbacks: number; upcoming: number }>(
      `select (select count(*)::int from callbacks where status = 'open') as open_callbacks,
              (select count(*)::int from appointments
                where status = 'booked' and slot_start > now()) as upcoming`
    ),
  ]);
  const byStatus: Overview['byStatus'] = {};
  let total = 0;
  for (const row of statuses.rows) {
    byStatus[row.status] = row.n;
    total += row.n;
  }
  return {
    total,
    byStatus,
    openCallbacks: extra.rows[0]?.open_callbacks ?? 0,
    upcomingAppointments: extra.rows[0]?.upcoming ?? 0,
  };
}

// ------------------------------------------------------------- one call

export interface CallDetail {
  id: string;
  roomName: string;
  startedAt: Date;
  endedAt: Date | null;
  durationS: number | null;
  status: CallStatus;
  summaryBn: string | null;
  summaryEn: string | null;
  sttModel: string | null;
  llmModel: string | null;
  ttsModel: string | null;
  error: string | null;
  patientName: string | null;
  patientPhone: string | null;
}

export interface Extraction {
  patientName: string | null;
  phone: string | null;
  phoneValid: boolean | null;
  reasonForVisit: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  doctor: string | null;
  intent: string | null;
  notes: string | null;
}

export interface Turn {
  seq: number;
  speaker: 'agent' | 'caller';
  text: string;
  offsetMs: number;
}

export interface AppointmentEvent {
  event: 'booked' | 'rescheduled' | 'cancelled';
  fromSlot: Date | null;
  toSlot: Date | null;
  createdAt: Date;
  callId: string | null;
}

export interface LinkedAppointment {
  id: string;
  reference: string;
  doctor: string;
  reason: string | null;
  slotStart: Date;
  status: 'booked' | 'cancelled';
  patientName: string;
  patientPhone: string;
  // How this call touched the appointment: it created it, or changed it later.
  createdByThisCall: boolean;
  events: AppointmentEvent[];
}

export interface Callback {
  id: string;
  name: string | null;
  phone: string | null;
  reason: string;
  status: 'open' | 'done';
  createdAt: Date;
}

export interface CallPage {
  call: CallDetail;
  extraction: Extraction | null;
  turns: Turn[];
  appointments: LinkedAppointment[];
  callbacks: Callback[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Everything the per-call page shows. Returns null for an unknown id. */
export async function getCallPage(id: string): Promise<CallPage | null> {
  if (!UUID.test(id)) return null;

  const call = await db().query<CallDetail>(
    `select c.id, c.room_name as "roomName", c.started_at as "startedAt", c.ended_at as "endedAt",
            c.duration_s as "durationS", c.status, c.summary_bn as "summaryBn", c.summary_en as "summaryEn",
            c.stt_model as "sttModel", c.llm_model as "llmModel", c.tts_model as "ttsModel", c.error,
            p.full_name as "patientName", p.phone as "patientPhone"
       from calls c left join patients p on p.id = c.patient_id
      where c.id = $1`,
    [id]
  );
  if (!call.rows[0]) return null;

  const [extraction, turns, appointments, callbacks] = await Promise.all([
    db().query<Extraction>(
      `select patient_name as "patientName", phone, phone_valid as "phoneValid",
              reason_for_visit as "reasonForVisit", preferred_date as "preferredDate",
              preferred_time as "preferredTime", doctor, intent, notes
         from call_extractions where call_id = $1`,
      [id]
    ),
    db().query<Turn>(
      `select seq, speaker, text_bn as text, offset_ms as "offsetMs"
         from transcript_turns where call_id = $1 order by seq`,
      [id]
    ),
    // Appointments this call created, plus any it rescheduled or cancelled.
    db().query<Omit<LinkedAppointment, 'events'>>(
      `select a.id, a.reference, a.doctor, a.reason, a.slot_start as "slotStart", a.status,
              p.full_name as "patientName", p.phone as "patientPhone",
              (a.call_id = $1) as "createdByThisCall"
         from appointments a join patients p on p.id = a.patient_id
        where a.call_id = $1
           or a.id in (select appointment_id from appointment_events where call_id = $1)
        order by a.created_at`,
      [id]
    ),
    db().query<Callback>(
      `select id, name, phone, reason, status, created_at as "createdAt"
         from callbacks where call_id = $1 order by created_at`,
      [id]
    ),
  ]);

  const ids = appointments.rows.map((a) => a.id);
  const events = ids.length
    ? await db().query<AppointmentEvent & { appointmentId: string }>(
        `select appointment_id as "appointmentId", event, from_slot as "fromSlot",
                to_slot as "toSlot", created_at as "createdAt", call_id as "callId"
           from appointment_events where appointment_id = any($1::uuid[])
          order by created_at, id`,
        [ids]
      )
    : { rows: [] };

  return {
    call: call.rows[0],
    extraction: extraction.rows[0] ?? null,
    turns: turns.rows,
    appointments: appointments.rows.map((a) => ({
      ...a,
      events: events.rows.filter((e) => e.appointmentId === a.id),
    })),
    callbacks: callbacks.rows,
  };
}

// ------------------------------------------------------------ callbacks

export interface OpenCallback extends Callback {
  callId: string | null;
}

export async function listOpenCallbacks(): Promise<OpenCallback[]> {
  const { rows } = await db().query<OpenCallback>(
    `select id, call_id as "callId", name, phone, reason, status, created_at as "createdAt"
       from callbacks where status = 'open' order by created_at desc limit 50`
  );
  return rows;
}

/**
 * The database host's CA certificate, if one was given. Some hosts only accept
 * single-line settings, so line breaks may arrive as a backslash followed by n.
 */
function caCertificate(): string | undefined {
  return process.env.DATABASE_CA_CERT?.replace(/\\n/g, '\n') || undefined;
}
