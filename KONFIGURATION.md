# Konfiguration — Bergwacht Getränkekasse

**Stand:** 26.05.2026 (Update 5: Klärungs-Konsolidierung nach Phase-1-Smoke-Test)
**Status:** 🟢 Phase B1 abgeschlossen + verifiziert, Phase B2 vorbereitet

---

## 1. Zweck

Web-App zur Digitalisierung der Bergwacht-Zollernalb-Getränkekasse. Ersetzt die analoge Bar-Kasse + Strichliste. Mitglieder loggen sich ein, sehen ihr Guthaben, buchen Getränke aus dem Katalog ab. Aufladung läuft über PayPal (paypal.me-Link, manuell vom Verwalter bestätigt) oder Bargeld (Verwalter trägt manuell ein). Negatives Guthaben ist erlaubt.

**Größenordnung:** ca. 30 Mitglieder. Eine Verwalterin (Laura Sauer).

---

## 2. Stack

| Bereich | Entscheidung |
|---|---|
| Frontend | React 18 + Vite + TypeScript + TailwindCSS |
| Backend | Node.js 20+ + Express + TypeScript + Prisma ORM |
| Datenbank | SQLite (Dev + Phasen B1-B7) → PostgreSQL (ab Phase B8 Deploy) |
| Auth | Magic-Link-Invite + Passwort (argon2) + JWT in Cookies |
| Email | Dev: Konsolen-Output · Prod: TBD (z.B. Resend) |
| PWA | ab Phase B6 |
| Hosting Phase 1-7 | Lokal in Docker-Sandbox auf Mac Mini |
| Hosting ab Phase 8 | Hetzner CX22 dediziert |

---

## 3. Identitäten

| Rolle | Person | Email |
|---|---|---|
| Admin / Getränkeverwalter | Laura Sauer | laura_sauer@gmx.de |

**Domain:** `getraenke.einfall.app` (Subdomain von `einfall.app`, anzulegen vor Phase B8)

**PayPal-Adresse Verwalter:** paypal.me-Link (TBD — vor Phase B2f anlegen)

---

## 4. Rollen & Berechtigungen

Zwei Rollen, gesteuert über `User.isAdmin`:

### Mitglied kann
- Login via Magic-Link (Initial-Setup) und danach via Email + Passwort
- Eigenes Guthaben sehen
- Getränk aus aktiven Katalog-Einträgen buchen → Confirm → Guthaben-Reduktion
- Eigene Buchung innerhalb **5 Minuten** stornieren
- PayPal-Aufladungs-Anfrage stellen (paypal.me-Link wird geöffnet)
- Privates Trinkjournal mit Achievements und 30-Tage-Verlauf sehen
- Eigene Transaktions-Historie sehen
- Eigene Daten exportieren (DSGVO, Phase B7)
- Eigenes Konto soft-deleten (DSGVO, Phase B7)

