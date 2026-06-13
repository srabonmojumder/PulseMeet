# PulseMeet — System Document (English + Banglish)

> Ei document-e pura app-ta ki, kibhabe kaj kore, kothay ki ase, kibhabe chalabe
> ar maintain korbe — shob **shoja kore** bola hoyeche.

---

## 1. PulseMeet ki? (What is it?)

PulseMeet ekta **team chat + video meeting app** — oneকটা Slack/WhatsApp+Zoom mishiye jemon.

**Features (ki ki kore):**
- 💬 **Real-time chat** — message sathe sathe pouchay, "typing…" dekhay, ke online seta dekhay
- 📞 **Voice call** ar 🎥 **Video call**
- 🖥️ **Screen sharing** (call-er moddhe)
- 📎 **File sharing** — chobi/file pathano jay (chobi preview hoy)
- 👤 **User profile** — naam, bio, profile photo edit kora jay
- 📱 **Installable (PWA)** — phone/desktop-e app hisebe install kora jay
- 🔐 **Login/Register** — email + password

**Live URL:** https://pulsemeet-qjr4.onrender.com

---

## 2. Tech stack (ki ki technology)

| Layer | Technology | Keno |
| --- | --- | --- |
| Frontend + Backend | **Next.js 16** (App Router) + React + TypeScript | ek codebase-e shob |
| Styling | **Tailwind CSS 4** + Lucide icons | modern UI |
| Real-time chat | **Socket.io** | live message/typing/presence |
| Database | **Prisma** ORM + **PostgreSQL** (Neon) | user/message/file save |
| Auth (login) | **Auth.js (NextAuth v5)** + bcrypt | password secure |
| Calls/video/screen | **LiveKit Cloud** (WebRTC) | audio/video/screen-share |
| Hosting | **Render** (free web service) | app internet-e cholay |

---

## 3. Kibhabe kaj kore? (Architecture — how it works)

Ekta **custom server** (`server.ts`) Next.js **ar** Socket.io duto-ke **ek port-e** chalay:

```
   📱 Browser / Phone
        │
        │ HTTPS (page, login, file upload, API)
        ▼
   ┌─────────────────────────┐
   │  Render (server.ts)     │
   │  Next.js + Socket.io    │──── Prisma ───▶ 🗄️ Neon Postgres (users, messages, files)
   └─────────────────────────┘
        │
        │ WebSocket (real-time chat, presence, call invite)
        ▲
   📱 Browser ──── WebRTC (audio/video/screen) ───▶ ☁️ LiveKit Cloud
```

**Flow shoja kore:**
1. Tumi browser-e site kholo → Next.js page dekhায়
2. Login korle → Auth.js password check kore (Neon-e) → session cookie dey
3. Chat: browser Socket.io diye server-er sathe **live connection** banায় → message pathালে sathe sathe onjon-er kache pouchay + Neon-e save hoy
4. Call: "🎥" chap → server ekta **LiveKit token** dey → browser sরাসরি **LiveKit Cloud**-er sathe connect kore audio/video chালায়। Onjon-ke socket diye "incoming call" notification jay
5. File: file upload → server-e save → message-er sathe link pathano hoy

---

## 4. Important files (kon file ki kore)

```
PulseMeet/
├── server.ts                  # Custom server: Next.js + Socket.io ek shathe chalায়
├── render.yaml                # Render deploy config (build/start command, env)
├── prisma/schema.prisma       # Database structure (User, Conversation, Message, Attachment)
├── src/
│   ├── auth.ts                # Login logic (Auth.js, password check, redirect)
│   ├── lib/
│   │   ├── prisma.ts          # Database connection
│   │   ├── queries.ts         # Database theke data ana (conversation, message)
│   │   ├── socket-token.ts    # Socket auth-er jonno secure token
│   │   └── realtime-events.ts # Chat/call event-er type (client+server share kore)
│   ├── server/realtime.ts     # Socket.io logic: message, typing, presence, call invite
│   ├── components/            # UI: sidebar, chat thread, call room, top bar, avatar...
│   └── app/
│       ├── (auth)/            # login + register page
│       ├── (app)/             # logged-in pages: chat, call, settings
│       └── api/               # backend routes: register, livekit-token, upload...
└── scripts/                   # Test + utility scripts (add-user, smoke tests)
```

---

## 5. Kon kon account/service use kora hoyeche

| Service | Kaj | Account |
| --- | --- | --- |
| **GitHub** | Code rakha (`github.com/srabonmojumder/PulseMeet`) | srabonmojumder |
| **Neon** | PostgreSQL database (free) | project: plusemeet |
| **LiveKit Cloud** | Calls/video/screen (free) | project: PulseMeet |
| **Render** | App hosting (free) | service: pulsemeet |

---

## 6. Environment variables (gopon settings)

Egula `.env` file-e (local) ar **Render dashboard → Environment** (production)। `.env` git-e jay na (gopon)।

