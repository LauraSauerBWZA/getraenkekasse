# Konfiguration — Bergwacht Getränkekasse

**Stand:** 26.05.2026 (Update 6: Kassenführung — Bar/PayPal-Konten, Einkauf, Umbuchung)
**Status:** 🟢 Phase B1 abgeschlossen + verifiziert, Phase B2 vorbereitet

---

## 1. Zweck

Web-App zur Digitalisierung der Bergwacht-Zollernalb-Getränkekasse. Ersetzt die analoge Bar-Kasse + Strichliste. Mitglieder loggen sich ein, sehen ihr Guthaben, buchen Getränke aus dem Katalog ab. Aufladung läuft über PayPal (paypal.me-Link, manuell vom Verwalter bestätigt) oder Bargeld (Verwalter trägt manuell ein). Negatives Guthaben ist erlaubt.

**Zusätzlich (Update 6):** Die App führt die Kasse selbst als eigenes Konto — getrennt nach Bar- und PayPal-Bestand. So behält der Verwalter den Überblick, wie viel Geld die Kasse insgesamt hat und ob sie gegenüber den Mitglieder-Guthaben solvent ist.

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
- **Kassenführung (Update 6):** Kassenbestand (Bar + PayPal) sehen, Getränke-Einkauf abrechnen, Geld zwischen Bar und PayPal umbuchen

---

## 5. Datenmodell

Sechs Entitäten. Beträge **immer in Cent als `Int`**, niemals als `Float`.

Es gibt zwei getrennte Buchungs-Ebenen:
- **Mitglieder-Ebene** (`Transaktion`): Guthaben einzelner Mitglieder
- **Kassen-Ebene** (`KassenTransaktion`): Geld der Kasse selbst, getrennt nach Bar/PayPal

Diese Ebenen sind gekoppelt (eine Bargeld-Aufladung eines Mitglieds erzeugt beides), aber buchhalterisch getrennt. Siehe Sektion 6.8 für die genaue Kopplung.

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

**Kein gespeichertes `guthabenCent`-Feld.** Guthaben wird live aus Transaktionen summiert (siehe Sektion 6.1).

### 5.2 Drink

