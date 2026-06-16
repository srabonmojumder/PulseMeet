# PulseMeet — Project Overview

PulseMeet is a **real-time team chat & video-meeting application** (Slack / WhatsApp style):
1:1 and group messaging, live presence, reactions & replies, voice messages, disappearing
messages, AI assists, file sharing, and audio/video calls with screen sharing — packaged as
an installable PWA.

This document describes **what has been built on the frontend and the backend**.

---

## 1. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | **Next.js 16** (App Router) + **React 19** + **TypeScript** |
| Styling | **Tailwind CSS v4** |
| Database / ORM | **Prisma** (PostgreSQL — `DATABASE_URL` / `DIRECT_URL`) |
| Auth | **NextAuth v5** (Credentials provider, JWT sessions, bcrypt) |
| Realtime | **Socket.io** (custom Node server) |
| Calls | **LiveKit** (audio / video / screen share) |
| AI | **Anthropic SDK** — Claude `claude-opus-4-8` (optional; free local fallback when no key) |
| Packaging | **PWA** (Web manifest + service worker) |
| Validation | **zod** |
| Package manager | pnpm |

The app runs on a **custom Node server** (`server.ts`) that hosts Next.js and the Socket.io
realtime server in a single process.

---

## 2. Architecture (high level)

```
        Browser (React / PWA)
   ┌───────────────┬──────────────────┬───────────────┐
   │  HTTP/SSR     │  Socket.io (WS)   │  WebRTC        │
   ▼               ▼                   ▼
Next.js App ── Socket.io server ── LiveKit (media SFU)
   │  (server.ts: both in one process)
   ▼
Prisma  ──►  PostgreSQL
```

- **Next.js** handles pages, server components, server actions and REST-style API routes.
- **Socket.io** handles live messaging, typing, presence, reactions and call invites.
- **LiveKit** handles the actual audio/video/screen-share media; the app only mints
  access tokens and renders the call UI.

---

## 3. Backend — what's done

### 3.1 Custom server — `server.ts`
- Boots Next.js **and** Socket.io in one HTTP server.
- Forwards the real `x-forwarded-host` / `x-forwarded-proto` headers so Auth.js builds the
  correct post-login redirect origin (fixes logins from phones / other devices / tunnels,
  where "localhost" would otherwise be wrong).
- CORS is permissive in dev (so tunnels/phones can connect) and locked to the app URL in
  production.
- `realtime-server.ts` is a **standalone** Socket.io server for deployments where the web
  app can't host long-lived WebSockets (e.g. serverless). It shares the DB and auth secret
  and exposes a `/healthz` probe.

### 3.2 Database schema — `prisma/schema.prisma`
Six models:

| Model | Purpose |
|-------|---------|
| `User` | account, profile, bio. Avatar stored **as bytes in the DB** (`avatarData` / `avatarType`) so it survives redeploys on ephemeral disks. |
| `Conversation` | a thread; `type` = `DIRECT` or `GROUP`; optional `name` for groups. |
| `ConversationMember` | join table (user ↔ conversation), tracks `lastReadAt` (drives "Seen" receipts). Cascade-deletes with user/conversation. |
| `Message` | content + sender + timestamps, indexed by `(conversationId, createdAt)`. Extended with: `editedAt`, `deletedAt` (soft delete), `replyToId` (self-relation for quote-replies), `expiresAt` (disappearing), `scheduledFor` / `deliveredAt` (scheduled send — schema only for now). |
| `Reaction` | per-message emoji reaction (`messageId` + `userId` + `emoji`, unique together). |
| `Attachment` | file metadata (url, name, contentType, size) linked to a message; also used for voice messages (audio mime type). |

### 3.3 Authentication — NextAuth v5 (`src/auth.ts`)
- **Credentials** provider with email + password, hashed via **bcrypt**.
- **JWT** session strategy; user id is carried in the token and surfaced on `session.user.id`.
- Profile edits (name / image) reflect into the session without re-login (`jwt` `update` trigger).
- Custom `redirect` callback rebuilds the base URL from the real request host (multi-device safe).
- A **defensive auth gate** in `src/app/(app)/layout.tsx` verifies the session's `User` row
  still exists in the DB — a stale JWT (e.g. after a DB reseed) is treated as logged-out and
  redirected to `/login` instead of crashing on a foreign-key violation.

### 3.4 Realtime — `src/server/realtime.ts`
Socket connections are authenticated with a short-lived signed token. Events handled:

