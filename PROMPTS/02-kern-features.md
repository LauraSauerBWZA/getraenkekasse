# Prompt 02 — Kern-Features & Design-Integration

**Projekt:** Bergwacht Getränkekasse
**Projektordner:** `/Users/laura/claude-sandbox/projects/getraenke/`
**Zielordner für App-Code:** `/Users/laura/claude-sandbox/projects/getraenke/app/`
**Voraussetzung:** Prompt 01 erfolgreich abgeschlossen (Grundgerüst, Auth, Magic-Link, JWT)
**Bericht ablegen unter:** `/Users/laura/claude-sandbox/projects/getraenke/BERICHTE/02-kern-features.md`

---

## Auftrag

Drei Sachen gleichzeitig, in dieser Reihenfolge:

1. **Design-Pack v2** in die App integrieren (Tokens, Komponenten, Screens als TSX-Skelett)
2. **Kern-Features** implementieren (Buchung, Aufladung, Admin-Panel)
3. **Tests** für die Business-Logik

---

## Kontext

`KONFIGURATION.md` im Projektordner ist die Quelle der Wahrheit. **Bitte vor Start einmal komplett lesen**, besonders Update 3 ist neu gegenüber Prompt 01.

Wichtigste Änderungen seit Prompt 01:
- **Keine Getränke-Liste** mehr — ein einzelnes "Getränk" zu 1,50 € (150 Cent)
- **Bargeld-Aufladung** läuft nur mündlich → Admin trägt manuell ein
- **PayPal-Aufladung** läuft als Anfrage → Admin bestätigt
- **Statistik** ist privates "Trinkjournal" mit Achievements