| Feld | Typ | Notiz |
|---|---|---|
| `id` | String (cuid) | |
| `name` | String | Anzeige-Name („Helles", „Cola", „Kaffee") |
| `preisCent` | Int | Aktueller Verkaufspreis |
| `icon` | String | Emoji-String („🍺", „🥤", „☕") |
| `kategorie` | Enum | `alkoholfrei`, `alkoholisch`, `sonstiges` (fest, kein CRUD) |
| `isActive` | Boolean, default true | Soft-Disable statt Hard-Delete |
| `createdAt` / `updatedAt` | DateTime | |

### 5.3 Transaktion (Mitglieder-Ebene)

Jede Bewegung am Guthaben eines Mitglieds (Buchung, Aufladung, Korrektur, Storno). **Niemals löschen** — Audit-Trail.

| Feld | Typ | Notiz |
|---|---|---|
| `id` | String (cuid) | |
| `userId` | String, FK → User | |
| `typ` | Enum | `KAUF`, `AUFLADUNG_PAYPAL`, `AUFLADUNG_BARGELD`, `KORREKTUR`, `STORNO` |
| `betragCent` | Int | Positiv bei Aufladung/positiver Korrektur, negativ bei Kauf |
| `drinkId` | String, FK → Drink, nullable | Nur bei `KAUF` gesetzt |
| `preisAtKaufCent` | Int, nullable | Eingefroren bei `KAUF` |
| `stornoVonId` | String, FK → Transaktion, nullable | Bei `STORNO`: Verweis auf Original |
| `notiz` | String, nullable | Pflicht bei `KORREKTUR`, `AUFLADUNG_BARGELD`, `STORNO` |
| `erstelltVonId` | String, FK → User | Wer hat es ausgelöst |
| `kassenTransaktionId` | String, FK → KassenTransaktion, nullable | Bei Aufladungen: Verweis auf die gekoppelte Kassen-Buchung (siehe 6.8) |
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
| `tokenHash` | String | SHA-256 des Tokens |
| `expiresAt` | DateTime | 7 Tage nach Erstellung |
| `redeemedAt` | DateTime, nullable | Wann eingelöst |
| `erstelltVonId` | String, FK → User | Welcher Admin hat ausgestellt |
| `createdAt` | DateTime | |

**Hinweis:** Code aus Phase B1 nennt diese Entität `InviteToken`. Wird in B2a auf `Invite` umbenannt.

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
| `adminNotiz` | String, nullable | Optional |
| `transaktionId` | String, FK → Transaktion, nullable | Bei `BESTAETIGT`: erzeugte Aufladungs-Transaktion |

### 5.6 KassenTransaktion (Kassen-Ebene) — NEU in Update 6

Jede Bewegung am Geld der Kasse selbst. Trennt Bar- und PayPal-Bestand über das `konto`-Feld. **Niemals löschen** — Audit-Trail.

| Feld | Typ | Notiz |
|---|---|---|
| `id` | String (cuid) | |
| `typ` | Enum | `EINZAHLUNG`, `EINKAUF`, `UMBUCHUNG`, `KORREKTUR` |
| `konto` | Enum | `BAR`, `PAYPAL` — welches Unterkonto betroffen ist |
| `betragCent` | Int | Positiv = Zufluss ins Konto, negativ = Abfluss |
| `notiz` | String, nullable | Pflicht bei `EINKAUF`, `KORREKTUR` (z.B. „Getränkemarkt 24.05.", „Kassensturz-Korrektur") |
| `transaktionId` | String, FK → Transaktion, nullable | Bei `EINZAHLUNG`: Verweis auf die gekoppelte Mitglieder-Aufladung (siehe 6.8) |
| `umbuchungGegenId` | String, FK → KassenTransaktion, nullable | Bei `UMBUCHUNG`: Verweis auf die Gegenbuchung (das andere Konto) |
| `erstelltVonId` | String, FK → User | Immer ein Admin |
| `createdAt` | DateTime | |

**Konto-Logik:**
- Eine Bar-Einzahlung: `typ=EINZAHLUNG`, `konto=BAR`, `betragCent=+X`
- Eine PayPal-Einzahlung: `typ=EINZAHLUNG`, `konto=PAYPAL`, `betragCent=+X`
- Ein Bar-Einkauf: `typ=EINKAUF`, `konto=BAR`, `betragCent=-X`
- Eine Umbuchung PayPal→Bar erzeugt **zwei** Zeilen: eine mit `konto=PAYPAL, betragCent=-X` und eine mit `konto=BAR, betragCent=+X`, verknüpft über `umbuchungGegenId`

### 5.7 Relationen-Übersicht

```
User 1 ──n Transaktion (userId)
User 1 ──n Transaktion (erstelltVonId)
User 1 ──n AufladungsAnfrage (userId)
User 1 ──n AufladungsAnfrage (decidedById)
User 1 ──n Invite (erstelltVonId)
User 1 ──n KassenTransaktion (erstelltVonId)
Drink 1 ──n Transaktion (drinkId, optional)
Transaktion 1 ──1 Transaktion (stornoVonId, optional, reflexiv)
Transaktion 1 ──1 KassenTransaktion (kassenTransaktionId, optional)  ← Kopplung der Ebenen
AufladungsAnfrage 1 ──1 Transaktion (transaktionId, optional)
KassenTransaktion 1 ──1 KassenTransaktion (umbuchungGegenId, optional, reflexiv)
```

---

## 6. Geschäftslogik

### 6.1 Mitglieder-Guthaben-Berechnung

Guthaben eines Users = `SUM(transaktionen.betragCent) WHERE userId = X`.

- Kein redundantes Feld auf User
- Bei jeder Anzeige neu berechnet (auf 30 Mitglieder unproblematisch in SQLite)
- „Cannot be wrong by design"

### 6.2 Buchen-Flow

1. Mitglied wählt Drink aus aktivem Katalog (gruppiert nach Kategorie)
2. Confirm-Sheet zeigt: Drink-Name, Icon, Preis, neues Guthaben (rot falls negativ)
3. Bestätigung → neue Transaktion: `typ=KAUF`, `drinkId=X`, `preisAtKaufCent=Drink.preisCent`, `betragCent=-Drink.preisCent`
4. Guthaben sofort aktualisiert sichtbar
5. Buchung für 5 Minuten als „storno-fähig" markiert

**Wichtig (Update 6):** Das Buchen eines Getränks bewegt **nichts** auf der Kassen-Ebene. Das Geld kam beim Einzahlen in die Kasse; eine Buchung reduziert nur die Verbindlichkeit gegenüber dem Mitglied. Es wird also **keine** `KassenTransaktion` beim Kauf erzeugt.

### 6.3 Storno-Flow

**5-Min-Fenster für Mitglieder:** eigene `KAUF`-Transaktion innerhalb 5 Min nach `createdAt`. Erzeugt `typ=STORNO`, `stornoVonId=Original.id`, `betragCent=-Original.betragCent`. Konstante `STORNO_FENSTER_MINUTEN = 5` fix im Code.

**Jederzeit für Admin:** jede Transaktion stornierbar, Pflicht-Notiz.

**Storno einer gekoppelten Aufladung:** Wird eine Aufladung storniert (nur Admin), muss auch die gekoppelte `KassenTransaktion` rückgängig gemacht werden — als Gegen-`KassenTransaktion` (`typ=KORREKTUR`, umgekehrtes Vorzeichen, Verweis im Notiz-Feld). Beide in einer DB-Transaktion. Siehe 6.8.

**Nicht stornierbar:** Storno-Transaktionen selbst.

### 6.4 Aufladung — Bargeld

1. Verwalter geht in Admin → Mitglied X
2. „Bargeld-Aufladung": Betrag + Pflicht-Notiz „Bar aufgeladen"
3. Erzeugt **zwei gekoppelte Buchungen** (eine DB-Transaktion):
   - Mitglieder-`Transaktion`: `typ=AUFLADUNG_BARGELD`, `betragCent=+X`
   - Kassen-`KassenTransaktion`: `typ=EINZAHLUNG`, `konto=BAR`, `betragCent=+X`
   - Verknüpft über `kassenTransaktionId` / `transaktionId`
4. Mitglied sieht Aufladung, Kassen-Bar-Bestand steigt

### 6.5 Aufladung — PayPal

1. Mitglied klickt Betrag-Button (5€/10€/20€/50€ oder „Anderer Betrag")
2. App öffnet `https://paypal.me/{verwalter-link}/{betrag}`
3. Parallel: `AufladungsAnfrage` mit `status=OFFEN`
4. Mitglied überweist via PayPal
5. Verwalter sieht Eingang, geht in Admin → Aufladungs-Anfragen
6. **Bestätigen:** erzeugt **zwei gekoppelte Buchungen** (eine DB-Transaktion):
   - Mitglieder-`Transaktion`: `typ=AUFLADUNG_PAYPAL`, `betragCent=+X`
   - Kassen-`KassenTransaktion`: `typ=EINZAHLUNG`, `konto=PAYPAL`, `betragCent=+X`
   - `AufladungsAnfrage.status=BESTAETIGT`, `transaktionId` verknüpft
7. **Ablehnen:** Status `ABGELEHNT`, optional Notiz. Keine Buchung.

### 6.6 Negatives Guthaben

- Erlaubt, unbegrenzt, keine Untergrenze
- Visuell rot markiert (Dashboard + Mitglieder-Übersicht)
- Kein Audio-Warning, kein Hard-Stop
- Confirm-Sheet warnt „Du gehst auf -X,XX € — trotzdem buchen?"

### 6.7 Account-Lifecycle

**Erstellen:** Admin lädt via Magic-Link ein. User klickt Link, setzt Passwort.

**Soft-Delete:** `User.deletedAt = now()`, kein Login mehr, alle Mitglieder-Transaktionen werden mitgelöscht, Restguthaben außerhalb der App geklärt, Hard-Delete nach 30 Tagen (Phase B7).

**Hinweis zur Kassen-Ebene:** Gelöschte Mitglieder-Transaktionen betreffen die **Mitglieder-Ebene**. Die gekoppelten `KassenTransaktion`-Einträge (das Geld ist ja real in der Kasse) bleiben erhalten — sonst würde der Kassenbestand verfälscht. Beim Mitglieder-Soft-Delete wird die Kopplung (`kassenTransaktionId`) auf null gesetzt, die `KassenTransaktion` selbst bleibt stehen.

**Keine Gast-Konten.**

### 6.8 Kassenführung (NEU in Update 6)

**Grundprinzip:** Die App ist die Wahrheit. Der angezeigte Soll-Bestand *ist* der maßgebliche Bestand. Es gibt keinen automatischen Ist/Soll-Abgleich. Der Verwalter trägt die Verantwortung, das digitale PayPal-Guthaben real verfügbar zu halten — die App führt Buch, der Verwalter erfüllt es.

**Die drei Kassen-Kennzahlen (alle live summiert):**
- **Bar-Bestand** = `SUM(kassenTransaktionen.betragCent) WHERE konto = BAR`
- **PayPal-Bestand** = `SUM(kassenTransaktionen.betragCent) WHERE konto = PAYPAL`
- **Gesamtbestand** = Bar + PayPal

**Solvenz-Kennzahl (zentrale Gesundheitszahl):**
- **Deckung** = Gesamtbestand − `SUM(alle Mitglieder-Guthaben)`
- Positiv: die Kasse besitzt mehr, als sie den Mitgliedern schuldet (Marge / Puffer)
- Negativ: die Kasse schuldet den Mitgliedern mehr, als sie hat (Warnsignal — tritt auf bei vielen Negativ-Salden + hohen Einkäufen)
- Wird im Admin-Kassen-Screen prominent angezeigt, rot bei negativ

**Geldflüsse auf Kassen-Ebene:**

| Aktion | Auslöser | Effekt |
|---|---|---|
| Mitglied lädt bar auf | Admin (6.4) | `EINZAHLUNG`, `konto=BAR`, `+X` — gekoppelt an Mitglieder-Transaktion |
| Mitglied lädt PayPal auf | Admin bestätigt (6.5) | `EINZAHLUNG`, `konto=PAYPAL`, `+X` — gekoppelt |
| Getränke-Einkauf | Admin „Einkauf abrechnen" | `EINKAUF`, `konto=BAR` oder `PAYPAL`, `-X`, Pflicht-Notiz |
| Umbuchung PayPal→Bar | Admin | zwei Zeilen: `PAYPAL -X` + `BAR +X`, verknüpft über `umbuchungGegenId` |
| Umbuchung Bar→PayPal | Admin | zwei Zeilen: `BAR -X` + `PAYPAL +X` |
| Manuelle Korrektur | Admin | `KORREKTUR`, gewähltes Konto, ±X, Pflicht-Notiz |

**Einkauf-Flow:**
1. Verwalter klickt im Kassen-Screen „Einkauf abrechnen"
2. Eingabe: Betrag, Konto (Bar oder PayPal — womit wurde bezahlt), Pflicht-Notiz (z.B. „Getränkemarkt 24.05.")
3. Erzeugt `KassenTransaktion`: `typ=EINKAUF`, gewähltes Konto, `betragCent=-X`
4. Gesamtbestand sinkt. Mitglieder-Guthaben unberührt.

**Umbuchungs-Flow (PayPal ↔ Bar):**
- Realer Vorgang: Verwalter hebt PayPal-Geld ab und legt es bar in die Kasse (oder umgekehrt)
- App-Vorgang: „Umbuchen", Richtung wählen, Betrag eingeben
- Erzeugt zwei verknüpfte `KassenTransaktion`-Zeilen, Gesamtbestand bleibt gleich, nur Aufteilung ändert sich

**Wichtig zur PayPal-Grauzone:** Das PayPal-Konto der App bildet ab, wie viel Vereinsgeld auf PayPal liegt. Damit das sauber bleibt, sollte der Verwalter Vereins- und Privat-PayPal möglichst getrennt halten. Das ist ein Prozess-Hinweis, kein App-Feature.

---

## 7. UI/UX

### 7.1 Bottom-Nav (Mitglied)

| Tab | Inhalt |
|---|---|
| 🏠 Theke | Dashboard: Guthaben groß, Quick-Buchung-CTA |
| 🍺 Buchen | Auswahl-Screen: aktive Getränke nach Kategorie, Tap → Confirm-Sheet |
| 💳 Aufladen | PayPal-Beträge + paypal.me-Trigger, Bargeld-Hinweis-Card |
| 🕒 Verlauf | Transaktions-Historie + Trinkjournal + Achievements |

Admin-Bereich via Profil-Drawer (Avatar-Tap im Header).

### 7.2 Admin-Bereich (Drawer-Menü)

- 👥 Mitglieder (Liste mit Salden, Detail-Ansicht, Korrekturen)
- ✉️ Mitglied einladen
- 🍺 Drink-Katalog
- 💳 Aufladungs-Anfragen
- 📊 Sortenstatistik
- 🏦 **Kasse (NEU):** Bar-Bestand, PayPal-Bestand, Gesamt, Deckungs-Kennzahl, „Einkauf abrechnen", „Umbuchen", Kassen-Transaktions-Historie

### 7.3 Trinkjournal & Achievements

**Stilbezeichnung:** „Eigenes Trinkjournal" — privat, nur User selbst.

**Hero:** Monatszahl in Fraunces, Amber-Glow-Card.

**Stat-Strip:** Diese Woche / Streak / Längste Pause (neutral, kein Wertungs-Coach).

**30-Tage-Verlauf:** Balkendiagramm, Wochenenden Amber-Deep, Wochentage Amber-Light, Tap → Tagesbuchungen.

**Achievements (privat, locker, niemals wertend):**
- 🏔️ Erstbesteigung — Erstes Getränk
- 🌧️ Trockenwoche — 7 Tage keine Buchung
- ⛺ Hüttenabend — 3 Getränke an einem Tag
- 🎒 Tourenrucksack — 20 Getränke im Monat
- 🪙 Hamster — Guthaben erstmals über 50 € aufgeladen
- 🎖️ Stammgast — 100 Buchungen gesamt
- 🧗 Seilschaft — erste Runde ausgegeben (Future, B4+)

### 7.4 Sortenstatistik (Admin)

App-weit aggregiert, anonym. Zeitfilter Woche/Monat/Quartal. Pro Drink: Anzahl + Umsatz. Keine User-Zuordnung, keine Top-Konsumenten.

### 7.5 Kassen-Screen (Admin) — NEU in Update 6

- **Bestands-Hero:** Gesamtbestand groß, darunter Bar + PayPal getrennt
- **Deckungs-Card:** Gesamtbestand − Summe Mitglieder-Guthaben, rot bei negativ, mit Erklär-Text
- **Aktionen:** „Einkauf abrechnen" (Betrag, Konto, Notiz), „Umbuchen" (Richtung, Betrag)
- **Kassen-Historie:** chronologische Liste aller `KassenTransaktion`-Einträge mit Typ, Konto, Betrag, Notiz

---

## 8. Design-System (aus Design-Pack v2)

**Tokens:** `--bwza-*` Namespace, OKLCH-Farben
**Fonts:** Fraunces (Display), Inter (UI), JetBrains Mono (Code)
**Stil:** Dunkle Berghütten-Bar, Glass-Komponenten, Amber-Akzente
**Source of Truth:** `design/README_DESIGN.md` + `design/design-tokens.css`

**Primitives** (teils in B1, Rest in B5):
Glass, ShineEdge, BergMark, Avatar, TopBar, BottomNav, GlassButton, GlassInput, PasswordInput, StatCard, Flash, EmptyState, Skeleton, DrinkPicker (B2b), DrinkConfirm (B2c), DrinkCatalogRow (B2b), ProfileDrawer, AdminBanner, AufladungsAnfrageRow (B2f), MitgliederSaldoRow (B2g), KassenBestandCard (B2i), KassenTransaktionRow (B2i), EinkaufSheet (B2i).

---

## 9. DSGVO

### Mindestpaket (vor Live-Gang — Phase B7)
- Datenschutzerklärung auf Login-Seite
- „Meine Daten exportieren" (JSON-Download)
- „Account löschen" (Soft-Delete mit 30-Tage-Frist, dann Hard-Delete)
- AVV mit Hosting-Provider (ab Hetzner)
- Verarbeitungsverzeichnis als Markdown im Repo

### Position zu Sortendaten
Keine persönlichen Trinkpräferenzen pro User — Trinkjournal sortenagnostisch (nur Anzahl/Beträge). Sortenstatistiken nur App-weit aggregiert, ohne User-Bezug. Auf Transaktions-Ebene `drinkId` technisch notwendig (Historie, Stornos, Preisnachweis).

### Datenexport-Regel
- ✅ Eigene Buchungen inkl. `drinkId` / Drink-Name
- ❌ Aggregierte App-Statistiken anderer User
- ❌ Soft-deleted Transaktionen anderer User
- **Kassen-Daten** (`KassenTransaktion`) sind Vereinsbuchhaltung ohne personenbezogenen Mitglieder-Bezug (außer `erstelltVonId`=Admin) → nicht Teil des Mitglieder-Datenexports

---

## 10. Phasen-Roadmap

Phase B1 abgeschlossen (Auth-Grundgerüst + Smoke-Test). Ab B2 feinere Sub-Phasen.

| Phase | Inhalt | Dauer | Status |
|---|---|---|---|
| **B1** | Grundgerüst (Auth + Magic-Link + Admin-Bootstrap via Seed) | 3-4 Tage | ✅ abgeschlossen 25.05.2026 |
| **B2a** | Mitglieder-Invite-UI (Admin) | 0.5-1 Tag | offen |
| **B2b** | Drink-Katalog (Modell + Admin-CRUD) + Naming-Drift-Bereinigung | 1-2 Tage | offen |
| **B2c** | Buchen-Flow + Live-Guthaben | 2 Tage | offen |
| **B2d** | Storno-Flow (5-Min User, jederzeit Admin) | 1 Tag | offen |
| **B2e** | Bargeld-Aufladung (Admin) — inkl. gekoppelter Kassen-Buchung | 1 Tag | offen |
| **B2f** | PayPal-Aufladungs-Anfragen (User + Admin) — inkl. gekoppelter Kassen-Buchung | 1-2 Tage | offen |
| **B2g** | Mitglieder-Übersicht + manuelle Guthaben-Korrektur | 1 Tag | offen |
| **B2i** | **Kassenführung (NEU): Kassen-Screen, Einkauf, Umbuchung, Deckungs-Kennzahl** | 1-2 Tage | offen |
| **B3** | Sortenstatistik (Admin) | 1 Tag | offen |
| **B4** | Trinkjournal + Achievements + 30-Tage-Verlauf | 2-3 Tage | offen |
| **B5** | Design-Politur (Dark-Bar überall) | 1-2 Tage | offen |
| **B6** | PWA + Letzter Schliff | 2-3 Tage | offen |
| **B7** | DSGVO (DSE, Export, Soft-Delete, Hard-Delete-Job) | 2-3 Tage | offen |
| **B8** | Deploy Hetzner (SQLite → Postgres, Subdomain, AVV) + Testphase | 5-7 Tage | offen |
| **B9** | Go-Live | 1 Tag | offen |
| **Gesamt** | | **~6-8 Wochen** | |

**Begründungen zur Reihenfolge:**
- **B2a vorne:** Invite-UI zuerst, damit echte Mitglieder zum Testen anlegbar sind
- **B2e/B2f:** Aufladungen erzeugen ab jetzt gekoppelte Kassen-Buchungen — die `KassenTransaktion`-Entität muss also spätestens hier im Schema sein. Schema-Anlage erfolgt in B2e (erste Aufladung mit Kassen-Kopplung).
- **B2i (Kassenführung) nach den Aufladungen:** Der Kassen-Screen visualisiert, was B2e/B2f an Kassen-Buchungen erzeugen. Einkauf + Umbuchung kommen hier dazu. Eigene Sub-Phase, weil eigenständige UI + Logik.
- **B3 vor B4:** Sortenstatistik = Verwalter-MVP, Trinkjournal = Mitglied-Bonus
- **B5 als eigene Polier-Phase:** erst funktional, dann stilistisch

---

## 11. Verbotenes / explizit aus dem Scope

- Kein Self-Signup
- Kein Leaderboard, kein „Bierkönig", kein öffentlicher Vergleich
- Kein Lieblings-Drink-Tracking pro User
- Keine User-definierten Drink-Kategorien
- Kein Audio-Warning bei negativem Guthaben
- Keine PayPal-API-Integration (nur paypal.me-Link)
- Keine Gast-Konten
- Keine Storno-Stornos
- Keine Aufbewahrung gelöschter User-Transaktionen für Statistik
- **Kein automatischer Ist/Soll-Kassensturz-Abgleich** — die App ist die Wahrheit, der Verwalter erfüllt sie (Update 6)
- **Getränk-Buchen bewegt kein Kassen-Geld** — nur die Mitglieder-Verbindlichkeit (Update 6)

---

## 12. Bekannte Inkonsistenzen aus Phase B1 (zu beheben in B2b)

| Code (B1) | Diese Spec | Bereinigung in |
|---|---|---|
| `User.guthaben` (Int-Feld) | kein Feld, live summiert | B2c |
| `InviteToken` (Modell-Name) | `Invite` | B2b |
| Keine Transaktions-Modelle | `Transaktion`, `AufladungsAnfrage` | B2b/B2c/B2f |
| Keine Kassen-Modelle | `KassenTransaktion` | B2e (Schema), B2i (Screen) |

Außerdem: Form-Field-IDs auf Login-Page fehlen (DevTools-Warning) → B5 Politur.

---

## 13. Änderungshistorie (kompakt)

**Update 6 (26.05.2026):** Kassenführung
- Neue Entität `KassenTransaktion` (Kassen-Ebene, getrennt von Mitglieder-`Transaktion`)
- Zwei Unterkonten: Bar + PayPal, Gesamtbestand = Summe
- Drei Kennzahlen live summiert: Bar-Bestand, PayPal-Bestand, Gesamt
- Solvenz-Kennzahl „Deckung" = Gesamtbestand − Summe Mitglieder-Guthaben
- Mitglieder-Aufladungen (bar + PayPal) erzeugen gekoppelte Kassen-Einzahlungen
- Getränke-Einkauf als `EINKAUF`-Buchung mit Konto-Wahl + Pflicht-Notiz
- Umbuchung PayPal ↔ Bar als verknüpftes Zeilenpaar (Gesamtbestand unverändert)
- Prinzip: App ist die Wahrheit, kein Ist/Soll-Abgleich, Verwalter erfüllt PayPal-Verfügbarkeit
- Getränk-Buchen bewegt bewusst kein Kassen-Geld (Sichtweise A)
- Neue Phase B2i (Kassen-Screen), Kassen-Schema schon ab B2e

**Update 5 (26.05.2026):** Klärungs-Konsolidierung nach Phase-1-Smoke-Test
- Komplette Neufassung nach 5 Klärungs-Schichten
- Neu: `AufladungsAnfrage`, `Transaktion.stornoVonId`, Live-Guthaben statt gespeichertem Feld
- 5-Min-Stornofenster, jederzeitiges Admin-Storno
- PayPal via paypal.me-Link, Bargeld durch Admin
- Audio-Warning verworfen
- Roadmap: B2 in Sub-Phasen, B3 vor B4, eigene Design-Phase B5

**Update 4 (21.05.2026):** Flexibler Getränkekatalog + DSGVO-Reformulierung
- Single-Drink aus Update 3 zurückgenommen, CRUD-Katalog
- Feste Kategorien, `isActive`, `preisAtKauf` eingefroren

**Update 3 (20.05.2026, verworfen durch Update 4):**
- Versuch: einzelnes Getränk zu 1,50 € statt Katalog, von Update 4 rückgängig gemacht

**Update 2 (20.05.2026):** Design-Integration (Dark-Bar, Fraunces, Glass-Primitives)

**Update 1 (20.05.2026):** Architektur final (SQLite, kein Leaderboard, Admin-Invite, Hetzner)
