'use server';

// Log in and log out. Runs on the server only.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHash, timingSafeEqual } from 'node:crypto';
import { SESSION_COOKIE, SESSION_MAX_AGE_S, createSessionToken } from '@/lib/portal-auth';

/** Compares two strings in constant time, so timing does not leak how much matched. */
function sameText(a: string, b: string): boolean {
  // Hashing first gives both sides the same length, which timingSafeEqual needs.
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function login(formData: FormData) {
  const expectedUser = process.env.PORTAL_USER;
  const expectedPassword = process.env.PORTAL_PASSWORD;
  if (!expectedUser || !expectedPassword)
    throw new Error('PORTAL_USER and PORTAL_PASSWORD must be set');

  const user = String(formData.get('user') ?? '');
  const password = String(formData.get('password') ?? '');
  // Check both, always, so a wrong user name takes as long as a wrong password.
  const userOk = sameText(user, expectedUser);
  const passwordOk = sameText(password, expectedPassword);
  if (!userOk || !passwordOk) redirect('/portal/login?error=1');

  (await cookies()).set(SESSION_COOKIE, await createSessionToken(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/portal',
    maxAge: SESSION_MAX_AGE_S,
  });
  redirect('/portal');
}

export async function logout() {
  (await cookies()).delete({ name: SESSION_COOKIE, path: '/portal' });
  redirect('/portal/login');
}
