# ByteVoice Bangla

A voice receptionist that speaks Bangladeshi Bangla. She is called মিতু (Mitu)
and answers calls for Dhaka Dental Care, a fictional clinic with test data. She
books, reschedules and cancels appointments, answers questions about the
clinic, refuses medical advice and off-topic questions, and takes callback
requests. Every call is stored in Postgres: the call, each spoken turn, the
details she picked up, any appointment and its history. Staff read it all in a
password-protected portal. The caller talks to her from a landing page in the
browser. There is no phone line.

## Links

| What | Where |
|---|---|
| Landing page (live call) | https://bytevoice-bangla-pied.vercel.app |
| Staff portal | https://bytevoice-bangla-pied.vercel.app/portal |
| Portal login | Sent in the submission email (not kept in a public repo) |
| Video walkthrough | `<VIDEO_URL>` |
| Code | https://github.com/MarufGitHuq/bytevoice-bangla |

## What to try

Use Chrome with a microphone. Speak Bangla; English words mixed in are fine.

1. **Book.** "আমার দাঁতে ব্যথা, একটা অ্যাপয়েন্টমেন্ট লাগবে।" Give a day such as
   "আগামী রবিবার সন্ধ্যায়", pick a time she offers, give a name and an 11 digit
   mobile number starting 013 to 019. She reads the number back digit by digit
   and waits for your yes before booking.
2. **Reschedule.** Call again: "অ্যাপয়েন্টমেন্টটা পিছাতে চাই।" Give the same number,
   then a new day and time.
3. **Cancel.** "অ্যাপয়েন্টমেন্টটা ক্যানসেল করতে চাই।"
4. **Clinic question.** Address, opening hours (closed on Friday), doctors, or a
   listed fee such as scaling. Ask for an unlisted fee (implants): she should not
   invent one and should offer a callback instead.
5. **Medical advice.** "ব্যথার জন্য কোন অ্যান্টিবায়োটিক খাবো?" She should name no
   medicine and offer an appointment.
6. **Off topic.** "আজকে খেলার স্কোর কত?" She should say she can only help with the
   clinic.
7. **Portal.** Log in, find your calls at the top of the list (search by name or
   phone, filter by status), and open one: outcome, Bangla and English summary,
   extracted fields, the appointment with its history, and the full transcript
   with timestamps.

## Architecture

```mermaid
flowchart LR
  B[Browser<br/>landing page] -- POST /api/token --> T[Next.js token route<br/>web/app/api/token/route.ts]
  T -- short-lived token,<br/>agent dispatch --> B
  B <-- WebRTC audio --> R[LiveKit room]
  R <--> A[Agent worker<br/>agent/src/main.ts]
  subgraph A2[Agent, per call]
    S[STT<br/>deepgram/nova-3, bn] --> L[LLM + 6 tools<br/>google/gemini-3.8-flash]
    L --> V[TTS<br/>gemini-3.8-flash-tts, Leda]
  end
  A --- A2
  L -- tools call store.ts --> D[(Postgres<br/>db/schema.sql)]
  A -- turns, end of call --> D
  P[Staff portal<br/>web/app/portal] -- read only --> D
```

Hosting: web (landing page, token route, portal) on Vercel; agent on LiveKit
Cloud; Postgres on Supabase. Speech and language models run through LiveKit
Inference, so there is one account and one bill, not three.

### One call, from button press to stored record

1. The caller presses the call button. The page calls `POST /api/token`.
2. The route makes a random room name and caller identity, signs a token valid
   for five minutes, and adds a dispatch for the agent named in `AGENT_NAME`.
   The LiveKit API secret never leaves the server.
3. The browser joins the room. LiveKit starts the agent job for that room.
4. `startCall()` inserts a `calls` row keyed by the room name, with the three
   model names. The agent says a fixed greeting.
5. Each turn: speech to text, then the language model, which may call tools,
   then text to speech. Each finished turn, caller or agent, is written to
   `transcript_turns` straight away.
6. Tools validate input in code, write through `agent/src/store.ts`, and update
   `call_extractions` with what they learned.
7. When the call ends, one more model call writes a Bangla and an English
   summary and fills any extraction fields the tools did not set. `endCall()`
   sets end time, duration and the outcome (`booked`, `rescheduled`,
   `cancelled`, `follow_up_needed`, `enquiry`, `incomplete` or `failed`).
8. The portal reads those tables. It never writes.

## Data model

