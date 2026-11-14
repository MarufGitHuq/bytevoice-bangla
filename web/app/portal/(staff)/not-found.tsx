import Link from 'next/link';

export default function PortalNotFound() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <h1 className="font-semibold">Call not found</h1>
      <p className="mt-1 text-sm text-slate-600">
        The link may be wrong, or the call record was removed.
      </p>
      <Link
        href="/portal"
        className="mt-4 inline-block text-sm font-medium text-teal-700 hover:underline"
      >
        ← All calls
      </Link>
    </div>
  );
}