**Client → server**
- `conversation:join` / `conversation:leave` — room membership (with member check).
- `message:send` — **persists the message to the DB**, bumps `Conversation.updatedAt`, then broadcasts. Accepts `replyToId` (quote-reply) and `expireSeconds` (disappearing).
- `reaction:toggle` — add/remove an emoji reaction on a message.
- `message:edit` / `message:delete` — edit text / soft-delete (sender-only, validated server-side).
- `read` — mark the conversation read up to now (drives "Seen").
- `typing` — typing indicator **+ live draft text** (shows what the peer is typing in real time).
- `convo:active` — per-conversation co-presence ("who is viewing this chat now").
- `reaction:fly` — broadcast a floating emoji reaction.
- `call:invite` — ring the other members.

**Server → client**
- `message:new`, `message:update` (edit / delete / reaction change — replace by id),
  `read` (receipt), `typing`, `presence` (online/offline), `convo:presence`, `reaction:fly`,
  `call:incoming`, `error`.

The event contracts are shared between server and client in `src/lib/realtime-events.ts`
(typed `ClientToServerEvents` / `ServerToClientEvents`, plus `MessageDTO` / `ReactionDTO` /
`ReplyPreviewDTO`).

### 3.5 API routes — `src/app/api/`
| Route | Purpose |
|-------|---------|
| `auth/[...nextauth]` | NextAuth handler (login/session). |
| `register` | Create account (zod-validated, bcrypt hash). |
| `realtime-token` | Mint the signed Socket.io auth token for the logged-in user. |
| `livekit-token` | Mint a LiveKit room access token — **only conversation members** can join. |
| `upload` | File upload (≤ 25 MB) to `public/uploads`, with extension whitelisting (also serves voice messages). |
| `avatar` (POST + `avatar/[userId]` GET) | Store/serve the profile photo **from the DB**. |
| `ai` (POST) | AI "Catch Me Up" + Smart Replies. Uses Claude when `ANTHROPIC_API_KEY` is set, else a **free local fallback** (see §5). |

### 3.6 Server actions & queries
- `src/app/(app)/chat/actions.ts` — `startDirectConversation`, `searchUsers`,
  `createGroupConversation`.
- `src/app/(app)/settings/actions.ts` — profile updates.
- `src/lib/queries.ts` — conversation list/detail, `getOrCreateDirectConversation`
  (now validates both participants exist before insert), user search. Also exports the
  shared `messageInclude` + `toMessageDTO()` (one DTO shape for the loader and the realtime
  server) and `visibleMessageWhere()` (hides expired / undelivered messages).

---

## 4. Frontend — what's done

### 4.1 Routes (App Router)
| Route group | Pages |
|-------------|-------|
| `(auth)` | `/login`, `/register` |
| `(app)` | chat list `/chat`, conversation `/chat/[conversationId]`, call room `/call/[conversationId]`, `/settings` |
| root | landing `/`, PWA `manifest.ts`, icons |

`(app)/layout.tsx` wraps the authenticated area with the realtime provider, the top bar,
and the session/auth gate.

### 4.2 Components — `src/components/`
| Component | Role |
|-----------|------|
| `message-thread.tsx` (largest) | the core chat UI — messages, attachments, live typing preview, co-presence, **per-message reactions, quote-replies, edit/delete, "Seen" receipts, voice recorder, disappearing-timer**, and the AI panels. The composer's **paperclip opens a popup menu** (Photo / File / Voice message / AI smart replies / Disappear-after) instead of a row of separate icons. |
| `sidebar.tsx` | conversation list, new-chat modal, user search, group creation. |
| `realtime-provider.tsx` | Socket.io connection + React context for live events. |
| `call-room.tsx` | LiveKit room — video/audio tiles + screen share. |
| `top-bar.tsx` | header, profile menu, sign-out. |
| `avatar.tsx` | user avatar with online indicator. |
| `profile-form.tsx` | edit name / bio / photo. |
| `chat-shell.tsx` | responsive sidebar + content layout. |
| `install-button.tsx` / `pwa-register.tsx` | PWA install prompt + service-worker registration. |
| `logo.tsx`, `providers.tsx` | branding + app providers. |

### 4.3 PWA
- `manifest.ts`, app icons (SVG + Apple touch icon), service-worker registration → the app
  is **installable** on mobile/desktop with standalone display.

---

## 5. Feature checklist

- [x] Email/password registration & login (bcrypt + JWT)
- [x] 1:1 direct conversations
- [x] Group conversations
- [x] Real-time messaging (Socket.io, persisted to DB)
- [x] **Live typing preview** — see the peer's draft as they type
- [x] **Live Together** — per-conversation co-presence + synchronized floating reactions
- [x] Online/offline presence indicators
- [x] File attachments / uploads (≤ 25 MB)
- [x] Profile photos stored in the database
- [x] Audio / video calls + screen sharing (LiveKit)
- [x] Multi-device / tunnel-safe auth redirects
- [x] Installable PWA
- [x] Stale-session protection (dead JWT → forced re-login)