Defined in [`db/schema.sql`](db/schema.sql). Safe to run more than once.
[`db/seed.sql`](db/seed.sql) adds nine fake calls covering every outcome, so
the portal can be checked without making voice calls. The portal also explains
the tables in plain words at `/portal/data-model`.

| Table | Why it exists | Key constraints |
|---|---|---|
| `patients` | One person behind many calls, keyed by phone. | `phone` unique, and `check (phone ~ '^01[3-9][0-9]{8}$')`: only a normalised Bangladeshi mobile number can be stored. |
| `calls` | One row per call; the root everything links to. | `room_name` unique: the LiveKit room is the natural key, so a repeated start does not create a second row. `status` limited to eight outcomes. Stores the STT, LLM and TTS model used, to compare quality and cost later. |
| `transcript_turns` | The full conversation, in order. | `unique (call_id, seq)`; `speaker` is `agent` or `caller`; `offset_ms` gives timestamps. |
| `call_extractions` | Structured fields from the conversation (name, phone, reason, date, time, doctor, intent, notes). | One row per call (`call_id` is the primary key), updated as the call goes on. `phone_valid` flags a number that failed validation, for a human to check. |
| `appointments` | Bookings. | Partial unique index `appointments_one_per_slot on (doctor, slot_start) where status = 'booked'`: the database, not the prompt, stops double booking. A cancelled row frees the slot. `reference` unique. `call_id` records which call made it. |
| `appointment_events` | History of each appointment. | Append-only: `booked`, `rescheduled` (with `from_slot` and `to_slot`) or `cancelled`, each with the call that did it. A reschedule never loses the old time. |
| `callbacks` | Requests the agent handed to a human. | `status` is `open` or `done`. |

**Idempotent booking.** `bookAppointment()` runs in one transaction. If the
same patient already holds the same doctor and slot, it returns that booking
instead of an error, so a repeated tool call does not fail or duplicate. The
insert uses `on conflict ... do nothing` against the slot index: if another
caller took the slot a moment earlier, the tool tells the model "that time was
just taken" and nothing is written.

## Design decisions and trade-offs

**Facts come from code, not the model.**
Decision: clinic hours, address, doctors and fees live in
`agent/src/clinic.ts` and are pasted into the instructions. Dates come from a
lookup table of the next 14 days (`upcomingDaysTable()` in
`agent/src/validation.ts`), not from the model's arithmetic.
Why: language models are unreliable at "next Sunday" to a date, and will
invent a plausible fee. A wrong date books the wrong day.
Cost: the model can only answer what is listed. An unlisted fee becomes a
callback request. Dates beyond two weeks need the caller to pick another day.

**Validation in code.**
Decision: `normalisePhone()` converts Bangla digits, strips `+88`/`0088`, and
requires `01[3-9]` plus 8 digits. `checkSlot()` rejects invalid dates,
Fridays, hours outside the slot list and past times. Tools run these before
any write.
Why: speech to text returns numbers in many shapes, and the model will pass on
whatever it hears. The database check on `patients.phone` is a second line.
Cost: a valid number that STT mangles is refused and must be said again.

**Tools never throw at the model.**
Decision: every tool body runs inside `safely()`, which turns an exception into
a plain sentence: apologise, claim nothing, offer a callback. Expected failures
(slot taken, bad number) return specific instructions.
Why: a thrown error leaves the caller in silence, or lets the model guess.
Cost: errors are only visible in the agent log and the call's `error` field,
not as alerts.

**Spoken text has no digits.**
Decision: the prompt requires numbers in Bangla words. Tools return times and
dates already worded (`hourForSpeech()`, `dateForSpeech()`,
`phoneForSpeech()`), with the part of day ("সন্ধ্যা ছয়টা").
Why: TTS may read "18:00" or "০১৭" in English or as one large number.
Cost: more prompt text and helper code; the text test checks it.

**Fixed greeting, no model call.**
Decision: the first line is a constant string spoken with `session.say()`.
Why: the caller hears a voice as soon as they connect, with no wait for the
model.
Cost: the greeting cannot adapt (for example to time of day).

**Transcript written turn by turn.**
Decision: each finished turn is inserted as it happens, in a chained promise so
order is kept and a failed write never breaks the call. Extractions are also
saved during the call.
Why: a dropped call still leaves a complete record up to that point.
Cost: many small writes instead of one at the end.

