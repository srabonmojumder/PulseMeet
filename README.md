# PulseMeet

Team chat + video meeting app — real-time chat, voice/video calls, screen sharing, and file sharing.

Built with **Next.js 16 (App Router) · TypeScript · Tailwind · Prisma/SQLite · Auth.js · Socket.io**, with **LiveKit** planned for the media (audio/video/screen-share) layer.

## Status — Walking skeleton ✅

The end-to-end foundation works: authentication + 1:1 real-time text chat.

- 🔐 **Auth** — email/password register & login (Auth.js credentials, JWT sessions, bcrypt)
- 💬 **Real-time 1:1 chat** — Socket.io over a custom Next.js server, messages persisted to the DB
- 🟢 **Presence** — live online/offline indicators
- ✍️ **Typing indicators**
- 👥 **Start conversations** — search people and open a direct message

### Planned next (incremental)

1. Group conversations / team channels
2. File sharing (uploads + attachments)
3. **Voice & video calls** via LiveKit
4. **Screen sharing** via LiveKit
5. Read receipts, notifications, message history pagination

## Architecture

A single custom Node server ([server.ts](server.ts)) runs **both** Next.js and Socket.io on one port, so the browser and realtime layer share an origin.

```
Browser ──HTTP──▶ Next.js (App Router, RSC, API routes)
   │
   └──WebSocket──▶ Socket.io ──▶ Prisma ──▶ SQLite
```

- Socket connections authenticate with a short-lived HMAC token ([src/lib/socket-token.ts](src/lib/socket-token.ts)) minted by a session-protected route (`/api/realtime-token`), so realtime auth reuses the web session without re-implementing it on the socket layer.
- Realtime event handlers live in [src/server/realtime.ts](src/server/realtime.ts); the event contract is shared with the client via [src/lib/realtime-events.ts](src/lib/realtime-events.ts).

## Getting started

```bash
pnpm install
pnpm db:push          # create the SQLite schema
pnpm dev              # starts Next.js + Socket.io on http://localhost:3100
```

Open two browsers (or a normal + incognito window), register two accounts, start a conversation, and chat in real time.

### Useful scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Run the custom server (Next + Socket.io) with hot reload |
| `pnpm build` | Production build |
| `pnpm start` | Run the production server |
| `pnpm db:push` | Sync the Prisma schema to SQLite |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm exec tsx scripts/smoke-realtime.ts` | End-to-end realtime chat smoke test |

## Environment

See `.env` (gitignored). Key variables:

- `DATABASE_URL` — SQLite connection string (`file:./dev.db`)
- `AUTH_SECRET` — Auth.js / socket-token signing secret
- `PORT` — server port (default `3100`)
- `NEXT_PUBLIC_APP_URL` — base URL used for CORS and links
