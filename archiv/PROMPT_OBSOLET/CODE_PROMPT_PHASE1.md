# 💻 CODE-PROMPT FÜR CLAUDE CODE – PHASE 1: GRUNDGERÜST

## Bergwacht Getränkekasse – Frontend + Backend Setup

> **Hinweis (Stand 21.05.2026):** Dieser Prompt enthält noch Stände vor KONFIGURATION.md Update 1–4 (z. B. Self-Signup, `isOptInRanking`, Decimal-Guthaben, alte Farbpalette). Maßgeblich ist immer **KONFIGURATION.md** (jüngstes Update). Vor Code-Start klären, welche Prompt-Datei wirklich gefahren wird — `01-grundgeruest.md` (TS-Monorepo + Magic-Link) oder dieser hier (JS + Self-Signup).
> **Update-4-relevant:** Phase 2 bringt Getränkekatalog + Transaktionen — siehe „Phase-2-Vorausblick" weiter unten.

---

## 🎯 AUFGABE

Erstelle das **Grundgerüst** für die Bergwacht Getränkekasse Web-App. Die App soll laufen mit funktionierendem **Login/Registrierung**. Features kommen in Phase 2.

**Projektordner:** `/Users/laura/claude-sandbox/projects/getraenke/`

---

## 📋 PROJEKT-KONTEXT

- **Domain:** getraenke.einfall.app
- **Getränkeverwalter:** Laura Sauer (laura_sauer@gmx.de)
- **Admin-Email:** laura_sauer@gmx.de
- **Server:** Hetzner (für später)

---

## 🗂️ PROJEKTSTRUKTUR (zu erstellen)

```
getraenke/
├── frontend/                       # React 18 + Vite
│   ├── src/
│   │   ├── components/
│   │   │   └── ProtectedRoute.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   └── Admin.jsx
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx
│   │   ├── styles/
│   │   │   ├── globals.css
│   │   │   └── tailwind.css
│   │   ├── utils/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── package.json
│
├── backend/                        # Node.js + Express + Prisma
│   ├── src/
│   │   ├── routes/
│   │   │   └── auth.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   └── errorHandler.js
│   │   ├── config/
│   │   │   └── database.js
│   │   └── server.js
│   ├── prisma/
│   │   └── schema.prisma
│   ├── .env.example
│   ├── .env
│   └── package.json
│
└── BERICHTE/
    └── 01-grundgeruest.md         # Bericht nach Fertigstellung
```

---

## 💾 DATENMODELL (Prisma)

```prisma
// backend/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"  // Für Dev: SQLite (einfach)
  url      = env("DATABASE_URL")
}

model User {
  id                 Int      @id @default(autoincrement())
  email              String   @unique
  password           String   // bcrypt hash
  firstName          String?
  lastName           String?
  guthaben           Decimal  @default(0.00)  // WICHTIG: KANN NEGATIV SEIN! Keine Constraint!
  isAdmin            Boolean  @default(false)
  isVerified         Boolean  @default(false)
  isOptInRanking     Boolean  @default(true)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}
```

**⚠️ WICHTIG:** `guthaben` kann negativ sein! Keine CHECK-Constraint!

**⚠️ Empfehlung (Update 4 / KONFIGURATION.md):** `guthaben` als `Int` in **Cent** speichern statt `Decimal` — passt zu `preisAtKauf` (Cent) aus Phase 2 und vermeidet Floating-Point-Drift. Anzeige im Frontend formatiert zu „€1,50".

**⚠️ Hinweis zu `isOptInRanking`:** Wurde in KONFIGURATION.md **Update 1** zusammen mit dem Leaderboard gestrichen. Feld bitte weglassen.

---

## 🔮 Phase-2-Vorausblick (relevant für Phase-1-Datenmodell-Wahl)

Damit Phase 1 uns in Phase 2 nicht in eine Migration zwingt, sollte das Schema schon kompatibel angelegt sein:

```prisma
// kommt in Phase 2 — hier nur als Vorausblick

enum DrinkKategorie {
  alkoholfrei
  alkoholisch
  sonstiges        // bewusst KEIN heissgetraenk
}

model Drink {
  id         String          @id @default(cuid())
  name       String
  preis      Int             // Cent
  icon       String          // Emoji-String
  kategorie  DrinkKategorie
  isActive   Boolean         @default(true)
  createdAt  DateTime        @default(now())
  updatedAt  DateTime        @updatedAt

  transaktionen Transaktion[]
}

model Transaktion {
  id            String   @id @default(cuid())
  userId        String
  typ           String   // 'kauf' | 'aufladung' | 'admin_anpassung'
  betrag        Int      // Cent, vorzeichenbehaftet (Kauf negativ, Aufladung positiv)
  drinkId       String?  // nur bei typ='kauf'
  preisAtKauf   Int?     // Cent, eingefroren — Preisänderungen verfälschen Historie nicht
  notiz         String?
  createdAt     DateTime @default(now())

  user   User   @relation(fields: [userId], references: [id])
  drink  Drink? @relation(fields: [drinkId], references: [id])

  @@index([userId])
  @@index([drinkId])
}
```