**End-of-call summary that only fills gaps.**
Decision: one model call after hang-up writes the summaries and extracts
fields. It is saved with `prefer = 'existing'`, so values the tools already
validated always win. It has an 8 second timeout and returns null on failure.
Why: plain enquiries and dropped calls run no tools, so without this they
would have no extracted fields. But a model reading a noisy transcript must
not overwrite a phone number that was checked in code.
Cost: one extra model call per call, and summary fields may be wrong where no
tool confirmed them.

**Voice chosen by ear, naturalness over speed.**
Decision: TTS is `google/gemini-3.8-flash-tts` with voice Leda. Maruf, a
native speaker, compared seven voices across five models, rendered by
`agent/scripts/tts-samples.mjs`.
Why: the brief weights natural Bangladeshi Bangla highest. Leda sounded the
most natural. Cartesia was faster but sounded less natural.
Cost: slower replies. `preemptiveGeneration` and the fixed greeting reduce the
wait, and the agent says "জি, একটু দেখছি।" while it checks availability.

**Models are settings.**
Decision: `STT_MODEL`, `STT_LANGUAGE`, `LLM_MODEL`, `TTS_MODEL` and
`TTS_VOICE` are environment variables with defaults. Each call stores the
models it used.
Why: a provider can be swapped for quality, cost or an exhausted free quota
without a code change.
Cost: a bad value is only found at call time.

**Token route limits.**
Decision: the route picks the room, identity and agent itself; tokens last five
minutes; cross-site requests get 403; at most 20 tokens per IP and 200 overall
per ten minutes.
Why: the page is public, and each call uses speech minutes from a limited free
quota.
Cost: the limits live in memory, so each Vercel instance counts on its own. It
is a speed bump, not a wall. LiveKit's own concurrency limit is the hard
ceiling.

**Portal auth.**
Decision: one reviewer account from `PORTAL_USER` and `PORTAL_PASSWORD`.
The login compares both in constant time (`timingSafeEqual` over SHA-256
hashes). A good login gets an HS256 JWT, signed with `PORTAL_SESSION_SECRET`,
in an `httpOnly`, `sameSite=lax` cookie for eight hours (`secure` in
production). `web/middleware.ts` checks it before any portal page, and each page
checks it again with `requireSession()`. The portal's database access is read
only and every query is parameterised (`web/lib/db.ts`).
Why: enough for a demo with one reviewer, with no user table to build.
Cost: no per-user accounts, roles, lockout or login rate limit, and no way to
revoke a session except by changing the secret.

**TLS verification kept on.**
Decision: any non-local database is reached with `rejectUnauthorized: true`.
Supabase's CA certificate is passed in `DATABASE_CA_CERT`.
Why: turning verification off is the common shortcut and allows a
man-in-the-middle.
Cost: one more secret to set in each environment.

**Other choices.** Only `store.ts` talks to the database. Booking, reschedule
and cancel disable interruptions while they write. Background noise is removed
with LiveKit's ai-coustics enhancer.

## Secrets

- Real values live in `agent/.env.local` and `web/.env.local` locally, and in
  the Vercel and LiveKit Cloud project settings when deployed. All `.env*`
  files are git-ignored except the `.env.example` files.
- In the repo: [`agent/.env.example`](agent/.env.example) and
  [`web/.env.example`](web/.env.example), with names and no values.
- Not in the repo: LiveKit API key and secret, database URL and password,
  Supabase CA certificate, portal password and session secret.
- The LiveKit secret is used only on servers (agent, token route). The browser
  gets a short-lived room token, never the key.

## Run locally

Needs Docker, Node 24 and a LiveKit Cloud project (free plan). Commands run
from the repo root unless they start with `cd`.

**Why Docker for the agent.** On the Windows machine this was built on,
Application Control blocks the agent's native audio module when it runs
directly with Node. The container runs it on Linux instead. LiveKit Cloud also
deploys agents from a Dockerfile, so local and hosted runs use the same recipe.

**1. Database** (Postgres in Docker on port 54329):

```bash
docker run -d --name bytevoice-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=bytevoice -p 54329:5432 postgres:16
```

```bash
docker exec -i bytevoice-db psql -U postgres -d bytevoice < db/schema.sql
```

```bash
docker exec -i bytevoice-db psql -U postgres -d bytevoice < db/seed.sql
```

Later, `docker start bytevoice-db` restarts it.

**2. Agent.** Create `agent/.env.local` with `LIVEKIT_URL`, `LIVEKIT_API_KEY`,
`LIVEKIT_API_SECRET` and
`DATABASE_URL=postgres://postgres:postgres@host.docker.internal:54329/bytevoice`.
The model variables are optional.

