# Prompt 01 — Grundgerüst

**Projekt:** Bergwacht Getränkekasse
**Projektordner:** `/Users/laura/claude-sandbox/projects/getraenke/`
**Zielordner für App-Code:** `/Users/laura/claude-sandbox/projects/getraenke/app/`
**Bericht ablegen unter:** `/Users/laura/claude-sandbox/projects/getraenke/BERICHTE/01-grundgeruest.md`

---

## Auftrag

Lege ein lauffähiges Monorepo mit Frontend + Backend + SQLite-DB an. Implementiere das Auth-Skelett mit Admin-Invite-Magic-Link. Stelle sicher, dass `pnpm dev` Frontend und Backend gleichzeitig startet. Schreibe einen kurzen End-zu-End-Test, der zeigt, dass der gesamte Flow durchläuft.

---

## Kontext

Vollständige Konfiguration liegt in `KONFIGURATION.md` im Projektordner-Root — bitte vor Start einmal lesen. Wichtigste Eckdaten:

- **DB:** SQLite, File unter `app/backend/data/getraenke.db`, vor Commits in `.gitignore`
- **Auth:** Admin-only Invite, Magic-Link per Email-Token, dann Passwort setzen, dann JWT-Session
- **Email-Versand:** in dieser Phase **noch kein** echter Provider — Magic-Links werden in der Konsole ausgegeben (Dev-Modus). Schnittstelle aber so designen, dass später ein echter SMTP-Adapter eingehängt werden kann.
- **Sprache:** TypeScript überall
- **Style:** keine Test-Mocks für Auth, lieber echte In-Memory-DB für Tests

---

## Pre-Flight-Check (vor allem anderen ausführen)

Prüfe und dokumentiere in der ersten Sektion des Berichts:

1. Node-Version: `node --version` — Soll: ≥ 20.0.0
2. pnpm verfügbar: `pnpm --version` — falls nein: `npm install -g pnpm`
3. Docker-Daemon erreichbar: `docker ps`
4. Freie Ports: 3000 (Frontend) und 4000 (Backend) — `lsof -i :3000` und `lsof -i :4000`

**Wenn Node fehlt oder zu alt:** STOPPE die Arbeit, schreibe einen Mini-Bericht mit klarem Hinweis für Laura ("Bitte Node 20+ installieren via `brew install node@20`"). Nicht selbst Homebrew-Befehle ausführen — das ist Laura-Territorium.

**Wenn Docker nicht läuft:** Vermerk im Bericht, aber **nicht** stoppen — wir brauchen Docker erst in einer späteren Phase.

**Wenn Ports belegt:** Wähle alternative Ports (3001/4001) und vermerk das im Bericht.

---

## Projektstruktur (Zielzustand)

```
app/
├── package.json              # Workspace-Root
├── pnpm-workspace.yaml
├── .gitignore
├── README.md
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── routes/
│   │   │   ├── Login.tsx
│   │   │   ├── SetPassword.tsx   # Magic-Link-Landing
│   │   │   └── Dashboard.tsx     # Placeholder, nur "Hallo {name}"
│   │   ├── lib/
│   │   │   └── api.ts            # fetch-Wrapper mit JWT
│   │   └── styles/
│   │       └── global.css        # Tailwind-Setup
│   └── tailwind.config.ts
└── backend/
    ├── package.json
    ├── tsconfig.json
    ├── prisma/
    │   ├── schema.prisma
    │   └── seed.ts               # legt Laura als ersten Admin an
    ├── src/
    │   ├── index.ts              # Express-Bootstrap
    │   ├── env.ts                # validierte env-Variablen (zod)
    │   ├── logger.ts             # pino mit pretty in dev
    │   ├── db.ts                 # Prisma-Client-Singleton
    │   ├── auth/
    │   │   ├── jwt.ts
    │   │   ├── password.ts       # argon2 (nicht bcrypt — moderner, kein nativer Compile-Hassle)
    │   │   ├── tokens.ts         # Invite-Token-Generierung + Verifikation
    │   │   └── middleware.ts     # requireAuth, requireAdmin
    │   ├── routes/
    │   │   ├── health.ts         # GET /health → {status:"ok"}
    │   │   ├── auth.ts           # /auth/invite-redeem, /auth/login, /auth/me, /auth/logout
    │   │   └── admin.ts          # POST /admin/invite (Admin-only)
    │   └── email/
    │       └── adapter.ts        # ConsoleEmailAdapter (gibt Link in Logger aus)
    └── data/                     # SQLite-DB landet hier (gitignored)
```

---

## DB-Schema (Phase 1)

In `backend/prisma/schema.prisma`:

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  firstName     String
  lastName      String
  passwordHash  String?  // null bis Magic-Link eingelöst
  guthaben      Int      @default(0)  // in Cent, nicht in Euro!
  isAdmin       Boolean  @default(false)
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  inviteTokens  InviteToken[]
  sessions      Session[]
}

model InviteToken {
  id          String   @id @default(cuid())
  tokenHash   String   @unique  // SHA-256 des Klartext-Tokens
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  expiresAt   DateTime
  redeemedAt  DateTime?

  @@index([userId])
}

