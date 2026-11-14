// Hands the browser a short-lived LiveKit token for one call with the Bangla
// receptionist. The API key and secret never leave the server: the browser only
// gets the LiveKit URL, a random room name and a signed token for that room.
//
// Abuse limits that cost nothing:
// - the room, the caller identity and the agent to dispatch are chosen here,
//   never taken from the request, so a token cannot join someone else's call
//   or start a different agent;
// - the token expires after a few minutes, so it cannot be saved and reused;
// - a small per-IP limit slows down scripted requests. It lives in memory, so on
//   Vercel each server instance counts on its own; it is a speed bump, not a wall.
import { NextResponse } from 'next/server';
import { AccessToken, RoomAgentDispatch, RoomConfiguration } from 'livekit-server-sdk';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

const TOKEN_TTL = '5m';
const LIMIT_PER_WINDOW = 10;
const WINDOW_MS = 10 * 60 * 1000;

const recentRequests = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (recentRequests.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  recentRequests.set(ip, recent);
  return recent.length > LIMIT_PER_WINDOW;
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

  // Only this site may ask for tokens. Browsers always send Origin on a POST.
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (origin && host && new URL(origin).host !== host) {
    return error('Forbidden', 403);
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (isRateLimited(ip)) {
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
