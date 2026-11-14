import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/portal-auth';
import { login } from '../actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Already logged in: go straight to the call list.
  if (await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value)) redirect('/portal');
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <p className="text-sm font-medium text-teal-700">Dhaka Dental Care</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Staff portal</h1>
        <p className="mt-2 text-sm text-slate-600">
          Calls answered by the Bangla voice receptionist, with transcripts and bookings.
        </p>

        <form
          action={login}
          className="mt-8 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          {error && (
            <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">
              Wrong user name or password.
            </p>
          )}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">User name</span>
            <input
              name="user"
              required
              autoComplete="username"
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 focus:ring-2 focus:ring-teal-600/40 focus:outline-none"
          >
            Log in
          </button>
        </form>
      </div>
    </main>
  );
}