### Modern features (v2)

- [x] **Message reactions** — persistent per-message emoji reactions (toggle, grouped counts, names on hover)
- [x] **Reply threads** — quote-reply with a clickable jump-to-original
- [x] **Edit & delete** — edit your own messages (shows "edited"); soft-delete ("This message was deleted")
- [x] **Read receipts** — "Seen" on your last message in direct chats (driven by `ConversationMember.lastReadAt`)
- [x] **Voice messages** — hold-to-record via `MediaRecorder`, uploaded as an audio attachment with an inline player
- [x] **Disappearing messages** — optional self-destruct timer (1 min / 1 hour / 1 day) with a live countdown
- [x] **Composer attach menu** — paperclip opens a popup (Photo / File / Voice / AI smart replies / disappear-timer)
- [x] **AI "Catch Me Up"** — recent-conversation recap (Claude when keyed, free local recap otherwise)
- [x] **AI Smart Replies** — 3 ready-to-send suggestions (Claude when keyed, free heuristic otherwise)
- [ ] **Scheduled send** — *schema is ready (`scheduledFor`/`deliveredAt`); delivery sweeper pending (see "Deferred")*

**AI setup (works for free, no key required):** Catch Me Up and Smart Replies run in two modes,
chosen automatically in `src/app/api/ai/route.ts`:
- **Free local mode** (default, no key) — Catch Me Up builds a quick recap (who said what,
  open questions, last lines); Smart Replies returns context-aware canned suggestions. Instant,
  no signup, no cost.
- **Claude mode** — set `ANTHROPIC_API_KEY` in `.env` and both upgrade to `claude-opus-4-8`
  for higher-quality output (Smart Replies via structured output). If a Claude call fails, the
  route silently falls back to the free local mode rather than erroring.

**Deferred to a follow-up:** *scheduled messages* need a background delivery loop in the
realtime server (release the message + broadcast when `scheduledFor` is due). The DB columns
and the visibility filter already exist, so it's an additive change.

---

## 6. Folder map

```
PulseMeet/
├─ server.ts                 # custom Next.js + Socket.io server
├─ realtime-server.ts        # standalone realtime server (optional deploy)
├─ prisma/
│  └─ schema.prisma          # User, Conversation, ConversationMember, Message, Reaction, Attachment
├─ src/
│  ├─ auth.ts                # NextAuth v5 config
│  ├─ middleware? (none)     # auth gating done in (app)/layout.tsx
│  ├─ server/realtime.ts     # Socket.io event handlers (persist + broadcast)
│  ├─ lib/
│  │  ├─ prisma.ts           # Prisma client
│  │  ├─ queries.ts          # conversation/user DB queries
│  │  ├─ realtime-events.ts  # shared socket event types
│  │  └─ socket-token.ts     # sign/verify socket auth tokens
│  ├─ app/
│  │  ├─ (auth)/             # login, register
│  │  ├─ (app)/              # chat, call, settings (+ layout/auth gate)
│  │  └─ api/                # auth, register, realtime-token, livekit-token, upload, avatar, ai
│  └─ components/            # UI (see §4.2)
└─ public/uploads/           # uploaded files
```

---

## 7. Environment variables

| Var | Used for |
|-----|----------|
| `DATABASE_URL` / `DIRECT_URL` | Prisma / PostgreSQL connection |
| `AUTH_SECRET` | NextAuth + socket token signing |
| `AUTH_TRUST_HOST` | trust forwarded host (multi-device auth) |
| `NEXT_PUBLIC_APP_URL` | public app URL (CORS, redirects) |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | mint LiveKit tokens |
| `NEXT_PUBLIC_LIVEKIT_URL` | LiveKit server URL (client) |
| `ANTHROPIC_API_KEY` | **Optional.** Upgrades AI Catch Me Up & Smart Replies to Claude (`claude-opus-4-8`). If unset, those features still work via a free local fallback. |
| `PORT` | server port |

---

## 8. Scripts

| Command | What it does |
|---------|--------------|
| `pnpm dev` | run Next.js + Socket.io together (`tsx watch server.ts`) |
| `pnpm build` | production build |
| `pnpm start` | run production server |
| `pnpm realtime` | run the standalone realtime server |
| `pnpm db:push` / `db:generate` / `db:studio` | Prisma schema sync / client gen / studio |
| `pnpm gen:icons` | generate PWA icons |
| `pnpm lint` | ESLint |
