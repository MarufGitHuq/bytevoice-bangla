# ByteVoice for Bangla: web

Next.js 15 site with two parts:

- `/` is the landing page. Its hero starts a live browser voice call with the
  Bangla receptionist agent (`agent/` in this repo) through LiveKit.
- `/portal` is the staff portal: calls, transcripts, bookings.

## Run locally

    cp .env.example .env.local   # then fill in the values
    npx pnpm@9.15.9 install
    npx pnpm@9.15.9 dev -p 3100

## Where things are

| Path                                                   | What it does                                                                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `app/page.tsx`, `components/landing/`                  | Landing page. `use-call.ts` is the call state machine (idle, connecting, live, ended, error).                                |
| `components/landing/voice-orb.tsx`                     | 3D orb (React Three Fiber + a GLSL shader). `hero-orb.tsx` falls back to a flat circle without WebGL.                        |
| `lib/landing-copy.ts`                                  | All landing-page text in English and Bangla.                                                                                 |
| `app/api/token/route.ts`                               | Signs a 5-minute LiveKit token for a random room and dispatches the agent named in `AGENT_NAME`. Secrets stay on the server. |
| `app/portal/`, `components/portal/`, `lib/portal-*.ts` | Staff portal.                                                                                                                |

## Deploying on Vercel

Set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `AGENT_NAME` and the
portal variables listed in `.env.example`.
