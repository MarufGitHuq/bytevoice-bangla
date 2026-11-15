// Hands the browser a short-lived LiveKit token for one call with the Bangla
// receptionist. The API key and secret never leave the server: the browser only
// gets the LiveKit URL, a random room name and a signed token for that room.
//
// Abuse limits that cost nothing:
// - the room, the caller identity and the agent to dispatch are chosen here,
//   never taken from the request, so a token cannot join someone else's call
//   or start a different agent;
// - the token expires after a few minutes, so it cannot be saved and reused;
// - a per-IP limit and an overall limit slow down scripted requests. They live
//   in memory, so on Vercel each server instance counts on its own: a speed
//   bump, not a wall. The LiveKit free plan's own concurrency limit is the hard
//   ceiling on how many calls can run at once.
import { NextResponse } from 'next/server';
import { AccessToken, RoomAgentDispatch, RoomConfiguration } from 'livekit-server-sdk';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

const TOKEN_TTL = '5m';
const WINDOW_MS = 10 * 60 * 1000;
// Opening the page fetches one token in advance and each call fetches one
// more, so 20 per IP leaves room for a person testing several calls.
const PER_IP_LIMIT = 20;
const OVERALL_LIMIT = 200;

// Only granted requests are recorded, so these stay small: the map holds at
// most OVERALL_LIMIT addresses with recent requests, and each list at most
// PER_IP_LIMIT times. Addresses with nothing recent are removed on every call.
const grantedByIp = new Map<string, number[]>();
let grantedAll: number[] = [];

function allowRequest(ip: string): boolean {
  const now = Date.now();
  const isRecent = (time: number) => now - time < WINDOW_MS;

  grantedAll = grantedAll.filter(isRecent);
  for (const [key, times] of grantedByIp) {
    const recent = times.filter(isRecent);
    if (recent.length === 0) grantedByIp.delete(key);
    else grantedByIp.set(key, recent);
  }

  const mine = grantedByIp.get(ip) ?? [];
  if (mine.length >= PER_IP_LIMIT || grantedAll.length >= OVERALL_LIMIT) return false;

  grantedByIp.set(ip, [...mine, now]);
  grantedAll.push(now);
  return true;
}

// Vercel's edge sets x-real-ip (and overwrites x-forwarded-for) with the
// address it saw, so a visitor cannot pick their own. The x-forwarded-for
// fallback is only for running locally.
function clientIp(req: Request): string {
  return (
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

// True when the request comes from a page on another site. Scripts can still
// call the route directly; this only stops other websites from using it
// through their visitors' browsers.
function isCrossSite(req: Request): boolean {
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host !== host;
  } catch {
    return true; // "null" or a malformed origin
  }
}

function error(message: string, status: number) {
  return new NextResponse(message, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, AGENT_NAME } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !AGENT_NAME) {
    console.error(
      'Token route: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET and AGENT_NAME must be set'
    );
    return error('Voice calls are not configured on this server.', 500);
  }

  if (isCrossSite(req)) {
    return error('Forbidden', 403);
  }
  if (!allowRequest(clientIp(req))) {
    return error('Too many calls. Please wait a few minutes.', 429);
  }

  const roomName = `bytevoice_${randomUUID()}`;
  const identity = `caller_${randomUUID().slice(0, 8)}`;

  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name: 'Caller',
    ttl: TOKEN_TTL,
  });
  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  });
  // Dispatch the receptionist into this room as soon as the caller joins.
  token.roomConfig = new RoomConfiguration({
    agents: [new RoomAgentDispatch({ agentName: AGENT_NAME })],
  });

  return NextResponse.json(
    {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantName: 'Caller',
      participantToken: await token.toJwt(),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
