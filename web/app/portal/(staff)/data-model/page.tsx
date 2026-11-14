// Plain-words explanation of the tables behind the portal (db/schema.sql).

const TABLES: { name: string; one: string; points: string[] }[] = [
  {
    name: 'calls',
    one: 'One row per phone call.',
    points: [
      'Created the moment a call connects, keyed by the LiveKit room name, so a call that drops halfway still has a record.',
      'Holds start and end time, duration, the outcome (status), short summaries in Bangla and English, and any error.',
      'Records which speech-to-text, language and voice models handled the call, so quality and cost can be compared later.',
    ],
  },
  {
    name: 'transcript_turns',
    one: 'Every spoken turn of every call, in order.',
    points: [
      'Each row is one turn: who spoke (agent or caller), what was said in Bangla, and how many milliseconds into the call it was said.',
      'Written while the call is in progress, not at the end.',
    ],
  },
  {
    name: 'call_extractions',
    one: 'The structured details pulled out of one call.',
    points: [
      'Patient name, phone and whether it passed validation, reason for visit, preferred date, time and doctor, intent, notes.',
      'Filled in step by step as the caller gives details. A field that is already known is never erased by a later empty value.',
      'A phone number that fails the check is kept with phone_valid = false, so staff can see what was heard and call back.',
    ],
  },
  {
    name: 'patients',
    one: 'One row per person, identified by their mobile number.',
    points: [
      'Someone who calls three times is one patient with three calls.',
      'Phone numbers are stored in one format (11 digits, e.g. 017XXXXXXXX), after converting Bangla digits and +88 prefixes.',
    ],
  },
  {
    name: 'appointments',
    one: 'Bookings, each linked to the patient and to the call that created it.',
    points: [
      'Has a short reference (DDC-123456) a patient can quote over the phone.',
      'Shows the current slot. Cancelling marks the row as cancelled; nothing is deleted.',
      'The database itself refuses a second live booking for the same doctor and slot, so two callers can never get the same slot, even at the same moment.',
    ],
  },
  {
    name: 'appointment_events',
    one: 'The history of each appointment: booked, rescheduled, cancelled.',
    points: [
      'Append-only. A reschedule adds a row with the old and new slot instead of overwriting the old one.',
      'Each event records which call made the change, so the portal can link from an appointment to every call that touched it.',
    ],
  },
  {
    name: 'callbacks',
    one: 'Requests the receptionist could not handle and passed to staff.',
    points: [
      'For example a fee that is not on the clinic list. Stores who to call, their number and why, with status open or done.',
    ],
  },
];

const FLOW = [
  ['Call connects', 'a row in calls'],
  ['Each turn is spoken', 'a row in transcript_turns'],
  ['Caller gives details', 'call_extractions is filled in'],
  ['Booking, reschedule or cancel', 'appointments changes and appointment_events gets a row'],
  ['Something the agent cannot answer', 'a row in callbacks'],
  ['Call ends', 'calls gets its duration, outcome and summary'],
];

export default function DataModelPage() {
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">How the data is organised</h1>
        <p className="mt-2 text-slate-700">
          Everything links back to the call. For any booking, staff can open the call that created
          it and read exactly what was said. The full definition is in{' '}
          <code className="text-sm">db/schema.sql</code>.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold">How the tables connect</h2>
        <pre className="mt-3 overflow-x-auto font-mono text-xs leading-relaxed text-slate-700 sm:text-sm">
          {`patients ─┬─< calls ─┬─< transcript_turns     (many turns per call)
          │          ├── call_extractions      (one per call)
          │          ├─< callbacks
          │          └─< appointment_events >── appointments
          └─< appointments ── created by one call`}
        </pre>
        <p className="mt-3 text-xs text-slate-500">
          ─&lt; means one to many. A call is linked to a patient once their phone number is
          confirmed.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold">From call to storage</h2>
        <p className="mt-1 text-sm text-slate-600">
          Data is saved during the call, not only at the end, so a dropped call keeps what it
          captured.
        </p>
        <ol className="mt-4 space-y-2 text-sm">
          {FLOW.map(([when, what], i) => (
            <li key={when} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-medium text-teal-800">
                {i + 1}
              </span>
              <span>
                <span className="font-medium">{when}</span>{' '}
                <span className="text-slate-600">→ {what}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">The tables</h2>
        {TABLES.map((t) => (
          <div key={t.name} className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="font-mono text-sm font-semibold text-teal-800">{t.name}</h3>
            <p className="mt-1 text-sm font-medium">{t.one}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {t.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Call outcomes</h2>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="font-medium">Booked</dt>
          <dd className="text-slate-700">A new appointment was made.</dd>
          <dt className="font-medium">Rescheduled</dt>
          <dd className="text-slate-700">An existing appointment was moved.</dd>
          <dt className="font-medium">Cancelled</dt>
          <dd className="text-slate-700">An existing appointment was cancelled.</dd>
          <dt className="font-medium">Enquiry</dt>
          <dd className="text-slate-700">Questions only, nothing booked.</dd>
          <dt className="font-medium">Follow-up needed</dt>
          <dd className="text-slate-700">A callback was requested; staff need to act.</dd>
          <dt className="font-medium">Incomplete</dt>
          <dd className="text-slate-700">The caller started a booking but the call ended first.</dd>
          <dt className="font-medium">Failed</dt>
          <dd className="text-slate-700">A technical error ended the call.</dd>
          <dt className="font-medium">In progress</dt>
          <dd className="text-slate-700">The call has not ended yet.</dd>
        </dl>
      </section>
    </div>
  );
}