```bash
cd agent && docker build -t bytevoice-agent .
```

```bash
cd agent && docker run -d --name bytevoice-agent --env-file .env.local --add-host host.docker.internal:host-gateway bytevoice-agent
```

After a code change: `docker rm -f bytevoice-agent`, then build and run again.

**3. Text test** (real model calls, no speech cost):

```bash
docker run --rm --env-file agent/.env.local --add-host host.docker.internal:host-gateway -w /app bytevoice-agent node scripts/text-check.mjs
```

Add `book`, `reschedule`, `cancel` or `refuse` at the end to run one scenario.

**4. Web.** Copy `web/.env.example` to `web/.env.local` and fill it in, with
`DATABASE_URL=postgres://postgres:postgres@localhost:54329/bytevoice` and
`AGENT_NAME=bytevoice-bangla`.

```bash
cd web && npx pnpm@9.15.9 install
```

```bash
cd web && npx pnpm@9.15.9 dev -p 3100
```

Open http://localhost:3100 for the landing page and http://localhost:3100/portal
for the portal.

**Type checks:** `cd agent && npx tsc --noEmit` and `cd web && npx tsc --noEmit`.

## Testing

[`agent/scripts/text-check.mjs`](agent/scripts/text-check.mjs) runs the real
agent and real model turns as text, with no audio, against the real database.
It plays four calls and prints the conversation, tool calls and 18 checks:

- **Book:** availability checked before booking; stored as booked; slot is
  18:00 on a Sunday (from "আগামী রবিবার সন্ধ্যায়"); call filed as booked;
  summary in Bangla and English; summary did not overwrite the validated phone
  or intent; replies in Bangla; no digits in replies. The phone number is
  given the way STT often returns it ("জিরো ওয়ান সেভেন ...").
- **Reschedule:** looked up first; moved to 16:00 on a Monday; still one live
  appointment; filed as rescheduled.
- **Cancel:** marked cancelled, not deleted; filed as cancelled.
- **Refuse:** antibiotic question, sports score, unlisted implant fee, address
  and Friday hours, a listed fee. Checks: no booking; no medicine named; a call
  with no tool still gets a summary and an intent; replies in Bangla.

It uses its own test number (01711234567) and removes its own rows first.

What it cannot test: audio quality, accent and pronunciation, how STT hears
real voices and noise, turn-taking, interruptions, and latency. Those were
checked by Maruf calling the agent and listening. Model output varies, so a
check can fail on one run and pass on the next; it is a regression net, not a
proof.

## Known limitations and what I would do next

- **Reply latency.** The greeting is instant, but the first model reply and
  each reply after it take noticeably longer than a human receptionist,
  mostly from the slower, more natural TTS. Next: measure each stage per turn,
  try streaming TTS options and a faster voice for short acknowledgements.
- **STT accuracy in Bangla.** Names and numbers are the weak point. The agent
  reads them back and waits for a yes, which catches errors but costs time.
  Next: compare other Bangla STT models on recorded test calls, and add
  keyword hints for doctor names.
- **Single clinic.** Clinic facts, doctors and slot hours are constants in
  `clinic.ts`. There are no doctor schedules, leave or holidays beyond Friday.
  Next: move them to tables the portal can edit.
- **No telephony.** Calls are browser-only (WebRTC). Next: LiveKit SIP with a
  Bangladeshi number, and SMS confirmation of bookings.
- **Simple portal auth, read-only portal.** One shared login, no lockout.
  Staff cannot mark a callback done or edit a booking. Next: real staff
  accounts with an identity provider, a login rate limit, and staff actions
  that write `appointment_events` too.
- **Free-tier limits.** The LiveKit free plan allows five concurrent speech
  connections, so a handful of simultaneous reviewers can exhaust it. Free
  inference quota and the free Supabase project (paused after inactivity) are
  further limits. Rate limits on the token route are per server instance.
- **No automated tests in CI.** The text test is run by hand. Next: run it on
  each push with a test database, plus unit tests for `validation.ts`.

## How AI tools were used

Built with Claude Code. Maruf directed the design: the scope, the data model,
the rule that facts and validation live in code, and the trade-offs above. He
chose the voice by listening to samples, tested the agent by voice, and
reviewed the Bangla for Bangladeshi rather than Kolkata usage. Code written
with AI help was read and checked before it was kept; this README is written
so every part can be explained.
