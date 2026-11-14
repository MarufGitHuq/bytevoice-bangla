import type { CallState } from './agent.ts';
import type { CallStatus } from './store.ts';

/** Files a finished call the way front-desk staff would. */
export function finalStatus(state: CallState, callerTurns: number, failed: boolean): CallStatus {
  if (state.booked) return 'booked';
  if (state.rescheduled) return 'rescheduled';
  if (state.cancelled) return 'cancelled';
  if (state.callbackRequested) return 'follow_up_needed';
  if (failed) return 'failed';
  // The caller started on an appointment but the call ended before it was made.
  if (state.startedBooking) return 'incomplete';
  return callerTurns > 0 ? 'enquiry' : 'incomplete';
}

export function newCallState(callId: string): CallState {
  return {
    callId,
    booked: false,
    rescheduled: false,
    cancelled: false,
    callbackRequested: false,
    startedBooking: false,
  };
}