model Session {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  expiresAt   DateTime
  revokedAt   DateTime?

  @@index([userId])
}
```

**Wichtig:**
- `guthaben` ist **integer in Cent**, nicht Decimal/Float. Das vermeidet Floating-Point-Bugs bei Bilanzen. Anzeige im Frontend formatiert das zu "€1,50".
- `tokenHash` ist ein Hash, nie der Klartext-Token. Der wird nur per Email/Konsole rausgegeben und nie gespeichert.

---

## API-Endpoints Phase 1

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| GET | `/health` | – | Liveness-Probe |
| POST | `/admin/invite` | Admin | Legt User an, generiert Token, "verschickt" Link via Email-Adapter |
| POST | `/auth/invite-redeem` | – | Body: `{token, password}`. Verifiziert Token, setzt PW-Hash, marked Token als redeemed, gibt JWT zurück |
| POST | `/auth/login` | – | Body: `{email, password}`. Gibt JWT zurück |
| GET | `/auth/me` | User | Aktueller User-Datensatz (ohne `passwordHash`) |
| POST | `/auth/logout` | User | Markiert Session als revoked |

**JWT:** HS256, Secret aus env, Ablauf 7 Tage. Token wird im HTTP-Only-Cookie gesetzt (sameSite=lax, secure in prod). Frontend kriegt zusätzlich Body-JSON mit User-Daten.

---

## Seed-Script

`backend/prisma/seed.ts` soll:

1. Prüfen ob User mit Email `laura_sauer@gmx.de` existiert
2. Wenn nein: anlegen mit `firstName="Laura"`, `lastName="Sauer"`, `isAdmin=true`, `passwordHash=null`
3. Invite-Token generieren, in DB hashen, Klartext-Token in Konsole ausgeben mit vollständiger URL: `http://localhost:3000/set-password?token=XYZ`

So kann Laura beim ersten Start direkt einen Account haben, ohne Email-Versand.

---

## Frontend Phase 1

Nur drei echte Routes, alles minimal:

- `/login` — Email + Passwort, ruft `/auth/login`
- `/set-password?token=…` — neues Passwort + Bestätigung, ruft `/auth/invite-redeem`
- `/` — geschützt, zeigt "Hallo {firstName}, du bist drin." + Logout-Button

Kein Design-Polish in dieser Phase. **Tailwind eingebunden ja**, aber Layout darf nüchtern bleiben — das echte Design kommt in Phase B4 aus dem Design-Track.

---

## Tests (Phase 1)

Mindestens **einer**, der den Happy Path durchläuft:

1. Seed-Daten laden
2. Token aus Seed-Output verwenden → `/auth/invite-redeem`
3. Mit gesetztem Passwort → `/auth/login`
4. Mit JWT → `/auth/me` → korrekte User-Daten

Test-Framework: **vitest** (passt zu Vite, schnell, kein Karma-Theater).

---

## Akzeptanzkriterien

- [ ] `pnpm install` läuft fehlerfrei durch
- [ ] `pnpm dev` startet Frontend und Backend gleichzeitig (concurrently oder separate Skripte ok)
- [ ] `GET http://localhost:4000/health` → `{"status":"ok"}`
- [ ] `pnpm seed` erzeugt Laura als Admin und gibt Magic-Link in Konsole aus
- [ ] Manueller Klick auf den Magic-Link → Passwort setzen → Login → "Hallo Laura" sichtbar
- [ ] `pnpm test` läuft grün durch
- [ ] `.gitignore` enthält `node_modules`, `dist`, `data/*.db`, `.env*` (außer `.env.example`)
- [ ] `.env.example` checked-in, echte `.env` nicht
- [ ] README enthält Quickstart (3 Befehle: install, seed, dev)

---

## Was du selbst entscheiden darfst

- Genaue pnpm-Skript-Namen (haupt­sache `dev`, `test`, `seed`, `build` existieren)
- Express-Router-Struktur (eine Datei pro Feature ist ok)
- Tailwind-Plugin-Setup
- Vite-Proxy-Config für `/api` → `localhost:4000`
- Concurrently vs. separate Skripte für `dev`

## Was du zurückfragen musst

- Falls du bei zod-Schema-Validation, JWT-Cookie-Settings oder Argon2-Parametern Best-Practice-Defaults wählst, die untypisch sind → kurz im Bericht erklären, **nicht** stoppen.
- Falls die Pre-Flight-Checks ergeben, dass Node fehlt: stoppen, klarer Hinweis (siehe oben).
- Falls Prisma-Migration auf SQLite zickt (z. B. wegen Migrations-Skript-Eigenheiten) → versuche zuerst `prisma db push` als pragmatische Variante in dieser Phase, vermerke das im Bericht.

---

## Erwartete Datei-Outputs

- Komplette App-Struktur unter `/Users/laura/claude-sandbox/projects/getraenke/app/`
- Funktionierende `package.json` in Root + Frontend + Backend
- `BERICHTE/01-grundgeruest.md` nach Schema (Erledigt / Probleme / Entscheidungen / Offene Fragen / Nächster Schritt)

---

## Sicherheitshinweise

- **Niemals** das JWT-Secret in den Code-Commit. Aus `.env`, in `.env.example` als Platzhalter.
- **Niemals** ein Default-Admin-Passwort hardcoden. Laura setzt es selbst via Magic-Link.
- argon2-Parameter mindestens: `memoryCost=19456`, `timeCost=2`, `parallelism=1` (OWASP-Empfehlung 2024).

---

## Zeitschätzung

Auf einem schnellen Mac Mini: **2-4 Stunden** für einen sauberen Durchlauf inkl. Tests. Wenn du in Loops landest mit Prisma oder TypeScript-Configs: kurz vermerken, weitermachen. Wir können nachschärfen.