### Verwalter (Admin) kann
Alles vom Mitglied (auch selbst Getränke buchen) plus:
- Neue Mitglieder einladen (Magic-Link via Email)
- Bargeld-Aufladung manuell eintragen (User-X bekommt +Y€, Pflicht-Notiz „Bar aufgeladen")
- PayPal-Anfragen bestätigen oder ablehnen (mit optionaler Notiz)
- Drink-Katalog pflegen (anlegen, Preis ändern, Icon/Kategorie ändern, soft-disablen)
- Übersicht aller Mitglieder mit aktuellem Saldo sehen
- Guthaben eines Mitglieds manuell korrigieren (mit Pflicht-Notiz)
- Jede Transaktion (auch Aufladungen, auch alte Buchungen) jederzeit stornieren (mit Pflicht-Notiz)
- App-weite Sortenstatistik für Einkaufsplanung sehen

---

## 5. Datenmodell

Fünf Entitäten. Beträge **immer in Cent als `Int`**, niemals als `Float`.

### 5.1 User

| Feld | Typ | Notiz |
|---|---|---|
| `id` | String (cuid) | Prisma-Default |
| `email` | String, unique | Login-Identifier |
| `firstName` | String | Pflicht |
| `lastName` | String | Pflicht |
| `passwordHash` | String, nullable | argon2-Hash, null bis Magic-Link eingelöst |
| `isAdmin` | Boolean, default false | Admin-Flag |
| `deletedAt` | DateTime, nullable | Soft-Delete-Marker |
| `createdAt` / `updatedAt` | DateTime | Standard-Audit |

**Kein gespeichertes `guthabenCent`-Feld.** Guthaben wird live aus Transaktionen summiert (siehe Sektion 6).

### 5.2 Drink

| Feld | Typ | Notiz |
|---|---|---|
| `id` | String (cuid) | |
| `name` | String | Anzeige-Name („Helles", „Cola", „Kaffee" — wobei Kaffee unter `sonstiges` läuft) |
| `preisCent` | Int | Aktueller Verkaufspreis |
| `icon` | String | Emoji-String („🍺", „🥤", „☕") |
| `kategorie` | Enum | `alkoholfrei`, `alkoholisch`, `sonstiges` (fest, kein CRUD) |
| `isActive` | Boolean, default true | Soft-Disable statt Hard-Delete |
| `createdAt` / `updatedAt` | DateTime | |

### 5.3 Transaktion

Jede Bewegung am Guthaben (Buchung, Aufladung, Korrektur, Storno) ist eine Transaktion. **Niemals löschen** — Audit-Trail.

| Feld | Typ | Notiz |
|---|---|---|
| `id` | String (cuid) | |
| `userId` | String, FK → User | |
| `typ` | Enum | `KAUF`, `AUFLADUNG_PAYPAL`, `AUFLADUNG_BARGELD`, `KORREKTUR`, `STORNO` |
| `betragCent` | Int | Positiv bei Aufladung/positiver Korrektur, negativ bei Kauf. Storno kopiert Original-Betrag mit umgekehrtem Vorzeichen. |
| `drinkId` | String, FK → Drink, nullable | Nur bei `KAUF` gesetzt |
| `preisAtKaufCent` | Int, nullable | Eingefroren bei `KAUF` — Preisänderungen am Drink ändern niemals Historie |
| `stornoVonId` | String, FK → Transaktion, nullable | Bei `typ=STORNO`: Verweis auf Original-Transaktion |
| `notiz` | String, nullable | Pflicht bei `KORREKTUR`, `AUFLADUNG_BARGELD`, `STORNO` (Admin-Aktionen) |
| `erstelltVonId` | String, FK → User | Wer hat es ausgelöst (User selbst oder Admin) |
| `createdAt` | DateTime | |

### 5.4 Invite

Magic-Link-Token für neue Mitglieder.

| Feld | Typ | Notiz |
|---|---|---|
| `id` | String (cuid) | |
| `email` | String | Wer eingeladen wurde |
| `firstName` | String | |
| `lastName` | String | |
| `isAdmin` | Boolean, default false | Falls Verwalter weiteren Admin anlegen will |
| `tokenHash` | String | SHA-256 des Tokens (Klartext nur einmalig im Email-Link) |
| `expiresAt` | DateTime | 7 Tage nach Erstellung |
| `redeemedAt` | DateTime, nullable | Wann eingelöst |
| `erstelltVonId` | String, FK → User | Welcher Admin hat ausgestellt |
| `createdAt` | DateTime | |

**Hinweis:** Code aus Phase B1 nennt diese Entität `InviteToken`. Wird in B2a auf `Invite` umbenannt (Naming-Drift-Bereinigung).

### 5.5 AufladungsAnfrage

PayPal-Aufladungs-Anfrage mit State-Machine.

| Feld | Typ | Notiz |
|---|---|---|
| `id` | String (cuid) | |
| `userId` | String, FK → User | Wer hat gestellt |
| `betragCent` | Int | Gewünschter Aufladungs-Betrag |
| `status` | Enum | `OFFEN`, `BESTAETIGT`, `ABGELEHNT` |
| `requestedAt` | DateTime | Wann gestellt |
| `decidedAt` | DateTime, nullable | Wann entschieden |
| `decidedById` | String, FK → User, nullable | Welcher Admin hat entschieden |
| `adminNotiz` | String, nullable | Optional („Geld noch nicht angekommen, später nochmal") |
| `transaktionId` | String, FK → Transaktion, nullable | Bei `BESTAETIGT`: Verweis auf erzeugte Aufladungs-Transaktion |

### 5.6 Relationen-Übersicht

```
User 1 ──n Transaktion (userId)
User 1 ──n Transaktion (erstelltVonId)
User 1 ──n AufladungsAnfrage (userId)
User 1 ──n AufladungsAnfrage (decidedById)
User 1 ──n Invite (erstelltVonId)
Drink 1 ──n Transaktion (drinkId, optional)
Transaktion 1 ──1 Transaktion (stornoVonId, optional, reflexiv)
AufladungsAnfrage 1 ──1 Transaktion (transaktionId, optional)
```

---

## 6. Geschäftslogik

### 6.1 Guthaben-Berechnung

Guthaben eines Users = `SUM(transaktionen.betragCent) WHERE userId = X` (alle Typen, alle nicht-soft-deleted Transaktionen).

- Kein redundantes Feld auf User
- Bei jeder Anzeige neu berechnet (auf 30 Mitglieder × wenige Tausend Transaktionen über Jahre völlig unproblematisch in SQLite)
- „Cannot be wrong by design"
- Falls Performance je problematisch: Cache-Feld nachrüstbar, aber bis dahin nicht

### 6.2 Buchen-Flow

1. Mitglied wählt Drink aus aktivem Katalog (gruppiert nach Kategorie)
2. Confirm-Sheet zeigt: Drink-Name, Icon, Preis, neues Guthaben (rote Anzeige falls negativ)
3. Bestätigung → neue Transaktion: `typ=KAUF`, `drinkId=X`, `preisAtKaufCent=Drink.preisCent`, `betragCent=-Drink.preisCent`, `erstelltVonId=User.id`
4. Guthaben sofort aktualisiert sichtbar
5. Visuelle Markierung der Buchung im Verlauf als „storno-fähig" für 5 Minuten

### 6.3 Storno-Flow

**5-Min-Fenster für Mitglieder:**
- Eigene `KAUF`-Transaktion, innerhalb 5 Min nach `createdAt`
- Erzeugt neue Transaktion: `typ=STORNO`, `stornoVonId=Original.id`, `betragCent=-Original.betragCent`, `erstelltVonId=User.id`
- Stornofenster ist **fix im Code** als Konstante (`STORNO_FENSTER_MINUTEN = 5`), kein UI-Setting

**Jederzeit für Admin:**
- Jede Transaktion (auch Aufladungen, auch alte) stornierbar
- Pflicht-Notiz erforderlich
- `erstelltVonId=Admin.id`, `notiz=...`

**Nicht stornierbar:** Storno-Transaktionen selbst (verhindert Storno-Loops).

### 6.4 Aufladung — Bargeld

1. Verwalter geht in Admin → Mitglied X
2. „Bargeld-Aufladung" eintragen: Betrag + Pflicht-Notiz „Bar aufgeladen"
3. Erzeugt Transaktion: `typ=AUFLADUNG_BARGELD`, `betragCent=+X`, `notiz=...`, `erstelltVonId=Admin.id`
4. Mitglied sieht Aufladung im Verlauf

### 6.5 Aufladung — PayPal

1. Mitglied klickt im Aufladen-Tab auf Betrag-Button (z.B. 5€, 10€, 20€, 50€ oder „Anderer Betrag")
2. App öffnet `https://paypal.me/{verwalter-link}/{betrag}` in neuem Tab/PayPal-App
3. Parallel erstellt App eine `AufladungsAnfrage` mit `status=OFFEN`
4. Mitglied überweist via PayPal
5. Verwalter sieht Eingang in PayPal, geht in Admin → Aufladungs-Anfragen
6. **Bestätigen:** Erzeugt Transaktion `typ=AUFLADUNG_PAYPAL`, verknüpft `AufladungsAnfrage.transaktionId`, setzt `status=BESTAETIGT`
7. **Ablehnen:** Status `ABGELEHNT`, optional Admin-Notiz. Keine Transaktion erzeugt.

### 6.6 Negatives Guthaben

- **Erlaubt, unbegrenzt** — keine Untergrenze
- Visuell rot markiert im Dashboard (Mitglied) und Mitglieder-Übersicht (Admin)
- **Kein Audio-Warning** (frühere Idee aus Update 4 verworfen)
- **Kein Hard-Stop** beim Buchen — soziale Kontrolle reicht
- Confirm-Sheet zeigt warnend „Du gehst auf -X,XX € — trotzdem buchen?" wenn Buchung ins Minus führt

### 6.7 Account-Lifecycle

**Erstellen:** Admin lädt via Magic-Link ein (Email, Vorname, Nachname). User klickt Link, setzt Passwort, ist drin.

**Soft-Delete (Mitglied tritt aus):**
- `User.deletedAt = now()`
- Mitglied kann sich nicht mehr einloggen
- **Alle zugehörigen Transaktionen werden mitgelöscht** (Cascade oder explizit) — keine Statistik-Erhaltung
- Restguthaben wird **außerhalb der App** geklärt (Bar / Überweisung)
- Hard-Delete nach 30 Tagen Gnadenfrist (Phase B7)

**Keine Gast-Konten.**

---

## 7. UI/UX

### 7.1 Bottom-Nav (Mitglied)

| Tab | Inhalt |
|---|---|
| 🏠 Theke | Dashboard: Guthaben groß, Quick-Buchung-CTA (führt zum Buchen-Tab) |
| 🍺 Buchen | Auswahl-Screen: alle aktiven Getränke nach Kategorie gruppiert, Tap → Confirm-Sheet |
| 💳 Aufladen | PayPal-Beträge + paypal.me-Trigger, Bargeld-Hinweis-Card |
| 🕒 Verlauf | Transaktions-Historie + Trinkjournal + Achievements |

Admin-Bereich via Profil-Drawer (Avatar-Tap im Header).

### 7.2 Admin-Bereich (Drawer-Menü)

- 👥 Mitglieder (Liste mit Salden, Detail-Ansicht, Korrekturen)
- ✉️ Mitglied einladen
- 🍺 Drink-Katalog
- 💳 Aufladungs-Anfragen
- 📊 Sortenstatistik

### 7.3 Trinkjournal & Achievements

**Stilbezeichnung:** „Eigenes Trinkjournal" — privat, nur User selbst sieht es.

**Hero:** Monatszahl in Fraunces („42 Getränke diesen Monat"), Amber-Glow-Card.

**Stat-Strip (3 Cards):**
- Diese Woche (Anzahl Buchungen)
- Streak (Tage in Folge mit mindestens einer Buchung)
- Längste Pause (Tage ohne Buchung — neutral formuliert, kein Wertungs-Coach)

**30-Tage-Verlauf:** Balkendiagramm, Wochenenden in Amber-Deep, Wochentage in Amber-Light. Tap auf Balken → Buchungen dieses Tages.

**Achievements (privat, locker, niemals wertend):**
- 🏔️ Erstbesteigung — Erstes Getränk gebucht
- 🌧️ Trockenwoche — 7 Tage in Folge keine Buchung
- ⛺ Hüttenabend — 3 Getränke an einem Tag
- 🎒 Tourenrucksack — 20 Getränke im Monat
- 🪙 Hamster — Guthaben zum ersten Mal über 50 € aufgeladen
- 🎖️ Stammgast — 100 Buchungen gesamt
- 🧗 Seilschaft — erste Runde ausgegeben (Future-Feature, B4+)

### 7.4 Sortenstatistik (Admin)

App-weit aggregiert, anonym. Zweck: Einkaufsplanung.

- Zeitfilter: Woche / Monat / Quartal
- Pro Drink: Anzahl Buchungen + Gesamt-Umsatz im Zeitraum
- **Keine** Zuordnung zu einzelnen Mitgliedern
- **Keine** Top-Konsumenten-Listen

---

## 8. Design-System (aus Design-Pack v2)

**Tokens:** `--bwza-*` Namespace, OKLCH-Farben
**Fonts:** Fraunces (Display), Inter (UI), JetBrains Mono (Code)
**Stil:** Dunkle Berghütten-Bar, Glass-Komponenten, Amber-Akzente
**Source of Truth:** `design/README_DESIGN.md` + `design/design-tokens.css`

**Primitives** (teils in Phase B1 angelegt, Rest in B5):
Glass, ShineEdge, BergMark, Avatar, TopBar, BottomNav, GlassButton, GlassInput, PasswordInput, StatCard, Flash, EmptyState, Skeleton, DrinkPicker (B2b), DrinkConfirm (B2c), DrinkCatalogRow (B2b), ProfileDrawer, AdminBanner, AufladungsAnfrageRow (B2f), MitgliederSaldoRow (B2g).

---

## 9. DSGVO

### Mindestpaket (vor Live-Gang — Phase B7)
- Datenschutzerklärung auf Login-Seite
- „Meine Daten exportieren" (JSON-Download)
- „Account löschen" (Soft-Delete mit 30-Tage-Frist, dann Hard-Delete)
- AVV mit Hosting-Provider (ab Hetzner)
- Verarbeitungsverzeichnis als Markdown im Repo

### Position zu Sortendaten

Wir tracken **keine persönlichen Trinkpräferenzen pro User** — das individuelle Trinkjournal ist sortenagnostisch (nur Anzahl und Beträge). Sortenstatistiken werden ausschließlich **App-weit aggregiert** für Einkaufsplanung erhoben und enthalten keinen User-Bezug.

Auf Transaktions-Ebene ist die Sortenzuordnung (`drinkId`) technisch notwendig für: Historie, Stornos, Preisnachweis.

### Datenexport-Regel

Im DSGVO-Export eines Users:
- ✅ Eigene Buchungen inklusive `drinkId` / Drink-Name (Transparenz gegenüber Betroffenem)
- ❌ Aggregierte App-Statistiken anderer User (nicht mitexportiert)
- ❌ Soft-deleted alte Transaktionen anderer User (gehören nicht zu seinem Datensatz)

---

## 10. Phasen-Roadmap

Phase B1 ist abgeschlossen (Auth-Grundgerüst gebaut + Smoke-Test bestanden). Ab B2 wird in feineren Sub-Phasen gearbeitet.

| Phase | Inhalt | Dauer | Status |
|---|---|---|---|
| **B1** | Grundgerüst (Auth + Magic-Link + Admin-Bootstrap via Seed) | 3-4 Tage | ✅ abgeschlossen 25.05.2026 |
| **B2a** | Mitglieder-Invite-UI (Admin) | 0.5-1 Tag | offen |
| **B2b** | Drink-Katalog (Modell + Admin-CRUD) + Naming-Drift-Bereinigung (`Invite`, `preisAtKaufCent`) | 1-2 Tage | offen |
| **B2c** | Buchen-Flow + Live-Guthaben | 2 Tage | offen |
| **B2d** | Storno-Flow (5-Min User, jederzeit Admin) | 1 Tag | offen |
| **B2e** | Bargeld-Aufladung (Admin) | 0.5-1 Tag | offen |
| **B2f** | PayPal-Aufladungs-Anfragen (User + Admin) | 1-2 Tage | offen |
| **B2g** | Mitglieder-Übersicht + manuelle Guthaben-Korrektur | 1 Tag | offen |
| **B3** | Sortenstatistik (Admin) | 1 Tag | offen |
| **B4** | Trinkjournal + Achievements + 30-Tage-Verlauf | 2-3 Tage | offen |
| **B5** | Design-Politur (Dark-Bar überall durchziehen) | 1-2 Tage | offen |
| **B6** | PWA + Letzter Schliff (Home-Screen-Icon, Offline-Hinweis) | 2-3 Tage | offen |
| **B7** | DSGVO (DSE, Export, Soft-Delete-Flow, Hard-Delete-Job) | 2-3 Tage | offen |
| **B8** | Deploy Hetzner (SQLite → Postgres, Subdomain, AVV) + Testphase | 5-7 Tage | offen |
| **B9** | Go-Live | 1 Tag | offen |
| **Gesamt** | | **~5-7 Wochen** | |

**Begründungen zur Reihenfolge:**
- **B2a vorne:** Invite-UI vor allem anderen, damit du beim Testen echte Mitglieder anlegen kannst ohne curl-Akrobatik
- **B3 vor B4:** Sortenstatistik ist Verwalter-MVP (du brauchst sie für Einkauf), Trinkjournal ist Mitglied-Bonus
- **B5 als eigene Polier-Phase:** Erst alle Screens funktional, dann gemeinsam stilistisch durchziehen — verhindert dass Komponenten dreimal überarbeitet werden

---

## 11. Verbotenes / explizit aus dem Scope

- Kein Self-Signup für Mitglieder
- Kein Leaderboard, kein „Bierkönig", kein öffentlicher Vergleich
- Kein Lieblings-Drink-Tracking pro User (Trinkjournal bleibt sortenagnostisch)
- Keine User-definierten Drink-Kategorien (3 feste: alkoholfrei, alkoholisch, sonstiges)
- Kein Audio-Warning bei negativem Guthaben
- Keine PayPal-API-Integration (nur paypal.me-Link)
- Keine Gast-Konten
- Keine Storno-Stornos (verhindert Loops)
- Keine Aufbewahrung gelöschter User-Transaktionen für Statistik

---

## 12. Bekannte Inkonsistenzen aus Phase B1 (zu beheben in B2b)

Code von Phase B1 weicht in zwei Punkten von dieser Spec ab:

| Code (B1) | Diese Spec | Bereinigung in |
|---|---|---|
| `User.guthaben` (Int-Feld) | kein Feld, live summiert aus Transaktionen | B2c (Buchen-Flow, dann ist Live-Summen-Logik eh fällig) |
| `InviteToken` (Modell-Name) | `Invite` | B2b |
| Keine Transaktions-Modelle | `Transaktion`, `AufladungsAnfrage` | B2b/B2c/B2f |

Außerdem: Form-Field-IDs auf Login-Page fehlen (DevTools-Warning beim Smoke-Test) → B5 Politur.

---

## 13. Änderungshistorie (kompakt)

**Update 5 (26.05.2026):** Klärungs-Konsolidierung nach Phase-1-Smoke-Test
- Komplette Neufassung nach 5 Klärungs-Schichten (Zweck, Rollen, Datenmodell, Roadmap, Designfragen)
- **Neu im Datenmodell:** `AufladungsAnfrage` als eigene Entität, `Transaktion.stornoVonId` für Audit-Trail, Live-Summieren statt gespeichertem `guthabenCent`-Feld
- **Neu in Logik:** 5-Min-Stornofenster für Mitglieder, jederzeitiges Storno für Admin mit Pflicht-Notiz
- **Neu in Aufladung:** PayPal-Aufladung via paypal.me-Link (Variante B), Bargeld-Eintrag durch Admin
- **Verworfen:** Audio-Warning bei negativem Guthaben (war Update 4)
- **Neue Roadmap:** B2 zerlegt in B2a-g (7 Sub-Phasen), B3 (Sortenstatistik) vor B4 (Trinkjournal), eigene Design-Polier-Phase B5

**Update 4 (21.05.2026):** Flexibler Getränkekatalog + DSGVO-Reformulierung
- Single-Drink-Modell aus Update 3 zurückgenommen — Admin pflegt CRUD-Katalog
- Feste Kategorien, `isActive` statt Hard-Delete, `preisAtKauf` eingefroren
- DSGVO-Statement umformuliert

**Update 3 (20.05.2026, verworfen durch Update 4):**
- Versuch: ein einzelnes Getränk zu 1,50 € statt Katalog
- Hat sich als zu eng erwiesen, von Update 4 rückgängig gemacht

**Update 2 (20.05.2026):** Design-Integration
- Farbpalette Dark-Bar statt Warm-Creme
- Fraunces statt Merriweather
- Glass-Primitives definiert

**Update 1 (20.05.2026):** Architektur final
- SQLite statt PostgreSQL für Dev
- Leaderboard / Bierkönig gestrichen
- Onboarding: Admin-Invite via Magic-Link
- Hosting: erst lokal, später Hetzner
