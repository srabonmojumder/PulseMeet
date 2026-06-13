# Deploying PulseMeet (Vercel + LiveKit Cloud)

PulseMeet has three moving parts. Vercel can host two of them; the realtime
socket server needs a host that allows long-lived processes.

| Part | Local | Production |
| --- | --- | --- |
| Next.js web app + API routes | `server.ts` | **Vercel** |
| Realtime Socket.io server | `server.ts` (same process) | **Separate host** (Railway / Render / Fly / VPS) running `realtime-server.ts` |
| Media (audio/video/screen) | `livekit-server --dev` | **LiveKit Cloud** |
| Database | SQLite file | **Postgres** (Vercel Postgres / Neon / Supabase) |
| File uploads | `public/uploads/` | **Object storage** (Vercel Blob / S3 / R2) |

> Why the split? Vercel runs serverless functions — there's no persistent
> process to hold WebSocket connections. The custom `server.ts` that runs Next +
> Socket.io together is for local/single-host use. In serverless, the browser
> connects to a standalone realtime server via `NEXT_PUBLIC_SOCKET_URL`.

---

## 1. Switch the database to Postgres

SQLite doesn't work on serverless. In `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"   // was: sqlite
  url      = env("DATABASE_URL")
}
```

> Note: the `type` field on `Conversation` is a `String` (it was modelled that
> way for SQLite). You can keep it as-is, or convert it to a real `enum` now that
> Postgres supports enums.

Create a Postgres database (Vercel Storage → Postgres, or Neon/Supabase), then:

```bash
DATABASE_URL="postgres://..." pnpm exec prisma db push
```

## 2. File uploads → Vercel Blob

`public/uploads/` is read-only on Vercel. Swap the upload route to Blob:

```bash
pnpm add @vercel/blob
```

In `src/app/api/upload/route.ts`, replace the `writeFile` block with:

```ts
import { put } from "@vercel/blob";
const blob = await put(filename, file, { access: "public" });
// return { url: blob.url, name: file.name, contentType: file.type, size: file.size }
```

Add the `BLOB_READ_WRITE_TOKEN` env var (Vercel adds it automatically when you
create a Blob store).

## 3. LiveKit Cloud

1. Create a project at https://cloud.livekit.io
2. Copy the **API Key**, **API Secret**, and **WebSocket URL** (`wss://<proj>.livekit.cloud`).
3. Set env vars (below). No other code changes — the token route and call UI
   already read these.

## 4. Deploy the realtime server (Railway/Render)

Deploy this repo to a process host and set its start command to:

```bash
pnpm install && pnpm realtime
```

`realtime-server.ts` listens on `$PORT` (or `REALTIME_PORT`), exposes `/healthz`,
and reads:

- `DATABASE_URL` — **same** Postgres as the web app
- `AUTH_SECRET` — **same** secret as the web app (token verification)
- `CORS_ORIGIN` — the web app's public URL (e.g. `https://yourapp.vercel.app`)

Note its public URL, e.g. `https://pulsemeet-realtime.up.railway.app`.

## 5. Deploy the web app to Vercel

Import the repo in Vercel. Build command `pnpm build`, output is detected
automatically. Set environment variables:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` | `openssl rand -hex 32` (same as realtime host) |
| `AUTH_TRUST_HOST` | `true` |
| `NEXT_PUBLIC_APP_URL` | `https://yourapp.vercel.app` |
| `NEXT_PUBLIC_SOCKET_URL` | realtime host URL from step 4 |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | from LiveKit Cloud |
| `NEXT_PUBLIC_LIVEKIT_URL` | `wss://<proj>.livekit.cloud` |
| `BLOB_READ_WRITE_TOKEN` | from Vercel Blob |

Then point `CORS_ORIGIN` on the realtime host at the final Vercel URL and
redeploy it.

## 6. Verify

- Open the Vercel URL, register, send a message → realtime works (socket
  connects to `NEXT_PUBLIC_SOCKET_URL`).
- Start a video call → connects to LiveKit Cloud.
- Attach a file → uploads to Blob.
- On mobile/desktop Chrome, use the browser's **Install** option (PWA).

---

### Alternative: single VPS with Docker

If you'd rather keep one process, run `server.ts` (Next + Socket.io together) on
a VPS behind nginx with TLS, alongside `livekit-server` and Postgres via
docker-compose. This avoids the Vercel serverless split entirely. Ask and a
Dockerfile + compose file can be added.
