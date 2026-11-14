// Text-only check of the Bangla receptionist.
//
// Runs real model turns (no audio, so no speech cost) through four calls:
// book, reschedule, cancel, and a set of questions she must refuse. It prints
// the conversation and the tool calls, then checks the database.
//
// Run inside the agent container (see README):
//
//   node scripts/text-check.mjs            all scenarios
//   node scripts/text-check.mjs book       one scenario
//
// It uses its own test phone number and removes its own rows afterwards.
import { initializeLogger, voice } from '@livekit/agents';
import pg from 'pg';

const { createAgent } = await import('../src/agent.ts');
const { finalStatus, newCallState } = await import('../src/outcome.ts');
const store = await import('../src/store.ts');
const { summariseCall } = await import('../src/summary.ts');

initializeLogger({ pretty: false, level: 'error' });

const TEST_PHONE = '01711234567';
const only = process.argv[2];

const scenarios = {
  book: [
    'আসসালামু আলাইকুম। আমার দাঁতে খুব ব্যথা, একটা অ্যাপয়েন্টমেন্ট লাগবে।',
    'আগামী রবিবার সন্ধ্যায় হলে ভালো হয়।',
    'সন্ধ্যা ছয়টা ঠিক আছে।',
    'আমার নাম রফিকুল ইসলাম।',
    'জি ঠিক আছে। নম্বর হলো জিরো ওয়ান সেভেন ওয়ান ওয়ান, টু থ্রি ফোর, ফাইভ সিক্স সেভেন।',
    'জি, নম্বর ঠিক আছে।',
    'জি, কনফার্ম করুন।',
    'না, আর কিছু না। ধন্যবাদ।',
  ],
  reschedule: [
    'আমার একটা অ্যাপয়েন্টমেন্ট আছে, ওটা একটু পিছাতে চাই।',
    'নম্বর ০১৭১১২৩৪৫৬৭।',
    'জি, ঠিক আছে।',
    'সোমবার বিকালে দিন।',
    'বিকাল চারটা হলে ভালো।',
    'জি, চেঞ্জ করে দিন।',
    'না, ধন্যবাদ।',
  ],
  cancel: [
    'আমার অ্যাপয়েন্টমেন্টটা ক্যানসেল করতে চাই।',
    'জিরো ওয়ান সেভেন ওয়ান ওয়ান টু থ্রি ফোর ফাইভ সিক্স সেভেন।',
    'জি, নম্বর ঠিক।',
    'জি, ক্যানসেল করে দিন।',
    'না, আর কিছু লাগবে না।',
  ],
  refuse: [
    'দাঁতে ব্যথার জন্য কোন অ্যান্টিবায়োটিক খাবো বলেন তো?',
    'আচ্ছা, আজকে বাংলাদেশের খেলার স্কোর কত?',
    'ইমপ্ল্যান্ট করতে কত টাকা লাগে?',
    'আপনাদের ঠিকানাটা বলবেন? আর শুক্রবার খোলা থাকে?',
    'স্কেলিং করতে কত খরচ?',
  ],
};

const clip = (value, max = 500) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text && text.length > max ? `${text.slice(0, max)}…` : text;
};

async function runCall(name, turns) {
  console.log(`\n=== ${name.toUpperCase()} ===`);
  const callId = await store.startCall(`textcheck-${name}-${Date.now()}`, { stt: 'text', llm: 'text-check', tts: 'none' });
  const state = newCallState(callId);
  const session = new voice.AgentSession();
  await session.start({ agent: createAgent(state) });

  const toolCalls = [];
  const replies = [];
  const transcript = [];
  let seq = 0;
  for (const userInput of turns) {
    console.log(`\nCALLER: ${userInput}`);
    await store.addTurn(callId, (seq += 1), 'caller', userInput, seq * 1000);
    transcript.push({ speaker: 'caller', text: userInput });
    try {
      const result = await session.run({ userInput }).wait();
      for (const event of result.events ?? []) {
        const item = event.item ?? event;
        if (item.name && (item.args !== undefined || item.arguments !== undefined)) {
          toolCalls.push(item.name);
          console.log(`  TOOL   ${item.name} ${clip(item.args ?? item.arguments)}`);
        } else if (item.output !== undefined) {
          console.log(`  RESULT ${clip(item.output)}`);
        } else {
          const text = item.textContent ?? item.content;
          if (text !== undefined && item.role === 'assistant') {
            const reply = Array.isArray(text) ? text.join(' ') : String(text);
            replies.push(reply);
            transcript.push({ speaker: 'agent', text: reply });
            await store.addTurn(callId, (seq += 1), 'agent', reply, seq * 1000);
            console.log(`  AGENT: ${clip(reply)}`);
          }
        }
      }
    } catch (error) {
      console.log(`  ERROR: ${error?.message ?? error}`);
    }
  }
  await session.close();
  const status = finalStatus(state, turns.length, false);
  // Same steps as the end of a real call (see finish() in src/main.ts).
  const summary = await summariseCall(transcript);
  if (summary) await store.saveExtraction(callId, summary.extraction, 'existing');
  await store.endCall(callId, { status, summaryBn: summary?.summaryBn, summaryEn: summary?.summaryEn });
  console.log(`\n  summary (bn): ${summary?.summaryBn ?? 'none'}`);
  console.log(`  summary (en): ${summary?.summaryEn ?? 'none'}`);
  console.log(`\n  call filed as: ${status}`);
  return { callId, toolCalls, replies, status, summary };
}

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const cleanup = async () => {
  await db.query(`delete from appointments where patient_id in (select id from patients where phone = $1)`, [TEST_PHONE]);
  await db.query(`delete from calls where room_name like 'textcheck-%'`);
  await db.query(`delete from patients where phone = $1`, [TEST_PHONE]);
};
const appointment = async () =>
  (
    await db.query(
      `select a.status, a.doctor, a.slot_start at time zone 'Asia/Dhaka' as local, p.full_name
       from appointments a join patients p on p.id = a.patient_id where p.phone = $1 order by a.created_at desc limit 1`,
      [TEST_PHONE],
    )
  ).rows[0];

