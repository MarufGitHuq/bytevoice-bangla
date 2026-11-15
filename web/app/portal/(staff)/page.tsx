// Call list: overview counts, search and status filter, then every call.
// Search and filter are a plain GET form, so the URL holds the current view
// (?q=...&status=...) and the page needs no client-side JavaScript.
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { StatusBadge } from '@/components/portal/status-badge';
import { CALL_STATUSES, getOverview, isCallStatus, listCalls, listOpenCallbacks } from '@/lib/db';
import { STATUS_LABELS, formatDateTime, formatDuration } from '@/lib/portal-format';

export const dynamic = 'force-dynamic';

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? '').slice(0, 100);
  const status = isCallStatus(params.status) ? params.status : undefined;

  const [overview, calls, callbacks] = await Promise.all([
    getOverview(),
    listCalls({ search: q, status }),
    listOpenCallbacks(),
  ]);
  const filtered = Boolean(q || status);

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------ overview */}
      <section aria-label="Overview" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Calls" value={overview.total} />
        <Stat label="Booked" value={overview.byStatus.booked ?? 0} href="/portal?status=booked" />
        <Stat
          label="Follow-up needed"
          value={overview.byStatus.follow_up_needed ?? 0}
          href="/portal?status=follow_up_needed"
        />
        <Stat label="Upcoming appointments" value={overview.upcomingAppointments} />
      </section>

      {callbacks.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-amber-900">
            Open callback requests ({callbacks.length})
          </h2>
          <ul className="mt-3 divide-y divide-amber-200/70">
            {callbacks.map((cb) => (
              <li
                key={cb.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">{cb.name ?? 'Unknown caller'}</span>
                  {cb.phone && <span className="ml-2 font-mono text-slate-600">{cb.phone}</span>}
                  <span className="ml-2 text-slate-700">· {cb.reason}</span>
                </span>
                <span className="flex items-baseline gap-3 text-slate-500">
                  {formatDateTime(cb.createdAt)}
                  {cb.callId && (
                    <Link
                      href={`/portal/calls/${cb.callId}`}
                      className="font-medium text-teal-700 hover:underline"
                    >
                      View call
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ------------------------------------------- search & filter */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight">Calls</h1>
          <form method="get" className="flex w-full flex-wrap gap-2 sm:w-auto">
            <label className="sr-only" htmlFor="q">
              Search by name or phone
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Name or phone"
              className="min-w-0 basis-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 sm:w-56 sm:basis-auto"
            />
            <label className="sr-only" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status ?? ''}
              className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 sm:flex-none"
            >
              <option value="">All statuses</option>
              {CALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]} ({overview.byStatus[s] ?? 0})
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              Search
            </button>
            {filtered && (
              <Link
                href="/portal"
                className="self-center px-2 text-sm text-slate-600 hover:underline"
              >
                Clear
              </Link>
            )}
          </form>
        </div>

        <p className="text-sm text-slate-600">
          {calls.length} {calls.length === 1 ? 'call' : 'calls'}
          {filtered ? (calls.length === 1 ? ' matches' : ' match') : ''}. Times are Dhaka time.
          Select a call to open its transcript and details.
        </p>

        {calls.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
            No calls found.
          </p>
        ) : (
          <>
            {/* Table on wider screens */}
            <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">Date and time</th>
                    <th className="px-4 py-3">Caller</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Summary</th>
                    <th className="px-4 py-3">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calls.map((call) => (
                    <tr key={call.id} className="group relative cursor-pointer hover:bg-teal-50/60">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {/* The link covers the whole row (after:inset-0). */}
                        <Link
                          href={`/portal/calls/${call.id}`}
                          className="font-medium text-slate-900 group-hover:text-teal-800 after:absolute after:inset-0"
                        >
                          {formatDateTime(call.startedAt)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Caller name={call.callerName} phone={call.callerPhone} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                        {formatDuration(call.durationS)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={call.status} />
                      </td>
                      <td className="max-w-xs px-4 py-3 text-slate-600">
                        <span className="line-clamp-2">{call.summaryEn ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-0.5 text-sm font-medium text-teal-700">
                          View
                          <ChevronRight className="size-4" aria-hidden="true" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards on phones */}
            <ul className="space-y-3 md:hidden">
              {calls.map((call) => (
                <li key={call.id}>
                  <Link
                    href={`/portal/calls/${call.id}`}
                    className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-teal-300"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Caller name={call.callerName} phone={call.callerPhone} />
                      <StatusBadge status={call.status} />
                    </div>
                    <p className="mt-2 flex items-center justify-between gap-3 text-sm text-slate-600">
                      <span>
                        {formatDateTime(call.startedAt)} · {formatDuration(call.durationS)}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-0.5 font-medium text-teal-700">
                        View
                        <ChevronRight className="size-4" aria-hidden="true" />
                      </span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const body = (
    <>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </>
  );
  const cls = 'block rounded-xl border border-slate-200 bg-white p-4';
  return href ? (
    <Link href={href} className={`${cls} hover:border-teal-300 hover:bg-teal-50/40`}>
      {body}
      <p className="mt-2 inline-flex items-center gap-0.5 text-xs font-medium text-teal-700">
        Show these calls
        <ChevronRight className="size-3.5" aria-hidden="true" />
      </p>
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Caller({ name, phone }: { name: string | null; phone: string | null }) {
  if (!name && !phone) return <span className="text-slate-400">Unknown caller</span>;
  return (
    <span className="block">
      <span className="block font-medium">{name ?? 'Name not given'}</span>
      {phone && <span className="block font-mono text-xs text-slate-500">{phone}</span>}
    </span>
  );
}
