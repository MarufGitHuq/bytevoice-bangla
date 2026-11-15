// One call: outcome, extracted fields, linked appointment with its history,
// any callback request, the models used, and the full transcript.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StatusBadge } from '@/components/portal/status-badge';
import { type AppointmentEvent, getCallPage } from '@/lib/db';
import {
  INTENT_LABELS,
  appointmentCalendarLink,
  doctorName,
  formatDateTime,
  formatDuration,
  formatOffset,
  formatPlainDate,
  formatPlainTime,
  formatSlot,
} from '@/lib/portal-format';

export const dynamic = 'force-dynamic';

export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await getCallPage(id);
  if (!page) notFound();
  const { call, extraction: x, turns, appointments, callbacks } = page;

  return (
    <div className="space-y-6">
      <Link href="/portal" className="text-sm text-teal-700 hover:underline">
        ← All calls
      </Link>

      {/* ------------------------------------------------- heading */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {call.patientName ?? x?.patientName ?? 'Unknown caller'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {formatDateTime(call.startedAt)} (Dhaka) · {formatDuration(call.durationS)}
            {(call.patientPhone ?? x?.phone) && (
              <span className="ml-2 font-mono">{call.patientPhone ?? x?.phone}</span>
            )}
          </p>
        </div>
        <StatusBadge status={call.status} />
      </header>

      {call.error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span className="font-medium">Error:</span> {call.error}
        </p>
      )}

      {(call.summaryEn || call.summaryBn) && (
        <Card title="Summary">
          {call.summaryEn && <p className="text-sm">{call.summaryEn}</p>}
          {call.summaryBn && (
            <p lang="bn" className="mt-2 text-sm leading-relaxed text-slate-700">
              {call.summaryBn}
            </p>
          )}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ------------------------------------- left: facts */}
        <div className="space-y-6 lg:col-span-2">
          <Card title="Extracted details">
            {x ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <Field label="Patient name" value={x.patientName} bn />
                <dt className="text-slate-500">Phone</dt>
                <dd>
                  {x.phone ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono">{x.phone}</span>
                      {x.phoneValid === true && (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-800">
                          valid
                        </span>
                      )}
                      {x.phoneValid === false && (
                        <span className="rounded bg-rose-50 px-1.5 py-0.5 text-xs text-rose-800">
                          failed check, needs a human
                        </span>
                      )}
                    </span>
                  ) : (
                    <Empty />
                  )}
                </dd>
                <Field label="Reason for visit" value={x.reasonForVisit} bn />
                <Field
                  label="Preferred date"
                  value={x.preferredDate && formatPlainDate(x.preferredDate)}
                />
                <Field
                  label="Preferred time"
                  value={x.preferredTime && formatPlainTime(x.preferredTime)}
                />
                <Field label="Doctor" value={x.doctor && doctorName(x.doctor)} />
                <Field label="Intent" value={x.intent && (INTENT_LABELS[x.intent] ?? x.intent)} />
                <Field label="Notes" value={x.notes} bn />
              </dl>
            ) : (
              <p className="text-sm text-slate-500">Nothing was captured on this call.</p>
            )}
          </Card>

          <Card title="Appointment">
            {appointments.length === 0 ? (
              <p className="text-sm text-slate-500">No appointment is linked to this call.</p>
            ) : (
              <div className="space-y-5">
                {appointments.map((a) => (
                  <div key={a.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-sm font-medium">{a.reference}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          a.status === 'booked'
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {a.status === 'booked' ? 'Active' : 'Cancelled'}
                      </span>
                    </div>
                    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                      <Field
                        label={a.status === 'booked' ? 'Slot' : 'Was for'}
                        value={formatSlot(a.slotStart)}
                      />
                      <Field label="Doctor" value={doctorName(a.doctor)} />
                      <Field label="Patient" value={`${a.patientName} · ${a.patientPhone}`} bn />
                      <Field label="Reason" value={a.reason} bn />
                      <Field
                        label="This call"
                        value={a.createdByThisCall ? 'Created it' : 'Changed it'}
                      />
                    </dl>
                    {a.status === 'booked' && (
                      <a
                        href={appointmentCalendarLink(a)}
                        download={`appointment-${a.reference}.ics`}
                        className="mt-4 inline-flex items-center gap-2 rounded-md border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50"
                      >
                        Add to doctor&apos;s calendar (.ics)
                      </a>
                    )}
                    <h3 className="mt-4 text-xs font-medium tracking-wide text-slate-500 uppercase">
                      History
                    </h3>
                    <ol className="mt-2 space-y-2 border-l-2 border-slate-200 pl-4">
                      {a.events.map((e, i) => (
                        <HistoryItem key={i} event={e} currentCallId={call.id} />
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {callbacks.length > 0 && (
            <Card title="Callback request">
              <ul className="space-y-3 text-sm">
                {callbacks.map((cb) => (
                  <li key={cb.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{cb.name ?? 'No name given'}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          cb.status === 'open'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {cb.status === 'open' ? 'Open' : 'Done'}
                      </span>
                    </div>
                    {cb.phone && <p className="font-mono text-slate-600">{cb.phone}</p>}
                    <p lang="bn" className="mt-1">
                      {cb.reason}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Requested {formatDateTime(cb.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Call record">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <Field label="Started" value={formatDateTime(call.startedAt)} />
              <Field label="Ended" value={call.endedAt ? formatDateTime(call.endedAt) : null} />
              <Field label="Speech to text" value={call.sttModel} mono />
              <Field label="Language model" value={call.llmModel} mono />
              <Field label="Text to speech" value={call.ttsModel} mono />
              <Field label="Room" value={call.roomName} mono />
            </dl>
          </Card>
        </div>

        {/* --------------------------------- right: transcript */}
        <div className="lg:col-span-3">
          <Card title={`Transcript (${turns.length} ${turns.length === 1 ? 'turn' : 'turns'})`}>
            {turns.length === 0 ? (
              <p className="text-sm text-slate-500">No speech was recorded.</p>
            ) : (
              <ol className="space-y-3">
                {turns.map((t) => {
                  const agent = t.speaker === 'agent';
                  return (
                    <li key={t.seq} className={`flex ${agent ? 'justify-start' : 'justify-end'}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                          agent
                            ? 'rounded-tl-sm bg-slate-100'
                            : 'rounded-tr-sm bg-teal-50 ring-1 ring-teal-100'
                        }`}
                      >
                        <p className="flex items-center gap-2 text-xs text-slate-500">
                          <span
                            className={`font-medium ${agent ? 'text-slate-700' : 'text-teal-800'}`}
                          >
                            {agent ? 'Agent' : 'Caller'}
                          </span>
                          <span className="tabular-nums">{formatOffset(t.offsetMs)}</span>
                        </p>
                        <p lang="bn" className="mt-1 text-[15px] leading-relaxed">
                          {t.text}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  bn,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  bn?: boolean;
  mono?: boolean;
}) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd
        lang={bn ? 'bn' : undefined}
        className={`min-w-0 break-words ${mono ? 'font-mono text-xs' : ''}`}
      >
        {value || <Empty />}
      </dd>
    </>
  );
}

function Empty() {
  return <span className="text-slate-400">—</span>;
}

const EVENT_LABELS = {
  booked: 'Booked',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
} as const;

function HistoryItem({
  event: e,
  currentCallId,
}: {
  event: AppointmentEvent;
  currentCallId: string;
}) {
  const detail =
    e.event === 'booked'
      ? `for ${formatSlot(e.toSlot)}`
      : e.event === 'rescheduled'
        ? `from ${formatSlot(e.fromSlot)} to ${formatSlot(e.toSlot)}`
        : `was ${formatSlot(e.fromSlot)}`;
  return (
    <li className="text-sm">
      <span className="font-medium">{EVENT_LABELS[e.event]}</span>{' '}
      <span className="text-slate-700">{detail}</span>
      <span className="block text-xs text-slate-500">
        {formatDateTime(e.createdAt)} ·{' '}
        {e.callId === currentCallId ? (
          'this call'
        ) : e.callId ? (
          <Link href={`/portal/calls/${e.callId}`} className="text-teal-700 hover:underline">
            another call
          </Link>
        ) : (
          'call record removed'
        )}
      </span>
    </li>
  );
}