**Konsequenzen für Phase 1:**
- `User.guthaben` als `Int` (Cent) anlegen — nicht Decimal
- Kategorie-Enum bewusst nur die drei genannten Werte (kein „heissgetraenk")
- Soft-Disable über `isActive=false`, kein Hard-Delete
- Aggregierte Sorten-Statistik (App-weit, anonym, ohne User-Bezug) wird in B2 ergänzt — DSGVO-Begründung in KONFIGURATION.md, DSGVO-Sektion

---

## 🌐 API-ROUTES (Backend)

### **POST /auth/register**
```javascript
Body: {
  email: string,
  password: string,
  firstName: string,
  lastName: string
}
Response: { success: true, message: "User created" }
```

### **POST /auth/login**
```javascript
Body: {
  email: string,
  password: string
}
Response: {
  success: true,
  token: "jwt_token_here",
  user: { id, email, firstName, lastName, isAdmin }
}
```

### **GET /auth/me** (Auth-protected)
```javascript
Headers: { Authorization: "Bearer jwt_token" }
Response: {
  user: { id, email, firstName, lastName, guthaben, isAdmin, isOptInRanking }
}
```

### **POST /auth/logout**
```javascript
Response: { success: true }
```

---

## 🎨 DESIGN-SYSTEM (Frontend)

### **Farben (CSS Custom Properties in globals.css)**

```css
:root {
  --color-primary: #00784b;        /* Bergwacht-Grün */
  --color-accent: #f59100;         /* Orange */
  --color-background: #f5f1e8;     /* Warm-Creme */
  --color-wood: #3d2817;           /* Dunkles Braun */
  --color-text: #2a2a2a;           /* Dunkelbraun */
  --color-alert: #e60005;          /* DRK-Rot */
  --color-white: #ffffff;
}
```

### **Typografie**

```css
/* Merriweather von Google Fonts laden */
@import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap');

h1, h2, h3 {
  font-family: 'Merriweather', serif;
  color: var(--color-primary);
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
  color: var(--color-text);
  font-size: 16px;
  line-height: 1.5;
  background: var(--color-background);
}
```

### **Buttons (Standard-Komponente)**

```css
.btn {
  padding: 12px 20px;
  border-radius: 6px;
  border: 2px solid var(--color-wood);
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;  /* Touch-friendly */
}

.btn-primary {
  background: var(--color-primary);
  color: var(--color-white);
}

.btn-primary:hover {
  background: var(--color-accent);
  transform: translateY(-2px);
}
```

### **Holz-Rahmen-Karten**

```css
.card {
  background: var(--color-background);
  border: 2px solid var(--color-wood);
  border-radius: 6px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
```

### **Input-Felder**

```css
.input {
  border: 1px solid var(--color-wood);
  background: var(--color-white);
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 16px;
  width: 100%;
}

.input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(0, 120, 75, 0.2);
}
```

---

## 📱 LOGIN-SEITE DESIGN

```
┌─────────────────────────────┐
│                             │
│        🏔️ Bergwacht         │
│       Getränkekasse         │
│                             │
│  ┌───────────────────────┐  │
│  │ Email                 │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ Passwort              │  │
│  └───────────────────────┘  │
│                             │
│  [Anmelden]                 │
│                             │
│  Noch nicht dabei?          │
│  → Registrieren             │
│                             │
└─────────────────────────────┘
```

**Layout:**
- Zentriert auf Screen
- Max-Width 400px
- Padding 24px
- Holz-Rahmen-Card um Form
- Bergwacht-Grün Buttons
- Mobile-First

---

## 🔐 SICHERHEIT

### **Backend:**
- Passwörter mit bcrypt (12 Rounds)
- JWT-Token (7 Tage Expiry)
- JWT-Secret in .env (256-Zeichen-Random-String)
- CORS: Nur localhost:5173 in dev
- Input-Validation (Zod oder Joi)
- SQL-Injection Prevention (Prisma macht das automatisch)

### **Frontend:**
- JWT-Token in localStorage speichern
- Auto-Logout bei 401
- Protected Routes redirect zu /login

---

## 📝 ENVIRONMENT-VARIABLEN

### **backend/.env.example:**
```env
NODE_ENV=development
PORT=3001
DATABASE_URL="file:./dev.db"
JWT_SECRET=geheimer_schluessel_min_256_zeichen_lang_bitte_aendern
BCRYPT_ROUNDS=12
CORS_ORIGIN=http://localhost:5173
```

### **frontend/.env.example:**
```env
VITE_API_URL=http://localhost:3001
```

---

## 📦 ABHÄNGIGKEITEN

### **Frontend (package.json):**
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "framer-motion": "^10.16.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

### **Backend (package.json):**
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.0",
    "@prisma/client": "^5.7.0",
    "dotenv": "^16.3.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "prisma": "^5.7.0",
    "nodemon": "^3.0.0"
  }
}
```

---

## ✅ AKZEPTANZKRITERIEN

- [ ] Frontend läuft auf `http://localhost:5173`
- [ ] Backend läuft auf `http://localhost:3001`
- [ ] Login-Seite wird angezeigt (mit Bergwacht-Design)
- [ ] User kann sich registrieren (POST /auth/register)
- [ ] User kann sich einloggen (POST /auth/login)
- [ ] JWT-Token wird im AuthContext gespeichert
- [ ] Nach Login → Redirect zu /dashboard
- [ ] /dashboard ist Protected (nur eingeloggt)
- [ ] /admin ist Protected (nur isAdmin=true)
- [ ] GET /auth/me funktioniert
- [ ] Logout funktioniert (Token wird gelöscht)
- [ ] Prisma-Migration läuft (`npx prisma migrate dev`)
- [ ] Keine Fehler in Browser-Console
- [ ] Keine Fehler in Backend-Logs
- [ ] Code ist strukturiert & lesbar

