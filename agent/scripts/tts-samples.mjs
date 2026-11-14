// Renders the same Bangla lines with several text-to-speech models so a native
// speaker can compare them by ear. Accent and naturalness cannot be judged from
// documentation: this script exists so the choice of voice is made on evidence.
//
// Run inside the agent container (see README), writing WAV files to /out:
//
//   node scripts/tts-samples.mjs
//
// Optional: CANDIDATES='model|voice,model|voice' to try specific pairs.
import { inference, initializeLogger } from '@livekit/agents';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

initializeLogger({ pretty: false, level: 'error' });

const OUT_DIR = process.env.OUT_DIR ?? '/out';

// Two lines a receptionist would really say. The second stresses what the
// brief scores: a Bangladeshi name, a day and time, and a phone number.
const LINES = {
  greeting:
    'আসসালামু আলাইকুম, ঢাকা ডেন্টাল কেয়ার থেকে বলছি। বলুন, আপনাকে কীভাবে সাহায্য করতে পারি?',
  confirm:
    'জি, ঠিক আছে। তাহলে আগামী রবিবার সন্ধ্যা ছয়টায় ডাক্তার ফারহানা আহমেদের কাছে আপনার অ্যাপয়েন্টমেন্টটা দিয়ে দিচ্ছি। আপনার নম্বরটা একবার মিলিয়ে নিই, শূন্য এক সাত এক এক, দুই তিন চার, পাঁচ ছয় সাত আট। ঠিক আছে তো?',
};

const DEFAULT_CANDIDATES = [
  ['google/gemini-3.8-flash-tts', 'Kore'],
  ['google/gemini-3.8-flash-tts', 'Aoede'],
  ['google/gemini-3.8-flash-tts', 'Leda'],
  ['google/gemini-3.8-flash-lite-tts', 'Kore'],
  ['cartesia/sonic-3.6', undefined],
  ['inworld/inworld-tts-2', undefined],
  ['xai/tts-1', undefined],
];

const candidates = process.env.CANDIDATES
  ? process.env.CANDIDATES.split(',').map((pair) => {
      const [model, voice] = pair.split('|');
      return [model.trim(), voice?.trim() || undefined];
    })
  : DEFAULT_CANDIDATES;

// LiveKit Inference TTS is streaming-only, so push the text into a stream and
// gather the audio frames it returns. Also records time to first audio, which
// is what a caller actually perceives as latency.
async function render(tts, text) {
  const stream = tts.stream();
  const started = Date.now();
  stream.pushText(text);
  stream.flush();
  stream.endInput();

  const chunks = [];
  let sampleRate = 0;
  let channels = 1;
  let firstAudioMs = null;
  for await (const event of stream) {
    const frame = event?.frame;
    if (!frame) continue;
    if (firstAudioMs === null) firstAudioMs = Date.now() - started;
    sampleRate = frame.sampleRate;
    channels = frame.channels;
    chunks.push(Int16Array.from(frame.data));
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  if (total === 0) throw new Error('no audio returned');
  const data = new Int16Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  return { data, sampleRate, channels, firstAudioMs };
}

// Minimal 16-bit PCM WAV writer.
function toWav(frame) {
  const pcm = Buffer.from(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength);
  const header = Buffer.alloc(44);
  const byteRate = frame.sampleRate * frame.channels * 2;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(frame.channels, 22);
  header.writeUInt32LE(frame.sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(frame.channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms)),
  ]);

await mkdir(OUT_DIR, { recursive: true });
const results = [];

for (const [model, voice] of candidates) {
  const label = `${model.replace(/[/.]/g, '-')}${voice ? `-${voice}` : ''}`;
  for (const [lineName, text] of Object.entries(LINES)) {
    const started = Date.now();
    // One connection at a time, always closed afterwards. The free LiveKit plan
    // allows 5 concurrent TTS connections; leaving these open exhausts it.
    let tts;
    try {
      tts = new inference.TTS({ model, ...(voice ? { voice } : {}), language: 'bn' });
      const frame = await withTimeout(render(tts, text), 45_000);
      const file = `${label}__${lineName}.wav`;
      await writeFile(path.join(OUT_DIR, file), toWav(frame));
      const seconds = frame.data.length / frame.channels / frame.sampleRate;
      results.push({ model, voice: voice ?? '(default)', line: lineName, ok: true, file, audioSeconds: +seconds.toFixed(1), firstAudioMs: frame.firstAudioMs, renderMs: Date.now() - started });
    } catch (error) {
      results.push({ model, voice: voice ?? '(default)', line: lineName, ok: false, error: String(error?.message ?? error).slice(0, 300) });
    } finally {
      await tts?.close?.().catch(() => {});
    }
  }
}

for (const r of results) {
  console.log(
    r.ok
      ? `OK    ${r.model} ${r.voice} ${r.line}: ${r.audioSeconds}s audio, first audio ${r.firstAudioMs} ms, total ${r.renderMs} ms -> ${r.file}`
      : `FAIL  ${r.model} ${r.voice} ${r.line}: ${r.error}`,
  );
}
process.exit(0);
