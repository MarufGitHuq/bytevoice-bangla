// Portal session: a signed token in an httpOnly cookie.
//
// After a correct login the server signs a short token (HS256, with
// PORTAL_SESSION_SECRET) saying who logged in and when it expires. The browser
// cannot read it (httpOnly) and cannot forge it (it does not know the secret).
// Every portal request checks the signature and expiry on the server.
//
// This file uses only `jose` and Web APIs, so the middleware can import it.
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'portal_session';
export const SESSION_MAX_AGE_S = 8 * 60 * 60; // one working day

function secretKey(): Uint8Array {
  const secret = process.env.PORTAL_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('PORTAL_SESSION_SECRET must be set to at least 32 characters');
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_S}s`)
    .sign(secretKey());
}

/** The logged-in user's name, or null when the token is missing, forged or expired. */
export async function verifySessionToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
