# PulseMeet — Kibhabe Kaj Kore? (How It Works — Simple)

> Ei document-e **kono technical jaান chara**-i bujhe jabe app-ta vitore vitore
> kibhabe kaj kore. Daily life-er example diye bola hoyeche.

---

## 🎯 Boro chobi (The big picture)

PulseMeet-er **4 ta angsho** ekshathe kaj kore — bhabো ekta restaurant:

| Angsho | Restaurant-e jemon | Amader app-e |
| --- | --- | --- |
| **App (Render)** | Waiter / manager | Tomar request handle kore |
| **Database (Neon)** | Store room / register khata | Sob message, user, file lekha thake |
| **Realtime (Socket.io)** | Intercom / bell | Sathe sathe khobor dey |
| **LiveKit Cloud** | Telephone line | Audio/video call cholay |

Tumi (browser/phone) order dao → waiter (app) kaj kore → dরকার hole store room (database)
theke ana-neoয়া kore → bell (realtime) bajiye onjon-ke janay।

---

## 🔐 Login kibhabe kaj kore?

Bhabো ekta **club-er gatekeeper**:

```
Tumi: email + password dao
        │
        ▼
App: database-e check kore — "ei email-er password thik?"
        │
        ├── ❌ Vul → "Invalid email or password"
        │
        └── ✅ Thik → tomake ekta "pass" (cookie) dey
                     │
                     ▼
            Ei pass thakle tumi vitore (chat) dhukte paro,
            barbar password ditে hoy na
```

- Password **secure-bhabe** rakha (bcrypt diye "lock" kora) — keu database dekhleও
  asol password dekhte parbe na।
- Ei "pass" (session) koyek din thake, tarpor abar login lागे।

---

## 💬 Message kibhabe sathe sathe pouchay?

Eta **telephone-er live line**-er moto — email-er moto na (email-e refresh korte hoy)।

Bhabো tumi (Alice) ar tomar bondhu (Bob) duজon-i app-er sathe ekta **sবসময় খোলা
line** (WebSocket) diye jukto:

```
Alice "Hi" likhe Send chap
        │
        ▼
App (server): (1) message database-e save kore
              (2) shaথে shaথে Bob-er khola line-e pathiয়ে dey
        │
        ▼
Bob-er screen-e "Hi" sathe sathe foote othe — refresh kora lage na ✅
```

**Bonus jinish jeগুলো ei khola line diye hoy:**
- ✍️ **"typing…"** — keu likhle onjon dekhe
- 🟢 **Online dot** — ke ekhon ase
- 📞 **Incoming call** — keu call dile janান jay

---

## 🎥 Call (audio/video/screen) kibhabe connect hoy?

Eta ektu alada — message app-er moddhe diye jay, kintu **call-er audio/video
sরাসরি duজon-er moddhe** jay (faster), **LiveKit** namok ekta service-er sahajje।

```
Alice "🎥 Video" chap
        │
        ├─ App ekta "ticket" (token) dey → "tumi ei call room-e dhukte paro"
        │
        ├─ App, Bob-ke bell bajay → "Alice call dicche" (Join button ase)
        │
        ▼
Alice ar Bob duজon-i LiveKit Cloud-er ekই "room"-e dhoke
        │
        ▼
LiveKit duজon-er camera/mic-er data ek arekjon-er kache pouchiয়ে dey
        │
        ▼
🎥 Live video + 🔊 audio + 🖥️ screen share cholে
```

**Keno LiveKit lागে?** Camera/video-er data onek boro ar fast pathate hoy। LiveKit
eta-i bishesh-bhabe kore (NAT/firewall paar koriয়ে duজon-ke jor lागায়)।

> ⚠️ Call-er jonno **camera/mic-er permission** dিতে hoy (browser jigges korbe → Allow)।
> Ar **HTTPS** lागে (tai live URL-e kaj kore, localhost-eও kaj kore)।

---

## 📎 File kibhabe share hoy?

```
Tumi 📎 chap → file select koro → Send
        │
        ▼
File app-er server-e upload hoy → ekta "link" toiri hoy
        │
        ▼
Message-er sathe link pathano hoy
        │
        ▼
Onjon: chobi hole preview dekhe, onno file hole download kore
```

---

## 🗄️ Tomar data kothay thake?

| Data | Kothay |
| --- | --- |
| User (naam, email, password-lock, bio, photo) | **Neon database** |
| Sob message | **Neon database** |
| File-er info (naam, link) | **Neon database** |
| Asol file (chobi/pdf) | App-er server-er disk-e |
| Login session | Tomar browser-er cookie-te |

> Database = ekta digital register khata, sবকিছু gucchiye lekha thake, harায় na।

---

## 🌐 App internet-e kibhabe cholche?

```
Tomar code GitHub-e ache (online code locker)
        │
        ▼
Render (hosting company) shei code niye ekta computer-e app-ta CHALU rakhe
        │
        ▼
Render ekta web address dey: https://pulsemeet-qjr4.onrender.com
        │
        ▼
Jekono manush, jekono jayga theke, ei link-e dhuke app use korte parে 🌍
```

- **Code change → `git push`** korle Render **nije notun version chালু** kore dey।
- Database (Neon) ar call (LiveKit) **alada company-r service**, app oder sathe
  internet diye kotha bole।

---

## 🔄 Ekta message-er pura journey (full example)

Alice phone theke Bob-ke "Kemon acho?" pathালo:

```
1. Alice phone-e type kore Send chap
2. Phone → internet → Render-er app-e jay
3. App: "Alice ki ei chat-er member?" → ✅ (database check)
4. App: message-ta Neon database-e save kore
5. App: Bob-er khola line-e message-ta pathay
6. Bob-er phone-e "Kemon acho?" sathe sathe dekhায়
7. Bob jodi offline thake → message database-e ache,
   pore login korle dekhbe
```

Pura jinish-ta **1 second-er-o kom** somoy-e hoy ⚡

---

## 🧩 Ek nojore (summary)

- **App (Render)** = manager, sob handle kore
- **Database (Neon)** = register khata, sob lekha thake
- **Realtime (Socket.io)** = live line, sathe sathe khobor
- **LiveKit** = telephone line, call cholay
- **Login (Auth.js)** = gatekeeper + pass
- **GitHub** = code-er locker; `git push` = notun version live

Sob mile = ekta **complete chat + meeting app**, jeta jekono jaygা theke chole।

---

**Live:** https://pulsemeet-qjr4.onrender.com
**Aro details:** [SYSTEM.md](SYSTEM.md) (technical) · [GO-LIVE.md](GO-LIVE.md) (deploy commands)