Design-Pack v2 liegt unter `/Users/laura/claude-sandbox/projects/getraenke/design/` (Laura legt's dorthin vor dem Code-Start).

---

## Teil A: Design-Integration

### A.1 Tokens

- `design/design-tokens.css` kopieren nach `app/frontend/src/styles/design-tokens.css`
- In `app/frontend/src/main.tsx` einmalig importieren
- Google Fonts (Fraunces, Inter, JetBrains Mono) in `app/frontend/index.html` einbinden — siehe `design/index.html` als Referenz
- Tailwind-Config erweitern: Tokens als Tailwind-Theme-Extension mappen, damit man `bg-bwza-glass` etc. schreiben kann. Falls das zu fummelig wird, lass es weg und nutze CSS-Variablen direkt — wir verlangen kein perfektes Tailwind-Mapping, der Stil muss nur stimmen.

### A.2 Komponenten-Aufsplittung

`design/components.jsx` enthält 15+ Komponenten in einer Datei. Bitte aufsplitten nach diesem Schema:

```
app/frontend/src/components/
├── primitives/
│   ├── Glass.tsx
│   ├── ShineEdge.tsx
│   ├── BergMark.tsx
│   ├── Avatar.tsx
│   ├── GlassButton.tsx
│   ├── GlassInput.tsx
│   ├── PasswordInput.tsx
│   ├── StatCard.tsx
│   ├── Skeleton.tsx
│   └── EmptyState.tsx
├── layout/
│   ├── TopBar.tsx
│   ├── BottomNav.tsx
│   └── AdminBanner.tsx
└── overlays/
    ├── DrinkConfirm.tsx
    ├── ProfileDrawer.tsx
    └── Flash.tsx
```

Beim Port nach TSX:
- **Props typisieren** mit interfaces, kein `any`
- **Inline-Styles** beibehalten (kein Tailwind-Rewrite!) — der Designer hat sie mit CSS-Variablen referenziert, das funktioniert. Spätere Cleanup-Iteration kann das umbauen. **Pragmatik vor Perfektion.**
- **Sound-Marker** als Code-Kommentar einfügen: `// SOUND: glass-clink` an den entsprechenden Stellen (siehe README im Design-Pack)
- Komponenten **default-exporten**, damit Imports einheitlich sind

### A.3 Screens als Skelett

`design/screens-user.jsx` und `design/screens-admin.jsx` in einzelne TSX-Files unter `app/frontend/src/routes/` aufsplitten:

```
app/frontend/src/routes/
├── auth/
│   ├── Login.tsx
│   ├── SetPassword.tsx
│   └── ForgotPassword.tsx
├── app/
│   ├── Home.tsx
│   ├── Buchen.tsx
│   ├── Aufladen.tsx
│   └── Statistik.tsx
└── admin/
    ├── Members.tsx
    ├── Invite.tsx
    ├── Requests.tsx
    ├── Log.tsx
    └── Adjust.tsx
```

**Wichtig:** Bei diesem Schritt müssen Inhalts-Anpassungen aus Update 3 mit:
- `Home.tsx`: **keine** 6 Quick-Drinks mehr, sondern **ein** großer "Getränk buchen — 1,50 €" Button
- `Buchen.tsx`: **kein** 8-Tile-Grid mehr, sondern Vollbild-CTA + Confirm-Sheet
- `Aufladen.tsx`: Methoden-Toggle **entfernen**, nur PayPal-Flow zeigen. Stattdessen Hinweis-Card oben:
  > "Du willst bar aufladen? Sprich deinen Getränkeverwalter direkt an, er trägt die Aufladung dann hier ein."
- `Statistik.tsx`: **Lieblings­getränk** entfernen, Achievement-Strip mit den 7 Achievements aus Konfig

### A.4 Router

`app/frontend/src/App.tsx` als Router-Hub mit React Router v6. Routes:
- `/login`, `/set-password`, `/forgot-password` → öffentlich
- `/`, `/buchen`, `/aufladen`, `/statistik` → User-Auth required
- `/admin/members`, `/admin/invite`, `/admin/requests`, `/admin/log`, `/admin/adjust/:userId` → Admin-Auth required

ProtectedRoute-Wrapper bauen, der `/auth/me` ruft und bei 401 zu `/login` redirected.

---

## Teil B: Kern-Features (Backend + Frontend)

### B.1 DB-Schema-Erweiterung

In `app/backend/prisma/schema.prisma` zwei neue Modelle hinzu:

```prisma
model Transaktion {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  typ             String   // 'kauf' | 'aufladung_paypal' | 'aufladung_bar' | 'anpassung'
  amount          Int      // in Cent, signed (Kauf negativ, Aufladung positiv)
  notiz           String?
  createdAt       DateTime @default(now())
  createdByUserId String?  // bei admin-anpassungen: wer hat's eingetragen
  createdBy       User?    @relation("CreatedTransactions", fields: [createdByUserId], references: [id])

  @@index([userId, createdAt])
  @@index([typ])
}

model AufladungsAnfrage {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  amount      Int       // Cent
  status      String    // 'pending' | 'bestaetigt' | 'abgelehnt'
  notiz       String?
  createdAt   DateTime  @default(now())
  resolvedAt  DateTime?
  resolvedByUserId String?
  resolvedBy  User?     @relation("ResolvedRequests", fields: [resolvedByUserId], references: [id])

  @@index([userId, createdAt])
  @@index([status])
}
```

In `User`-Modell die Inversen ergänzen:
```prisma
transaktionen        Transaktion[]
createdTransaktionen Transaktion[]         @relation("CreatedTransactions")
aufladungsAnfragen   AufladungsAnfrage[]
resolvedAnfragen     AufladungsAnfrage[]   @relation("ResolvedRequests")
```

**Wichtig:**
- `amount` immer in **Cent**, immer **signed Integer**
- Bei `typ='kauf'` ist `amount` negativ (z. B. -150)
- Bei Aufladungen positiv

Migration mit `prisma migrate dev --name kern-features`.

### B.2 Konfig-Konstante (Preis)

In `app/backend/src/config.ts`:
```ts
export const PREIS_GETRAENK_CENT = 150; // 1,50 €
```

Im Frontend separat denken: API-Endpoint `GET /config/public` liefert `{ preisGetraenkCent: 150 }` (öffentlich, kein Auth nötig, damit auch Login-Screen es zeigen kann).

Begründung: Wenn Laura später den Preis erhöht (z. B. 2,00 €), reicht ein Backend-Restart, kein Frontend-Build.

### B.3 Buchung-Endpoint

`POST /api/buchung` — User-Auth required
- Body: `{ confirmNegative?: boolean }`
- Server berechnet: `neuesGuthaben = user.guthaben - PREIS_GETRAENK_CENT`
- Wenn `neuesGuthaben < 0` UND `confirmNegative !== true` → `409 Conflict` mit Payload `{ requiresConfirmation: true, neuesGuthaben }`
- Sonst: Transaktion atomic in DB anlegen, User-Guthaben updaten, neuen User-Stand zurückgeben

**Atomicität:** `prisma.$transaction([])` nutzen, damit User-Update und Transaktion-Insert zusammen committen.

### B.4 Aufladungs-Anfrage-Endpoint (User)

`POST /api/aufladung/anfrage` — User-Auth required
- Body: `{ amount: number, notiz?: string }` (amount in Cent, positive Integer)
- Validierung: `amount > 0`, `amount <= 50000` (max 500 € pro Anfrage, gegen Tippfehler)
- Erzeugt `AufladungsAnfrage` mit `status='pending'`
- Gibt die Anfrage zurück

`GET /api/aufladung/meine-anfragen` — User-Auth required
- Listet eigene Anfragen, neueste zuerst, max 20

### B.5 Admin-Endpoints

`POST /api/admin/aufladung/bestaetigen` — Admin-Auth required
- Body: `{ anfrageId: string }`
- Setzt Anfrage auf `bestaetigt`, legt Transaktion mit `typ='aufladung_paypal'` an, updated User-Guthaben — alles in `$transaction`
- Wenn schon nicht mehr pending → `409`

`POST /api/admin/aufladung/ablehnen` — Admin-Auth required
- Body: `{ anfrageId: string, notiz?: string }`
- Setzt Anfrage auf `abgelehnt`. **Keine** Transaktion, **kein** Guthaben-Update.

`POST /api/admin/anpassung` — Admin-Auth required
- Body: `{ userId: string, amount: number, notiz: string }` (amount signed, Pflicht-Notiz)
- Typ wird automatisch gesetzt: amount > 0 → `'aufladung_bar'`, amount < 0 → `'anpassung'`. (Begründung: alle positiven manuellen Einträge sind Bar-Aufladungen, alle negativen sind Korrekturen.) Diese Logik im Bericht erwähnen — falls Laura's anders will, einfach im Folge-Prompt anpassen.
- Anlegen mit `createdByUserId` = aktueller Admin
- Atomic mit User-Update

`GET /api/admin/mitglieder` — Admin-Auth required
- Listet alle User mit `{id, firstName, lastName, email, guthaben, isAdmin, isActive}`
- Sortierung: nach `firstName ASC`
- Optional: Query-Param `?search=` für Name/Email-Filter

`GET /api/admin/anfragen?status=pending|bestaetigt|abgelehnt|alle` — Admin-Auth required
- Listet Anfragen mit User-Info eingebettet

`GET /api/admin/transaktionen` — Admin-Auth required
- Query-Params: `typ`, `userId`, `from`, `to`, `limit` (default 50)
- Inklusive User-Info pro Transaktion
- CSV-Export: `GET /api/admin/transaktionen.csv` mit denselben Query-Params

### B.6 User-Endpoints für Statistik

`GET /api/me/stats` — User-Auth required
- Liefert: `{ thisMonth, thisWeek, total, streakDays, longestPause, daysSinceJoined, achievements }`
- `achievements`: Array mit `{key, unlockedAt|null}` — pro Achievement-Key entweder Datum oder null
- Achievement-Berechnung serverseitig, damit nicht jeder Client das neu rechnen muss

`GET /api/me/verlauf?limit=50&before=...` — User-Auth required
- Eigene Transaktionen, neueste zuerst, paginiert

`GET /api/me/balance-history?days=30` — User-Auth required
- Tagesweise aggregiert: `[{date: '2026-05-19', buchungenCount: 3}, ...]` — für das 30-Tage-Balkendiagramm

### B.7 Achievement-Logik

In `app/backend/src/achievements.ts` eine pure Funktion:
```ts
type AchievementKey = 'erstbesteigung' | 'trockenwoche' | 'huettenabend'
                   | 'tourenrucksack' | 'hamster' | 'stammgast' | 'seilschaft';

export function computeAchievements(
  user: User,
  transaktionen: Transaktion[]
): Record<AchievementKey, Date | null>
```

Logik pro Achievement (genau diese Regeln):
- **erstbesteigung**: erstes `typ='kauf'` jemals → `createdAt` dieser Transaktion
- **trockenwoche**: 7 zusammenhängende Tage ohne `typ='kauf'` (gemessen am `createdAt`-Datum) — gibt den letzten Tag der Strecke zurück
- **huettenabend**: 3 oder mehr Käufe an einem Kalendertag — Datum des Tages
- **tourenrucksack**: 20 oder mehr Käufe in einem Kalendermonat — letzter Kalendertag dieses Monats
- **hamster**: erstmals Aufladung mit Einzelbetrag >= 5000 Cent (50 €) — `createdAt`
- **stammgast**: 100 Käufe gesamt — `createdAt` des 100. Kaufs
- **seilschaft**: Runde-ausgeben-Feature gibt's noch nicht → immer `null`. Verbleibt im Schema für später.

Diese Funktion ist **unit-testable**, also bitte Tests schreiben (siehe Teil C).

---

## Teil C: Tests

Mindestens diese Tests in `app/backend/test/`:

### C.1 Buchung-Tests
- Happy Path: User mit ausreichend Guthaben → Kauf reduziert um 150 Cent, Transaktion existiert
- Conflict: User mit Guthaben < 150 → 409 mit `requiresConfirmation: true`
- Confirm-Path: nach 409 mit `confirmNegative: true` → Kauf geht durch, Guthaben wird negativ
- Atomic: simulierter DB-Fehler mid-transaction → kein Teil-Update

### C.2 Aufladung-Tests
- User stellt Anfrage → kommt in DB als pending
- Admin bestätigt → User-Guthaben steigt, Anfrage ist resolved, Transaktion existiert
- Doppelt bestätigen → 409
- Admin lehnt ab → kein Guthaben-Update, Anfrage ist abgelehnt
- Admin macht direkte Bar-Anpassung → Transaktion mit korrekt ermitteltem Typ

### C.3 Achievement-Tests
- Jede der 6 implementierbaren Regeln: einzeln testen mit Mock-Transaktionsdaten
- Kombinations-Test: User mit gemischter Historie → alle erfüllten Achievements korrekt erkannt

Test-Framework: vitest (wie in Prompt 01).

---

## Akzeptanzkriterien

- [ ] `prisma migrate dev` ist sauber gelaufen, Schema in DB sichtbar
- [ ] Frontend kompiliert ohne TypeScript-Fehler
- [ ] Alle 12 Screens sind routebar und zeigen den Design-Stil
- [ ] Buchung im Frontend funktioniert end-to-end (Klick → API → Toast → Guthaben aktualisiert)
- [ ] Negativ-Confirm funktioniert (Modal kommt, Kauf nach Bestätigung durch)
- [ ] Aufladungs-Anfrage end-to-end (User stellt, Admin bestätigt, User sieht neues Guthaben)
- [ ] Bar-Hinweis-Card im Aufladen-Screen sichtbar, kein Bar-Button
- [ ] Admin-Anpassung mit Pflicht-Notiz funktioniert
- [ ] CSV-Export der Transaktionen liefert valide Datei
- [ ] Statistik-Screen zeigt Hero-Zahl, Stat-Strip, Balkendiagramm, Achievements, Verlaufsliste
- [ ] Achievement-Tests sind grün
- [ ] `pnpm test` läuft komplett durch

---

## Was du selbst entscheiden darfst

- Implementierungs­details der Balkendiagramm-Komponente (recharts, chart.js, oder eigenes SVG — was am einfachsten passt)
- React-Router-Konfiguration im Detail
- Form-Library (oder vanilla React-State — gerne vanilla, das ist eine kleine App)
- Reihenfolge der Achievement-Checks intern
- Tailwind-Theme-Mapping oder pure CSS-Variablen (egal, hauptsache es funktioniert)

## Was du zurückfragen musst

- **Achievement-Regel "longestPause"**: ist's nur das letzte zusammenhängende Pausenfenster oder das größte aller Zeiten? Im Bericht klären. Default: **größte aller Zeiten** (interessanter).
- Falls Test-Setup mit in-memory SQLite zickt: kurz beschreiben, wie du's gelöst hast.
- Falls der CSV-Export Performance-Probleme zeigt (sollte er für 30 User nicht, aber falls doch): vermerken.

---

## Erwartete Datei-Outputs

- Komplette App-Erweiterung unter `app/`
- `BERICHTE/02-kern-features.md` nach Schema

---

## Sicherheitshinweise

- Alle Admin-Endpoints prüfen `req.user.isAdmin === true` per Middleware. Nie nur Client-seitig!
- Bei `/api/admin/anpassung`: validieren dass `amount !== 0` (kein Nulleintrag spamt das Log voll)
- Rate-Limit für Aufladungs-Anfragen: max 10 pro User pro Stunde, gegen versehentliches Doppel-Klicken
- SQL-Injection durch Prisma quasi ausgeschlossen — aber bei CSV-Export auf CSV-Injection achten: Werte die mit `=`, `+`, `-`, `@` beginnen mit `'` prefixen

---

## Zeitschätzung

Auf einem schnellen Mac Mini: **6-10 Stunden** für sauberen Durchlauf. Das ist der "fleischige" Prompt, hier kommt viel zusammen. Falls Code in eine Sub-Aufgabe nicht reinkommt (z. B. CSV-Export), darf er das vermerken — wir machen's im Folge-Prompt.

💡 **Reihenfolge-Empfehlung für Code:** Erst Teil B (Backend + DB), dann Teil A (Design-Integration), dann Teil C (Tests). So testen wir API early, das Design ist eh nur Skin.