const extraction = async (callId) =>
  (await db.query(`select patient_name, phone, phone_valid, intent from call_extractions where call_id = $1`, [callId])).rows[0];

const checks = [];
const check = (label, ok) => checks.push([label, Boolean(ok)]);
const hasBangla = (text) => /[ঀ-৿]/.test(text);
const hasDigits = (text) => /[0-9০-৯]/.test(text);

if (!only) await cleanup();

if (!only || only === 'book') {
  const r = await runCall('book', scenarios.book);
  const a = await appointment();
  console.log('  stored:', a ? `${a.full_name} · ${a.doctor} · ${a.local.toISOString().slice(0, 16)} · ${a.status}` : 'nothing');
  check('book: availability checked before booking', r.toolCalls.indexOf('checkAvailability') > -1 && r.toolCalls.indexOf('checkAvailability') < r.toolCalls.indexOf('bookAppointment'));
  check('book: appointment stored as booked', a?.status === 'booked');
  check('book: slot is 18:00 on a Sunday', a && a.local.getUTCHours() === 18 && a.local.getUTCDay() === 0);
  check('book: call filed as booked', r.status === 'booked');
  const e = await extraction(r.callId);
  check('book: summary written in Bangla and English', r.summary && hasBangla(r.summary.summaryBn) && !hasBangla(r.summary.summaryEn));
  check('book: summary did not overwrite validated details', e?.phone === TEST_PHONE && e?.phone_valid === true && e?.intent === 'book');
  check('book: replies are in Bangla', r.replies.every(hasBangla));
  check('book: no digits in spoken replies', !r.replies.some(hasDigits));
}

if (!only || only === 'reschedule') {
  const before = await appointment();
  const r = await runCall('reschedule', scenarios.reschedule);
  const a = await appointment();
  console.log('  stored:', a ? `${a.doctor} · ${a.local.toISOString().slice(0, 16)} · ${a.status}` : 'nothing');
  check('reschedule: looked the booking up first', r.toolCalls.includes('findAppointments'));
  check('reschedule: slot moved to 16:00 on a Monday', a && a.local.getUTCHours() === 16 && a.local.getUTCDay() === 1);
  check('reschedule: still one live appointment', a?.status === 'booked' && before && String(before.local) !== String(a.local));
  check('reschedule: call filed as rescheduled', r.status === 'rescheduled');
}

if (!only || only === 'cancel') {
  const r = await runCall('cancel', scenarios.cancel);
  const a = await appointment();
  console.log('  stored:', a ? `${a.local.toISOString().slice(0, 16)} · ${a.status}` : 'nothing');
  check('cancel: appointment marked cancelled, not deleted', a?.status === 'cancelled');
  check('cancel: call filed as cancelled', r.status === 'cancelled');
}

if (!only || only === 'refuse') {
  const r = await runCall('refuse', scenarios.refuse);
  check('refuse: no booking tool used', !r.toolCalls.includes('bookAppointment'));
  check('refuse: no medicine named for the antibiotic question', !/অ্যামোক্সিসিলিন|এমোক্সিসিলিন|মেট্রোনিডাজল|amoxicillin|metronidazole/i.test(r.replies[0] ?? ''));
  const e = await extraction(r.callId);
  check('refuse: call with no tool still has a summary and an intent', r.summary && Boolean(e?.intent));
  check('refuse: replies are in Bangla', r.replies.every(hasBangla));
}

console.log('\nCHECKS');
for (const [label, ok] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);

if (!only) await cleanup();
await db.end();
await store.closeStore();
process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
