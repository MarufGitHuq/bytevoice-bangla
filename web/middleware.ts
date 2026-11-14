// Sends anyone without a valid portal session to the login page before any
// portal page runs. Pages also check the session themselves (requireSession).
import { type NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/portal-auth';

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/portal/login') return NextResponse.next();

  const user = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (user) return NextResponse.next();

  return NextResponse.redirect(new URL('/portal/login', request.url));
}

export const config = {
  matcher: ['/portal', '/portal/:path*'],
};
