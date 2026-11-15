'use client';

import { useCallback, useEffect, useState } from 'react';
import { RoomEvent, TokenSource } from 'livekit-client';
import {
  useAgent,
  useSession,
  useSessionMessages,
  useTrackVolume,
} from '@livekit/components-react';

// One browser voice call with the receptionist, as a small state machine:
//
//   idle → connecting → live → ended
//               ↘ error ↙
//
// "connecting" covers three waits: microphone permission, joining the LiveKit
// room, and the agent joining. "live" starts only when the agent is actually
// in the room, so the timer never counts silence before she picks up.

export type CallPhase = 'idle' | 'connecting' | 'live' | 'ended' | 'error';
export type CallErrorKind = 'micDenied' | 'noMic' | 'connection' | 'busy' | 'agent';

/**
 * A step the receptionist has completed, sent by the agent's tools after the
 * database confirmed it (see ProgressEvent in agent/src/agent.ts).
 */
export interface CallStep {
  step:
    | 'availability_checked'
    | 'phone_verified'
    | 'booked'
    | 'rescheduled'
    | 'cancelled'
    | 'callback';
  appointment?: {
    reference: string;
    doctorBn: string;
    doctorEn: string;
    slotStart: string;
    patientName: string;
  };
}

export interface TranscriptLine {
  id: string;
  fromAgent: boolean;
  text: string;
}

const STEPS: CallStep['step'][] = [
  'availability_checked',
  'phone_verified',
  'booked',
  'rescheduled',
  'cancelled',
  'callback',
];

/** Reads one progress message; anything unexpected is ignored. */
function parseStep(payload: Uint8Array): CallStep | null {
  try {
    const data = JSON.parse(new TextDecoder().decode(payload)) as CallStep;
    return STEPS.includes(data.step) ? data : null;
  } catch {
    return null;
  }
}

/** How long to wait for the agent to join before giving up. */
const AGENT_TIMEOUT_MS = 25_000;

class CallError extends Error {
  constructor(public kind: CallErrorKind) {
    super(kind);
  }
}

// Ask for the microphone before connecting, so a blocked or missing
// microphone gives a clear message instead of a half-open call.
async function checkMicrophone() {
  if (!navigator.mediaDevices?.getUserMedia) throw new CallError('noMic');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
  } catch (err) {
    const name = err instanceof DOMException ? err.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') throw new CallError('micDenied');
    if (
      name === 'NotFoundError' ||
      name === 'OverconstrainedError' ||
      name === 'NotReadableError'
    ) {
      throw new CallError('noMic');
    }
    throw new CallError('connection');
  }
}

// Fetches a token from our own server route (app/api/token/route.ts). The
// route picks the room and the agent; the browser sends nothing.
const tokenSource = TokenSource.custom(async () => {
  let res: Response;
  try {
    res = await fetch('/api/token', { method: 'POST' });
  } catch {
    throw new CallError('connection');
  }
  if (res.status === 429) throw new CallError('busy');
  if (!res.ok) throw new CallError('connection');
  return res.json();
});

function errorKind(err: unknown): CallErrorKind {
  if (err instanceof CallError) return err.kind;
  if (err instanceof Error && /agent/i.test(err.message)) return 'agent';
  return 'connection';
}

export function useCall() {
  const session = useSession(tokenSource, { agentConnectTimeoutMilliseconds: AGENT_TIMEOUT_MS });
  const { start, end, isConnected, room } = session;
  const agent = useAgent(session);
  const { messages, send, isSending } = useSessionMessages(session);
  // 0..1 loudness of the receptionist's voice, used to move the orb.
  const level = useTrackVolume(agent.microphoneTrack);

  const [phase, setPhase] = useState<CallPhase>('idle');
  const [error, setError] = useState<CallErrorKind | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [steps, setSteps] = useState<CallStep[]>([]);
  // The transcript is kept after the call ends, for reading and download.
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);

  const showError = useCallback((kind: CallErrorKind) => {
    setError(kind);
    setPhase('error');
  }, []);

  // Shows the error and hangs up whatever part of the call had connected.
  const fail = useCallback(
    (kind: CallErrorKind) => {
      showError(kind);
      end().catch(() => {});
    },
    [showError, end]
  );

  const startCall = useCallback(async () => {
    setError(null);
    setSeconds(0);
    setSteps([]);
    setTranscript([]);
    setPhase('connecting');
    try {
      await checkMicrophone();
      await start();
    } catch (err) {
      // Our own errors (microphone, token) happen before anything connects,
      // so there is nothing to hang up.
      if (err instanceof CallError) showError(err.kind);
      else fail(errorKind(err));
    }
  }, [start, showError, fail]);

  const endCall = useCallback(() => {
    setPhase('ended');
    end().catch(() => {});
  }, [end]);

  // connecting → live once the agent is in the room; → error if it never comes.
  useEffect(() => {
    if (phase !== 'connecting') return;
    if (agent.isConnected) setPhase('live');
    else if (agent.state === 'failed') fail('agent');
  }, [phase, agent.isConnected, agent.state, fail]);

  // Backup timeout in case the agent neither joins nor reports a failure.
  useEffect(() => {
    if (phase !== 'connecting') return;
    const timer = setTimeout(() => fail('agent'), AGENT_TIMEOUT_MS + 5_000);
    return () => clearTimeout(timer);
  }, [phase, fail]);

  // live → ended when the receptionist hangs up or the connection drops.
  useEffect(() => {
    if (phase === 'live' && (!isConnected || agent.isFinished)) endCall();
  }, [phase, isConnected, agent.isFinished, endCall]);

  // Call timer.
  useEffect(() => {
    if (phase !== 'live') return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1_000);
    return () => clearInterval(timer);
  }, [phase]);

  // Leaving the page hangs up, so no speech connection is left open.
  useEffect(() => () => void end().catch(() => {}), [end]);

  // Spoken turns from both sides, plus anything the caller typed.
  useEffect(() => {
    if (messages.length === 0) return;
    setTranscript(
      messages
        .filter((m) => m.message.trim())
        .map((m) => ({
          id: m.id,
          fromAgent:
            m.type === 'agentTranscript' || (m.type !== 'userTranscript' && !m.from?.isLocal),
          text: m.message,
        }))
    );
  }, [messages]);

  // Steps the agent reports as done. Each step is listed once; a newer report
  // replaces the older one (a booking that is then moved, for example).
  useEffect(() => {
    const onData = (payload: Uint8Array, _from?: unknown, _kind?: unknown, topic?: string) => {
      if (topic !== 'call-progress') return;
      const step = parseStep(payload);
      if (step) setSteps((done) => [...done.filter((d) => d.step !== step.step), step]);
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => void room.off(RoomEvent.DataReceived, onData);
  }, [room]);

  /** Sends a typed message; the receptionist answers it like a spoken turn. */
  const sendText = useCallback(
    async (text: string) => {
      const message = text.trim().slice(0, 500);
      if (!message || phase !== 'live') return;
      await send(message).catch(() => {});
    },
    [send, phase]
  );

  // What the orb shows: the agent's own state while live.
  const look =
    phase === 'connecting'
      ? 'connecting'
      : phase === 'live' &&
          (agent.state === 'listening' || agent.state === 'thinking' || agent.state === 'speaking')
        ? agent.state
        : 'idle';

  return {
    session,
    phase,
    error,
    seconds,
    level,
    look,
    transcript,
    steps,
    isSending,
    startCall,
    endCall,
    sendText,
  } as const;
}
