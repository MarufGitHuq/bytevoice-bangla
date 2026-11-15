import { ServerOptions, cli, defineAgent, inference, voice } from '@livekit/agents';
import { EnhancerModel, audioEnhancement } from '@livekit/plugins-ai-coustics';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { LLM_MODEL, type ProgressEvent, createAgent } from './agent.ts';
import { CLINIC } from './clinic.ts';
import { finalStatus, newCallState } from './outcome.ts';
import { addTurn, endCall, saveExtraction, startCall } from './store.ts';
import { type Turn, summariseCall } from './summary.ts';

dotenv.config({ path: '.env.local' });

// Speech models are settings, not code, so a provider can be swapped (for
// quality, cost, or an exhausted free quota) without a rebuild.
//
// Voice: chosen by a native speaker from side-by-side samples of seven voices
// across five models (see scripts/tts-samples.mjs). Gemini "Leda" sounded the
// most like natural Bangladeshi Bangla; Cartesia was faster but less natural.
const STT_MODEL = process.env.STT_MODEL ?? 'deepgram/nova-3';
const STT_LANGUAGE = process.env.STT_LANGUAGE ?? 'bn';
const TTS_MODEL = process.env.TTS_MODEL ?? 'google/gemini-3.8-flash-tts';
const TTS_VOICE = process.env.TTS_VOICE ?? 'Leda';

const GREETING = `আসসালামু আলাইকুম, ${CLINIC.nameBn} থেকে ${CLINIC.agentNameBn} বলছি। বলুন, আপনাকে কীভাবে সাহায্য করতে পারি?`;

/** Removes speech markup (emotion and pacing tags) so the stored transcript is plain text. */
function plainText(text: string) {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default defineAgent({
  entry: async (ctx) => {
    const startedAt = Date.now();
    const callId = await startCall(ctx.job.room?.name ?? ctx.room.name ?? `room-${startedAt}`, {
      stt: `${STT_MODEL}:${STT_LANGUAGE}`,
      llm: LLM_MODEL,
      tts: `${TTS_MODEL}:${TTS_VOICE}`,
    });

    const state = newCallState(callId);

    const session = new voice.AgentSession({
      stt: new inference.STT({ model: STT_MODEL, language: STT_LANGUAGE }),
      tts: new inference.TTS({ model: TTS_MODEL, voice: TTS_VOICE, language: 'bn' }),
      turnHandling: {
        // Decides when the caller has finished speaking, from the audio itself.
        turnDetection: new inference.TurnDetector(),
        // Wait a little longer before deciding the caller has finished. With the
        // default (500 ms) a pause in the middle of a sentence was taken as the
        // end of a turn, so one request became two turns and got two answers.
        endpointing: { minDelay: 900 },
        // Start thinking before the caller has fully stopped, to cut the pause.
        preemptiveGeneration: { enabled: true },
      },
      // Lets the model add emotion and pacing cues that the voice renders.
      expressive: true,
    });

    // Every finished turn is written as it happens, so a dropped call still
    // leaves a complete transcript up to that point.
    let seq = 0;
    const turns: Turn[] = [];
    let callerTurns = 0;
    let writes: Promise<unknown> = Promise.resolve();
    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (event) => {
      const item = event.item;
      if (!('role' in item) || (item.role !== 'user' && item.role !== 'assistant')) return;
      const text = plainText(item.textContent ?? '');
      if (!text) return;
      const speaker = item.role === 'user' ? 'caller' : 'agent';
      if (speaker === 'caller') callerTurns += 1;
      const turn = (seq += 1);
      turns.push({ speaker, text });
      const offsetMs = (event.createdAt ?? Date.now()) - startedAt;
      // Chained so turns are stored in order and a failed write never breaks the call.
      writes = writes
        .then(() => addTurn(callId, turn, speaker, text, offsetMs))
        .catch((error) => console.error('could not store transcript turn', error));
    });

    // Tells the caller's browser which steps are done (see ProgressEvent). The
    // page listens on this topic. A lost message only affects the display.
    const report = (event: ProgressEvent) => {
      const payload = new TextEncoder().encode(JSON.stringify(event));
      ctx.room.localParticipant
        ?.publishData(payload, { reliable: true, topic: 'call-progress' })
        .catch((error) => console.error('could not send progress to the page', error));
    };

    let closed = false;
    const finish = async (failed: boolean, error?: string) => {
      if (closed) return;
      closed = true;
      await writes;
      // One model call writes the summary and fills in details no tool saved.
      const summary = await summariseCall(turns);
      if (summary) {
        await saveExtraction(callId, summary.extraction, 'existing').catch((e) =>
          console.error('could not store extraction', e),
        );
      }
      await endCall(callId, {
        status: finalStatus(state, callerTurns, failed),
        summaryBn: summary?.summaryBn,
        summaryEn: summary?.summaryEn,
        error,
      }).catch((e) => console.error('could not close call record', e));
    };
    session.on(voice.AgentSessionEventTypes.Close, (event) => {
      void finish(Boolean(event.error), event.error ? String(event.error) : undefined);
    });
    ctx.addShutdownCallback(() => finish(false));

    await session.start({
      agent: createAgent(state, report),
      room: ctx.room,
      inputOptions: {
        // Removes background noise and other voices from the caller's audio.
        noiseCancellation: audioEnhancement({ model: EnhancerModel.QuailVfS }),
      },
    });

    await ctx.connect();

    // A fixed greeting: no model call, so the caller hears a voice immediately.
    session.say(GREETING);
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: 'bytevoice-bangla',
  }),
);