---

## 🚀 STARTBEFEHLE

### **Frontend starten:**
```bash
cd /Users/laura/claude-sandbox/projects/getraenke/frontend
npm install
npm run dev
# Läuft auf http://localhost:5173
```

### **Backend starten:**
```bash
cd /Users/laura/claude-sandbox/projects/getraenke/backend
npm install
npx prisma migrate dev --name init
npm run dev
# Läuft auf http://localhost:3001
```

---

## 📋 BERICHT NACH FERTIGSTELLUNG

Lege einen Bericht in `/BERICHTE/01-grundgeruest.md` ab:

```markdown
# Bericht: Grundgerüst Frontend + Backend

**Datum:** YYYY-MM-DD
**Phase:** 1 (Grundgerüst)

## ✅ Erledigt
- [Liste was funktioniert]

## ⚠️ Probleme / Nicht erledigt
- [Falls etwas nicht klappte]

## 🎯 Eigene Entscheidungen
- [z.B. SQLite statt PostgreSQL gewählt]

## ❓ Offene Fragen
- [Falls etwas unklar ist]

## 🚀 Nächster Schritt
- Phase 2: Getränk-Kauf + Guthaben-System implementieren
```

---

## 🎯 EIGENSTÄNDIGKEIT

**Du darfst selbst entscheiden:**
- ✅ Konkrete Komponenten-Struktur
- ✅ UI-Layout Details (solange Bergwacht-Farben/Style)
- ✅ HTTP-Client (Axios vs Fetch)
- ✅ Validation-Library (Zod vs Joi)

**Bitte rückfragen bei:**
- ❓ Architektur-Änderungen
- ❓ Datenmodell-Anpassungen
- ❓ Falls etwas im Brief unklar ist

---

## 🎨 WICHTIGE DESIGN-PRINZIPIEN

- **Rustikal, NICHT modern** – Bergwacht-Kneipentheke Vibe
- **Mobile-First** – Optimiert für 375px (iPhone SE)
- **Holz-Rahmen** – Karten haben braunen Border
- **Touch-Targets** – Buttons min. 44px hoch
- **Sound + Animation kommen in Phase 2-3** – Hier erst Grundgerüst!

---

## 💡 WICHTIGE NOTIZEN

1. **`guthaben` darf negativ sein** – KEINE CHECK-Constraint!
2. **`guthaben` als Int in Cent** (nicht Decimal) — konsistent zu `preisAtKauf` aus Phase 2 (KONFIGURATION.md Update 4)
3. ~~`isOptInRanking`~~ — **gestrichen** in KONFIGURATION.md Update 1 (kein Leaderboard mehr)
4. **bcrypt** für Passwörter (mindestens 12 Rounds) — alternativ argon2, falls `01-grundgeruest.md` gefahren wird
5. **JWT-Secret** muss in .env stehen (NIEMALS hardcoded!)
6. **CORS** nur für localhost:5173 in dev
7. **Prisma** kümmert sich um Migrations
8. **Kategorie-Enum** (für Phase 2 bereits jetzt mitdenken): `alkoholfrei`, `alkoholisch`, `sonstiges` — KEIN „heissgetraenk"

---

## 🚀 LOS GEHT'S!

Erstelle bitte:
1. ✅ Komplettes Frontend-Setup (React + Vite + TailwindCSS)
2. ✅ Komplettes Backend-Setup (Node + Express + Prisma)
3. ✅ Login/Registrierung End-to-End funktionsfähig
4. ✅ Auth-Context im Frontend
5. ✅ Protected Routes
6. ✅ Design-System mit Bergwacht-Farben

**Bei Fragen: Frag direkt!**

**Nach Fertigstellung: Bericht in `/BERICHTE/01-grundgeruest.md` ablegen.**

Viel Erfolg! 🏔️💻
