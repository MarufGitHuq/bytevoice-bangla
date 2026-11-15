-- ByteVoice Bangla: call data model.
--
-- One call produces: a call record, its transcript turns, the structured
-- fields extracted from it, and (when the caller books) an appointment.
-- Everything links back to the call, so staff can always answer
-- "which call created this booking, and what exactly was said?"
--
-- Safe to run more than once.

create extension if not exists pgcrypto;

-- The person behind the calls. One row per phone number, so a patient who
-- calls three times is one patient with three calls.
create table if not exists patients (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  -- Normalised Bangladeshi mobile number: 11 ASCII digits, e.g. 01711234567.
  -- Bangla digits and +88 prefixes are converted before they reach this table.
  phone       text not null unique check (phone ~ '^01[3-9][0-9]{8}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One record per call.
create table if not exists calls (
  id            uuid primary key default gen_random_uuid(),
  -- LiveKit room name: the natural key that ties the live call to this row.
  room_name     text not null unique,
  patient_id    uuid references patients(id) on delete set null,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  duration_s    integer check (duration_s is null or duration_s >= 0),
  -- Outcome of the call, as staff would file it.
  status        text not null default 'in_progress' check (status in (
                  'in_progress', 'booked', 'rescheduled', 'cancelled',
                  'enquiry', 'follow_up_needed', 'incomplete', 'failed')),
  summary_bn    text,
  summary_en    text,
  -- Which models handled the call: needed to compare quality and cost later.
  stt_model     text,
  llm_model     text,
  tts_model     text,
  error         text
);

create index if not exists calls_started_at_idx on calls (started_at desc);
create index if not exists calls_status_idx on calls (status);
create index if not exists calls_patient_idx on calls (patient_id);

-- Full transcript, one row per spoken turn, in order.
create table if not exists transcript_turns (
  id          bigserial primary key,
  call_id     uuid not null references calls(id) on delete cascade,
  seq         integer not null,
  speaker     text not null check (speaker in ('agent', 'caller')),
  text_bn     text not null,
  -- Milliseconds since the call started: lets the portal show timestamps.
  offset_ms   integer not null check (offset_ms >= 0),
  created_at  timestamptz not null default now(),
  unique (call_id, seq)
);

-- Structured fields pulled out of the conversation. One row per call, filled
-- in as the call goes on, so an interrupted call still keeps what was captured.
create table if not exists call_extractions (
  call_id             uuid primary key references calls(id) on delete cascade,
  patient_name        text,
  phone               text,
  -- false when the phone number failed validation and needs a human check.
  phone_valid         boolean,
  reason_for_visit    text,
  preferred_date      date,
  preferred_time      time,
  doctor              text,
  intent              text check (intent is null or intent in (
                        'book', 'reschedule', 'cancel', 'enquiry', 'callback', 'other')),
  notes               text,
  updated_at          timestamptz not null default now()
);

-- Bookings made.
create table if not exists appointments (
  id            uuid primary key default gen_random_uuid(),
  -- Short code a patient can quote and staff can search.
  reference     text not null unique,
  patient_id    uuid not null references patients(id) on delete restrict,
  -- The call that created the booking.
  call_id       uuid references calls(id) on delete set null,
  doctor        text not null,
  reason        text,
  slot_start    timestamptz not null,
  status        text not null default 'booked' check (status in ('booked', 'cancelled')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- The database, not the language model, prevents double booking: one doctor
-- cannot have two live appointments in the same slot.
-- The name given on the call that made the booking. Two people can share one
-- phone number (a family, for example), and patients are keyed by phone, so the
-- name must be kept with the booking itself, not only on the patient row.
alter table appointments add column if not exists patient_name text;

create unique index if not exists appointments_one_per_slot
  on appointments (doctor, slot_start) where status = 'booked';

create index if not exists appointments_patient_idx on appointments (patient_id);
create index if not exists appointments_slot_idx on appointments (slot_start);

-- Append-only history of what happened to each appointment and which call did
-- it. A reschedule keeps the old slot here instead of overwriting it.
create table if not exists appointment_events (
  id              bigserial primary key,
  appointment_id  uuid not null references appointments(id) on delete cascade,
  call_id         uuid references calls(id) on delete set null,
  event           text not null check (event in ('booked', 'rescheduled', 'cancelled')),
  from_slot       timestamptz,
  to_slot         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists appointment_events_appt_idx on appointment_events (appointment_id);

-- Requests the agent could not handle and handed to a human.
create table if not exists callbacks (
  id          uuid primary key default gen_random_uuid(),
  call_id     uuid references calls(id) on delete set null,
  patient_id  uuid references patients(id) on delete set null,
  name        text,
  phone       text,
  reason      text not null,
  status      text not null default 'open' check (status in ('open', 'done')),
  created_at  timestamptz not null default now()
);

create index if not exists callbacks_status_idx on callbacks (status, created_at desc);
