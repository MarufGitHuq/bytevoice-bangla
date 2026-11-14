# ByteVoice Bangla

A Bangla voice receptionist for a dental clinic, with a landing page and a staff
portal. `agent/` is the LiveKit voice agent, `web/` is the Next.js site and
portal, `db/schema.sql` is the data model.

## Rules that are easy to get wrong

- **The agent speaks Bangladeshi Bangla.** Not West Bengal vocabulary. Spoken
  text contains no digits: numbers, dates and times are written in Bangla words.
- **Facts come from code, not the model.** Clinic details live in
  `agent/src/clinic.ts`; dates come from the lookup table in `validation.ts`.
  Never ask the model to calculate a date or state a fee that is not listed.
- **Only `agent/src/store.ts` talks to the database.** Tools call store
  functions. Double booking is prevented by a unique index, not by the prompt.
- **Tools never throw at the model.** They return a plain sentence telling the
  receptionist what to do next.
- **Close speech connections.** The free LiveKit plan allows 5 at once.
- **Secrets stay in `.env.local`**, which is ignored. Keep database TLS
  verification on; pass a CA certificate rather than disabling it.

## Checking a change

After changing the instructions or a tool, run the text test before testing by
voice. It makes real model calls but no speech calls:

    docker build -t bytevoice-agent agent
    docker run --rm --env-file agent/.env.local --add-host host.docker.internal:host-gateway -w /app bytevoice-agent node scripts/text-check.mjs

The agent runs in Docker on Windows: its native audio module is blocked by
Application Control when run directly.

    cd agent && npx tsc --noEmit
    cd web && npx tsc --noEmit
