# PulseMeet — Command diye Live korar Guide (English + Banglish)

> Ei document-e **command diye** kibhabe app live/update korbe — shoja kore step
> by step. Tomar app already live (Render + GitHub connected), tai **push korlei
> auto-deploy** hoy.

---

## 🚀 Sobcheye important: Update kore live korar 3 command

Code change korar por, ei 3 command-ei live hoye jay:

```bash
git add -A
git commit -m "ki change korlam tar bornona"
git push origin main
```

**Ki hoy:** `git push` korle GitHub-e code jay → **Render nije-i dekhe** notun code
ese geche → **automatic deploy** kore (~3-5 min)। Tomar কিছু করতে hoy na।

> 💡 Ek line-e: `git add -A && git commit -m "update" && git push origin main`

---

## 📋 Step by step (prottek deploy)

```bash
# 1. Project folder-e jao
cd /Users/luminouslabs/projects/PulseMeet

# 2. Ki ki change holo dekho
git status

# 3. Sob change add koro
git add -A

# 4. Commit koro (message-e ki korle likho)
git commit -m "added new feature"

# 5. GitHub-e push → Render auto-deploy shuru korbe
git push origin main
```

Push korar por: **https://dashboard.render.com** → **pulsemeet** → **Events/Logs**
e deploy progress dekhte parba। "Live" dekhালে hoye gece ✅

---

## 🔄 Push chara manually deploy korte (Render CLI)

Jodi push na kore manually deploy trigger korte chao:

```bash
# 1. Render CLI install (ekbar)
brew install render

# 2. Login (browser khulbe)
render login

# 3. Deploy trigger
render deploys create srv-d8mo06ernols73cses10 --wait
```

> `srv-d8mo06ernols73cses10` = tomar pulsemeet service-er ID।

---

## 🗄️ Database command (Neon Postgres)

```bash
# Schema (table structure) database-e push koro
pnpm db:push

# Prisma client generate (model change korle)
pnpm db:generate

# Database GUI-te dekho (browser-e tables)
pnpm db:studio
```

> ⚠️ `db:push` tomar local `.env`-er `DATABASE_URL` (Neon) onujayi cholে।

---

## ✅ Deploy-er age verify command (test)

Push korar age local-e test kore nao:

```bash
# Type/code error ache kina
pnpm exec tsc --noEmit

# Production build kaj kore kina
pnpm build

# Feature test (smoke tests)
pnpm exec tsx scripts/smoke-realtime.ts   # chat
pnpm exec tsx scripts/smoke-call.ts       # call/LiveKit
pnpm exec tsx scripts/smoke-files.ts      # file sharing
```

Egula pass korle deploy korle **fail korbe na**।

---

## 🆕 Notun user add korar command

```bash
pnpm exec tsx scripts/add-user.ts "Naam" email@example.com password123
```

---

## 💻 Local-e chalanor command

```bash
pnpm install                # dependencies (ekbar / change hole)
pnpm dev                    # app chalao → http://localhost:3100
livekit-server --dev        # (calls local-e test korte, alada terminal)
```

---

## 🧰 Command cheat-sheet (quick reference)

| Ki korte chao | Command |
| --- | --- |
| **Live update koro** | `git add -A && git commit -m "msg" && git push origin main` |
| Local-e chalao | `pnpm dev` |
| Build test | `pnpm build` |
| DB schema push | `pnpm db:push` |
| DB GUI | `pnpm db:studio` |
| Notun user | `pnpm exec tsx scripts/add-user.ts "Name" email pass` |
| Ki change holo | `git status` |
| Manual deploy | `render deploys create srv-d8mo06ernols73cses10 --wait` |

---

## 🔁 Pura flow (change → live), ekdom shoja:

```
Code change koro
      │
      ▼
pnpm build            ← (optional) test, error ase kina
      │
      ▼
git add -A
git commit -m "..."
git push origin main  ← EKHANEI live hoy
      │
      ▼
Render auto-deploy (~3-5 min)
      │
      ▼
https://pulsemeet-qjr4.onrender.com  ← notun version LIVE ✅
```

---

## ⚠️ Mone rakhbe

- **`.env` git-e jay na** (gopon) — Render-e env var **dashboard theke** set kora ase। Notun env lagle Render → Environment-e add korte hobe।
- **Build fail korle** Render Events/Logs-e error dekhe nao।
- **Free tier:** 15 min idle → ghumay → prothom load ~50s slow। Normal।

---

**Live:** https://pulsemeet-qjr4.onrender.com
**Code:** https://github.com/srabonmojumder/PulseMeet
**Service ID:** srv-d8mo06ernols73cses10
