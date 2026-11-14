// Every page in this group needs a logged-in session. The login page sits
// outside the group, so it is reachable without one.
import Link from 'next/link';
import { requireSession } from '@/lib/portal-session';
import { logout } from '../actions';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/portal" className="flex items-baseline gap-2">
            <span className="font-semibold tracking-tight">Dhaka Dental Care</span>
            <span className="text-sm text-slate-500">Staff portal</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/portal"
              className="rounded-md px-3 py-1.5 text-slate-700 hover:bg-slate-100"
            >
              Calls
            </Link>
            <Link
              href="/portal/data-model"
              className="rounded-md px-3 py-1.5 text-slate-700 hover:bg-slate-100"
            >
              How the data is organised
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md px-3 py-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                Log out <span className="hidden text-slate-400 sm:inline">({user})</span>
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </>
  );
}
