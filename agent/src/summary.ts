// End-of-call summary.
//
// When a call ends, one extra model call reads the transcript and writes a
// short summary in Bangla and English for the staff portal. It also picks out
// the caller's details, which matters for calls where no tool ran (a plain
// enquiry, or a caller who hung up half way): without this those calls would
// have no extracted fields at all.
//
// Details saved by the tools during the call were validated in code, so they
// always win; the values found here only fill the gaps (saveExtraction with prefer 'existing').
import { inference, llm } from '@livekit/agents';
import { LLM_MODEL } from './agent.ts';
import type { Extraction } from './store.ts';
import { normalisePhone } from './validation.ts';

export interface Turn {
  speaker: 'agent' | 'caller';
  text: string;
}

export interface CallSummary {
  summaryBn: string;
  summaryEn: string;
  extraction: Extraction;
}

const INTENTS = ['book', 'reschedule', 'cancel', 'enquiry', 'callback', 'other'] as const;

// The call record must close even if the model is slow or down.
const TIMEOUT_MS = 8000;

const INSTRUCTIONS = `You write the record of a phone call to a dental clinic in Dhaka for front-desk staff.
Read the transcript and reply with one JSON object and nothing else:
{
  "summary_bn": "one or two sentences in Bangladeshi Bangla",
  "summary_en": "the same one or two sentences in English",
  "patient_name": "the caller's name as they gave it, or null",
  "phone": "the caller's phone number in digits, or null",
  "reason_for_visit": "short reason in English, or null",
  "intent": "one of: ${INTENTS.join(', ')}",
  "notes": "anything staff must follow up, in English, or null"
}
State only what was said in the call. Use null when something was not said; never guess.
The transcript comes from speech recognition and may contain mistakes.`;

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Turns the model's reply into a summary, or null if the reply is not usable. */
export function parseSummary(reply: string): CallSummary | null {
  const json = reply.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  const summaryBn = text(data.summary_bn);
  const summaryEn = text(data.summary_en);
  if (!summaryBn || !summaryEn) return null;

  // The phone number goes through the same check as one given to a tool.
  const rawPhone = text(data.phone);
  const phone = rawPhone ? normalisePhone(rawPhone) : undefined;
  const intent = text(data.intent);

  return {
    summaryBn,
    summaryEn,
    extraction: {
      patientName: text(data.patient_name),
      phone: phone?.ok ? phone.phone : rawPhone,
      phoneValid: phone ? phone.ok : undefined,
      reasonForVisit: text(data.reason_for_visit),
      intent: INTENTS.find((known) => known === intent),
      notes: text(data.notes),
    },
  };
}

async function askModel(turns: Turn[]): Promise<string> {
  const transcript = turns.map((t) => `${t.speaker === 'caller' ? 'Caller' : 'Receptionist'}: ${t.text}`).join('\n');
  const chatCtx = llm.ChatContext.empty();
  chatCtx.addMessage({ role: 'system', content: INSTRUCTIONS });
  chatCtx.addMessage({ role: 'user', content: transcript });

  const model = new inference.LLM({ model: LLM_MODEL });
  let reply = '';
  for await (const chunk of model.chat({ chatCtx })) {
    reply += chunk.delta?.content ?? '';
  }
  return reply;
}

/**
 * Summarises a finished call. Returns null instead of throwing: a missing
 * summary must never stop the call record from being closed.
 */
export async function summariseCall(turns: Turn[]): Promise<CallSummary | null> {
  if (!turns.some((t) => t.speaker === 'caller')) return null;
  let timer: NodeJS.Timeout | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('summary timed out')), TIMEOUT_MS);
    });
    return parseSummary(await Promise.race([askModel(turns), timeout]));
  } catch (error) {
    console.error('could not summarise call', error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
