// Server-side session check for portal pages and actions.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, verifySessionToken } from './portal-auth';

/**
 * Returns the logged-in user or sends the request to the login page.
 * The middleware already does this; pages call it too so a page is never
 * served without a valid session, even if the middleware is misconfigured.
 */
export async function requireSession(): Promise<string> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = await verifySessionToken(token);
  if (!user) redirect('/portal/login');
  return user;
}