| Variable | Ki | Example |
| --- | --- | --- |
| `DATABASE_URL` | Neon Postgres (pooled) | `postgresql://...-pooler...` |
| `DIRECT_URL` | Neon Postgres (direct, migration-er jonno) | `postgresql://...` (no -pooler) |
| `AUTH_SECRET` | Login/token sign korar secret | random 64-char |
| `AUTH_TRUST_HOST` | Host trust kora | `true` |
| `LIVEKIT_API_KEY` | LiveKit key | `API...` (LiveKit dashboard theke) |
| `LIVEKIT_API_SECRET` | LiveKit secret | (gopon, 43-char) |
| `NEXT_PUBLIC_LIVEKIT_URL` | LiveKit server URL | `wss://<project>.livekit.cloud` |
| `NEXT_PUBLIC_APP_URL` | App-er URL | `https://pulsemeet-qjr4.onrender.com` |

> ⚠️ **LIVEKIT_API_KEY/SECRET bhul hole call kaj korbe na** ("invalid API key")। Exactly boshate hobe — space/swap na kore। (Ei bug-tai amra fix korechilam।)

---

## 7. Local-e kibhabe chalabe (run on your computer)

```bash
# 1. Dependencies install
pnpm install

# 2. Database schema sync (Neon-e)
pnpm db:push

# 3. (Calls local-e test korte) LiveKit dev server — alada terminal
livekit-server --dev

# 4. App chalao
pnpm dev
# → http://localhost:3100
```

**Test accounts (password shob: `password123`):**
- `charlie@pulsemeet.test`
- `alice@smoke.test`
- `bob@smoke.test`

Notun user add korte: `pnpm exec tsx scripts/add-user.ts "Naam" email@x.com password123`

---

## 8. Update kore abar deploy korar niyom (how to update live)

```bash
# 1. Code change koro
# 2. Commit
git add -A
git commit -m "ki change korle"
# 3. GitHub-e push
git push origin main
```

Push korlei **Render nije-i auto deploy** kore (~3-5 min)। Render dashboard-e log dekhte parba। Na hole **Manual Deploy → Deploy latest commit**।

---

## 9. Verify (kaj korche kina test)

```bash
pnpm exec tsx scripts/smoke-realtime.ts   # chat kaj korche?
pnpm exec tsx scripts/smoke-call.ts       # LiveKit + call invite kaj korche?
pnpm exec tsx scripts/smoke-files.ts      # file sharing kaj korche?
```

---

## 10. Phone-e install (PWA)

| Device | Kibhabe |
| --- | --- |
| **Android** (Chrome) | Topbar-e "Install" → prompt, ba Chrome menu ⋮ → "Install app" |
| **iPhone** (Safari) | "Install" → Share ⎙ → "Add to Home Screen" |
| **Desktop** (Chrome/Edge) | Address bar-er install icon, ba "Install" button |

> Install + camera/mic-er jonno **HTTPS lage** — tai sudhu **live URL**-e (localhost na, LAN IP-er plain http-eও na) kaj kore।

---

## 11. Amra je problem-gula fix korechi (issues solved)

| Problem | Karon | Fix |
| --- | --- | --- |
| Phone-e login hocchilo na | Phone keyboard email boro-hater korto; login redirect `localhost`-e jeto | Email lowercase + redirect asol host-e |
| Console hydration error | Browser extension (ColorZilla) + time format mismatch | `suppressHydrationWarning` |
| Render build fail | pnpm 11 download holo (Node 22 chay, amader 20) | `packageManager: pnpm@10.23.0` pin |
| Call kete jeto / connect na | (1) same identity collision (2) **prod-e bhul LiveKit key** | unique identity + Render-e correct key |
| Profile dropdown lukিয়ে thakto | `.glass` (backdrop-blur) stacking issue | header `z-50` + solid background |
| Login na hoy (stale) | Phone-e purano service worker cache | SW dev-e auto-unregister |

---

## 12. Limitations (ekhon ja mathায় rakhte hobe)

- **Render free tier:** 15 min keu na ele app "ghumiye" jay → porer prothom request **~50 sec slow** (cold start)। Always-on chaile paid plan (~$7/mo)।
- **File upload:** Render-er free disk **ephemeral** — redeploy/restart-e upload kora file **muche jay**। Permanent korte Cloudflare R2 / S3 lagবে।
- **Free database (Neon):** 0.5 GB storage limit (onek, kintu infinite na)।
- **LiveKit free:** bandwidth/participant limit ace (dev/choto use-er jonno যথেষ্ট)।

---

## 13. Future-e ki add kora jay (next ideas)

- Group chat / team channels (ekhon sudhu 1:1)
- Read receipts ("seen")
- Push notifications
- Persistent file storage (R2/S3)
- Message search, edit/delete
- Always-on hosting (paid)

---

**Banano:** Next.js 16 + Socket.io + Prisma/Neon + Auth.js + LiveKit + Render
**Live:** https://pulsemeet-qjr4.onrender.com
**Code:** https://github.com/srabonmojumder/PulseMeet
