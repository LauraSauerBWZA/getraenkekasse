# Konfiguration — Bergwacht Getränkekasse

**Stand:** 04.06.2026 (Update 7: Schuld-Modell für die Kasse + Leitung-Rolle)
**Status:** 🟢 Phase B1 abgeschlossen + verifiziert, Phase B2 vorbereitet

---

## 1. Zweck

Web-App zur Digitalisierung der Bergwacht-Zollernalb-Getränkekasse. Ersetzt die analoge Bar-Kasse + Strichliste. Mitglieder loggen sich ein, sehen ihr Guthaben, buchen Getränke aus dem Katalog ab. Aufladung läuft über PayPal (paypal.me-Link, manuell vom Verwalter bestätigt) oder Bargeld (Verwalter trägt manuell ein). Negatives Guthaben ist erlaubt.

**Kassenführung (Update 7):** Die App führt das Vereinsgeld als eigene Buchhaltung — getrennt nach dem, was der Verwalter aktuell hält, und dem, was in der physischen Bar-Vereinskasse liegt. So ist jederzeit nachvollziehbar, wie viel Geld die Kasse insgesamt hat und ob sie gegenüber den Mitglieder-Guthaben solvent ist (Deckung).

**Transparenz (Update 7):** Eine dritte Rolle „Leitung" erhält reine Einsicht auf die Kassen-Ebene (lesend, keine Buchungen), damit Leitung und Kassier die Finanzen nachvollziehen können.

**Größenordnung:** ca. 30 Mitglieder. Eine Verwalterin (Laura Sauer), zusätzlich 3-4 Personen mit Leitung-Einsicht.

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
| Leitung (Einsicht) | 3-4 Personen (Leitung + Kassier) | wird vom Verwalter festgelegt |

**Domain:** `getraenke.einfall.app` (Subdomain von `einfall.app`, anzulegen vor Phase B8)

**PayPal-Adresse Verwalter:** paypal.me-Link (TBD — vor Phase B2f anlegen)

---

## 4. Rollen & Berechtigungen

Drei Rollen, gesteuert über zwei Flags am User: `isAdmin` (Verwalter) und `isLeitung` (Einsicht).

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

### Leitung kann (NEU in Update 7) — reine Einsicht, keine Schreibrechte
Alles vom Mitglied (eigenes Konto wie jedes Mitglied) plus **lesenden** Zugriff auf die Kassen-Ebene:
- Gesamtbestand sehen (Verwalter hält + Bar-Vereinskasse)
- Deckungs-Kennzahl sehen
- Alle Kassen-Transaktionen sehen (Einzahlungen, Einkäufe, Auslagen, Spenden, Korrekturen) mit Beträgen und Notizen
- Gesamtsumme aller Mitglieder-Guthaben sehen (**eine Zahl, nicht pro Person aufgeschlüsselt**)
- Sortenstatistik sehen (ohnehin anonym aggregiert)

**Leitung darf ausdrücklich NICHT:**
- Einzelne Mitglieder-Salden sehen (wer im Plus/Minus ist)
- Individuelle Trinkjournale / Achievements sehen (bleiben privat, auch vor Leitung)
- Irgendetwas eintragen, ändern, stornieren, bestätigen, einladen
- Den Drink-Katalog ändern

### Verwalter (Admin) kann
Alles vom Mitglied (auch selbst Getränke buchen) plus volle Schreibrechte:
- Neue Mitglieder einladen (Magic-Link via Email)
- **Leitung-Recht** an Mitglieder vergeben oder entziehen
- Bargeld-Aufladung manuell eintragen (User-X bekommt +Y€, Pflicht-Notiz „Bar aufgeladen")
- PayPal-Anfragen bestätigen oder ablehnen (mit optionaler Notiz)
- Drink-Katalog pflegen (anlegen, Preis ändern, Icon/Kategorie ändern, soft-disablen)
- Übersicht aller Mitglieder mit aktuellem Saldo sehen
- Guthaben eines Mitglieds manuell korrigieren (mit Pflicht-Notiz)
- Jede Transaktion (auch Aufladungen, auch alte Buchungen) jederzeit stornieren (mit Pflicht-Notiz)
- App-weite Sortenstatistik für Einkaufsplanung sehen
- **Kassenführung:** Einkäufe abrechnen, Geld in die Bar-Vereinskasse legen, Auslagen erfassen, Spenden eintragen, Bar-Vereinskasse korrigieren

---

## 5. Datenmodell

Fünf Entitäten. Beträge **immer in Cent als `Int`**, niemals als `Float`.

Es gibt zwei getrennte Buchungs-Ebenen:
- **Mitglieder-Ebene** (`Transaktion`): Guthaben einzelner Mitglieder
- **Kassen-Ebene** (`KassenTransaktion`): Vereinsgeld, getrennt nach „Verwalter hält" und „Bar-Vereinskasse"

Die Ebenen sind an einer Stelle gekoppelt (eine Mitglieder-Aufladung erzeugt zugleich eine Kassen-Einzahlung), aber buchhalterisch getrennt. Siehe Sektion 6.8.

### 5.1 User

| Feld | Typ | Notiz |
|---|---|---|
| `id` | String (cuid) | Prisma-Default |
| `email` | String, unique | Login-Identifier |
| `firstName` | String | Pflicht |
| `lastName` | String | Pflicht |
| `passwordHash` | String, nullable | argon2-Hash, null bis Magic-Link eingelöst |
| `isAdmin` | Boolean, default false | Verwalter-Flag (volle Schreibrechte) |
| `isLeitung` | Boolean, default false | Leitung-Flag (reine Kassen-Einsicht) — NEU Update 7 |
| `deletedAt` | DateTime, nullable | Soft-Delete-Marker |
| `createdAt` / `updatedAt` | DateTime | Standard-Audit |

**Kein gespeichertes `guthabenCent`-Feld.** Guthaben wird live aus Transaktionen summiert (siehe 6.1).

### 5.2 Drink

| Feld | Typ | Notiz |
|---|---|---|
| `id` | String (cuid) | |
| `name` | String | Anzeige-Name („Cola", „Bier klein") |
| `preisCent` | Int | Aktueller Verkaufspreis |
| `icon` | String | Emoji-String, optional |
| `kategorie` | Enum | `alkoholfrei`, `alkoholisch`, `sonstiges` (fest, kein CRUD) |
| `isActive` | Boolean, default true | Soft-Disable statt Hard-Delete |
| `createdAt` / `updatedAt` | DateTime | |

### 5.3 Transaktion (Mitglieder-Ebene)

Jede Bewegung am Guthaben eines Mitglieds. **Niemals löschen** — Audit-Trail.

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
| `kassenTransaktionId` | String, FK → KassenTransaktion, nullable | Bei Aufladungen: Verweis auf gekoppelte Kassen-Buchung |
| `createdAt` | DateTime | |

### 5.4 Invite

Magic-Link-Token für neue Mitglieder.

| Feld | Typ | Notiz |
|---|---|---|
| `id` | String (cuid) | |
| `email` | String | Wer eingeladen wurde |
| `firstName` / `lastName` | String | |
| `isAdmin` | Boolean, default false | Falls Verwalter weiteren Admin anlegt |
| `isLeitung` | Boolean, default false | Falls direkt mit Leitung-Recht eingeladen |
| `tokenHash` | String | SHA-256 des Tokens |
| `expiresAt` | DateTime | 7 Tage nach Erstellung |
| `redeemedAt` | DateTime, nullable | Wann eingelöst |
| `erstelltVonId` | String, FK → User | Welcher Admin hat ausgestellt |
| `createdAt` | DateTime | |

**Hinweis:** Code aus Phase B1 nennt diese Entität `InviteToken`. Wird in B2b auf `Invite` umbenannt.

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

### 5.6 KassenTransaktion (Kassen-Ebene) — Schuld-Modell, Update 7

Jede Bewegung am Vereinsgeld. Das `konto`-Feld trennt „Verwalter hält" von „Bar-Vereinskasse". **Niemals löschen** — Audit-Trail.

| Feld | Typ | Notiz |
|---|---|---|
| `id` | String (cuid) | |
| `typ` | Enum | `EINZAHLUNG`, `EINLAGE_BOX`, `EINKAUF`, `AUSLAGE`, `SPENDE`, `KORREKTUR` |
| `konto` | Enum | `VERWALTER` (Verwalter hält) oder `BOX` (Bar-Vereinskasse) |
| `betragCent` | Int | Positiv = Zufluss ins Konto, negativ = Abfluss |
| `notiz` | String, nullable | Pflicht bei `EINKAUF`, `AUSLAGE`, `KORREKTUR`, `SPENDE` |
| `transaktionId` | String, FK → Transaktion, nullable | Bei `EINZAHLUNG`: Verweis auf gekoppelte Mitglieder-Aufladung |
| `einlageGegenId` | String, FK → KassenTransaktion, nullable | Bei `EINLAGE_BOX`: Verweis auf die Gegenbuchung (das andere Konto) |
| `erstelltVonId` | String, FK → User | Immer ein Admin |
| `createdAt` | DateTime | |

**Typen-Logik im Detail:**

| Typ | Konto | Vorzeichen | Bedeutung |
|---|---|---|---|
| `EINZAHLUNG` | VERWALTER | + | Mitglied zahlt ein (bar/PayPal), Geld geht an den Verwalter. Gekoppelt an Mitglieder-Aufladung. |
| `EINLAGE_BOX` | VERWALTER / BOX | −/+ | Verwalter legt gehaltenes Geld in die Box. Zwei Zeilen: `VERWALTER −X` + `BOX +X`, verknüpft über `einlageGegenId`. |
| `EINKAUF` | VERWALTER **oder** BOX | − | Getränke-Einkauf. Konto je nachdem, woraus bezahlt wurde. |
| `AUSLAGE` | VERWALTER | − | Verwalter streckt aus Privattasche vor → „Verwalter hält" sinkt, darf negativ werden. |
| `SPENDE` | VERWALTER **oder** BOX | + | Spende / Gast-Einzahlung (kein Mitglied). Beim Eintragen wählbar, wohin. |
| `KORREKTUR` | VERWALTER **oder** BOX | ± | Manuelle Korrektur, z.B. Bar-Vereinskasse nach Nachzählen. Pflicht-Notiz. |

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
KassenTransaktion 1 ──1 KassenTransaktion (einlageGegenId, optional, reflexiv)
```

---

## 6. Geschäftslogik

### 6.1 Mitglieder-Guthaben-Berechnung

Guthaben eines Users = `SUM(transaktionen.betragCent) WHERE userId = X`. Kein redundantes Feld, bei jeder Anzeige neu berechnet, „cannot be wrong by design".

### 6.2 Buchen-Flow

1. Mitglied wählt Drink aus aktivem Katalog (gruppiert nach Kategorie)
2. Confirm-Sheet zeigt: Drink-Name, Preis, neues Guthaben (rot falls negativ)
3. Bestätigung → Transaktion `typ=KAUF`, `drinkId=X`, `preisAtKaufCent=Drink.preisCent`, `betragCent=-Drink.preisCent`
4. Guthaben sofort aktualisiert
5. Buchung 5 Minuten als „storno-fähig" markiert

**Wichtig:** Das Buchen bewegt **nichts** auf der Kassen-Ebene. Das Geld kam beim Einzahlen herein; die Buchung reduziert nur die Verbindlichkeit gegenüber dem Mitglied. Keine `KassenTransaktion` beim Kauf.

### 6.3 Storno-Flow

**5-Min-Fenster für Mitglieder:** eigene `KAUF`-Transaktion innerhalb 5 Min. Erzeugt `STORNO`, `stornoVonId=Original.id`, `betragCent=-Original.betragCent`. Konstante `STORNO_FENSTER_MINUTEN = 5` fix im Code.

**Jederzeit für Admin:** jede Transaktion stornierbar, Pflicht-Notiz.

**Storno einer gekoppelten Aufladung:** Wird eine Aufladung storniert, muss die gekoppelte `KassenTransaktion` per Gegen-`KORREKTUR` (umgekehrtes Vorzeichen, Konto `VERWALTER`) rückgängig gemacht werden. Beide in einer DB-Transaktion.

**Nicht stornierbar:** Storno-Transaktionen selbst.

### 6.4 Aufladung — Bargeld

1. Verwalter geht in Admin → Mitglied X
2. „Bargeld-Aufladung": Betrag + Pflicht-Notiz „Bar aufgeladen"
3. Erzeugt **zwei gekoppelte Buchungen** (eine DB-Transaktion):
   - Mitglieder-`Transaktion`: `typ=AUFLADUNG_BARGELD`, `betragCent=+X`
   - Kassen-`KassenTransaktion`: `typ=EINZAHLUNG`, `konto=VERWALTER`, `betragCent=+X`
   - Verknüpft über `kassenTransaktionId` / `transaktionId`
4. Mitglied sieht Aufladung; „Verwalter hält" steigt

### 6.5 Aufladung — PayPal

1. Mitglied klickt Betrag-Button (5€/10€/20€/50€ oder „Anderer Betrag")
2. App öffnet `https://paypal.me/{verwalter-link}/{betrag}`
3. Parallel: `AufladungsAnfrage` mit `status=OFFEN`
4. Mitglied überweist; Verwalter sieht Eingang
5. **Bestätigen:** erzeugt **zwei gekoppelte Buchungen**:
   - Mitglieder-`Transaktion`: `typ=AUFLADUNG_PAYPAL`, `betragCent=+X`
   - Kassen-`KassenTransaktion`: `typ=EINZAHLUNG`, `konto=VERWALTER`, `betragCent=+X`
   - `AufladungsAnfrage.status=BESTAETIGT`, verknüpft
6. **Ablehnen:** Status `ABGELEHNT`, optional Notiz. Keine Buchung.

### 6.6 Negatives Guthaben

- Erlaubt, unbegrenzt, keine Untergrenze
- Visuell rot markiert (Dashboard + Mitglieder-Übersicht)
- Kein Audio-Warning, kein Hard-Stop
- Confirm-Sheet warnt „Du gehst auf -X,XX € — trotzdem buchen?"

### 6.7 Account-Lifecycle

**Erstellen:** Admin lädt via Magic-Link ein. User klickt Link, setzt Passwort.

**Soft-Delete:** `User.deletedAt = now()`, kein Login mehr, alle Mitglieder-Transaktionen werden mitgelöscht, Restguthaben außerhalb der App geklärt, Hard-Delete nach 30 Tagen (Phase B7).

**Hinweis zur Kassen-Ebene:** Die gekoppelten `KassenTransaktion`-Einträge bleiben beim Mitglieder-Soft-Delete erhalten (das Geld ist real in der Kasse). Die Kopplung (`kassenTransaktionId`) wird auf null gesetzt, die `KassenTransaktion` bleibt stehen.

**Keine Gast-Konten.**

### 6.8 Kassenführung (Schuld-Modell, Update 7)

**Grundprinzip:** Der Verwalter ist eine Durchgangsstation. Geld, das Mitglieder einzahlen, geht zuerst an den Verwalter (bar im Beutel oder auf PayPal — egal, ein Topf). Erst durch eine getrennte Aktion landet es in der physischen Bar-Vereinskasse oder wird für Einkäufe ausgegeben.

**Zwei Konten, beide live summiert:**
- **Verwalter hält** = `SUM(kassenTransaktionen.betragCent) WHERE konto = VERWALTER`. Darf negativ werden (wenn Verwalter aus Privattasche vorstreckt — dann schuldet die Kasse dem Verwalter Geld).
- **Bar-Vereinskasse** = `SUM(kassenTransaktionen.betragCent) WHERE konto = BOX`. Die physische Box.
- **Vereinsvermögen (Gesamt)** = Verwalter hält + Bar-Vereinskasse.

**Solvenz-Kennzahl „Deckung" (zentrale Gesundheitszahl):**
- **Deckung** = Vereinsvermögen − `SUM(alle Mitglieder-Guthaben)`
- Positiv: die Kasse besitzt mehr, als sie den Mitgliedern schuldet (Marge / Puffer durch Verkaufsaufschlag, Spenden)
- Negativ: die Kasse schuldet den Mitgliedern mehr, als sie hat (Warnsignal)
- Prominent im Kassen-Screen, rot bei negativ

**Geldflüsse auf Kassen-Ebene:**

| Aktion | Auslöser | Effekt |
|---|---|---|
| Mitglied lädt auf (bar/PayPal) | Admin (6.4/6.5) | `EINZAHLUNG`, `konto=VERWALTER`, `+X` — gekoppelt an Mitglieder-Transaktion |
| Geld in die Box legen | Admin | `EINLAGE_BOX`: `VERWALTER −X` + `BOX +X`, verknüpft über `einlageGegenId`. Gesamt unverändert. |
| Einkauf aus Verwalter-Geld | Admin „Einkauf" → Quelle Verwalter | `EINKAUF`, `konto=VERWALTER`, `−X`, Pflicht-Notiz |
| Einkauf aus der Box | Admin „Einkauf" → Quelle Box | `EINKAUF`, `konto=BOX`, `−X`, Pflicht-Notiz |
| Auslage aus Privattasche | Admin | `AUSLAGE`, `konto=VERWALTER`, `−X` (darf negativ werden), Pflicht-Notiz |
| Spende / Gast | Admin | `SPENDE`, Konto wählbar (`VERWALTER` oder `BOX`), `+X`, Pflicht-Notiz |
| Korrektur Bar-Vereinskasse | Admin (nach Nachzählen) | `KORREKTUR`, `konto=BOX`, `±X`, Pflicht-Notiz |

**Einkauf-Flow:**
1. Verwalter klickt „Einkauf abrechnen"
2. Eingabe: Betrag, Quelle (Verwalter-Geld oder Box), Pflicht-Notiz (z.B. „Getränkemarkt 24.05.")
3. Erzeugt `KassenTransaktion`: `typ=EINKAUF`, gewähltes Konto, `betragCent=-X`
4. Vereinsvermögen sinkt. Mitglieder-Guthaben unberührt.
5. **Nur Betrag + Notiz** — keine Sorten-Erfassung (bewusst einfach gehalten).

**Einlage-Flow (Geld in die Box):**
- Realer Vorgang: Verwalter nimmt gehaltenes Bargeld und legt es in die physische Vereinskasse (oder hebt PayPal-Geld ab und legt es bar rein).
- App-Vorgang: „Geld in die Box legen", Betrag eingeben.
- Erzeugt zwei verknüpfte Zeilen (`VERWALTER −X`, `BOX +X`). Vereinsvermögen bleibt gleich, nur der Ort ändert sich.

**Ist/Soll-Abgleich (NEU, anders als Update 6):** Die Bar-Vereinskasse darf nachgezählt und korrigiert werden. Stimmt der gezählte Bestand nicht mit dem App-Stand überein, trägt der Verwalter eine `KORREKTUR` (konto=BOX) mit Notiz ein. „Verwalter hält" wird nicht abgeglichen — das ist eine Vertrauens-/Schuld-Größe.

**PayPal-Grauzone (Prozess-Hinweis):** „Verwalter hält" mischt Bargeld im Beutel und PayPal-Guthaben. Der Verwalter sollte Vereins- und Privat-PayPal möglichst getrennt halten und überschüssiges Vereinsgeld zeitnah in die Box überführen, damit nicht dauerhaft hohe Beträge privat liegen. Kein App-Feature, sondern Verwalter-Disziplin.

---

## 7. UI/UX

### 7.1 Bottom-Nav (Mitglied)

| Tab | Inhalt |
|---|---|
| 🏠 Theke | Dashboard: Guthaben groß, Quick-Buchung-CTA |
| 🍺 Buchen | Auswahl-Screen: aktive Getränke nach Kategorie, Tap → Confirm-Sheet |
| 💳 Aufladen | PayPal-Beträge + paypal.me-Trigger, Bargeld-Hinweis-Card |
| 🕒 Verlauf | Transaktions-Historie + Trinkjournal + Achievements |

Admin- und Leitung-Bereiche via Profil-Drawer (Avatar-Tap im Header), je nach Rolle.

### 7.2 Admin-Bereich (Drawer-Menü, nur Verwalter)

- 👥 Mitglieder (Liste mit Salden, Detail-Ansicht, Korrekturen, Leitung-Recht vergeben)
- ✉️ Mitglied einladen
- 🍺 Drink-Katalog
- 💳 Aufladungs-Anfragen
- 📊 Sortenstatistik
- 🏦 **Kasse:** Gesamtbestand, Verwalter hält, Bar-Vereinskasse, Deckung, Aktionen (Einkauf, Einlage Box, Auslage, Spende, Korrektur), Kassen-Historie

### 7.3 Leitung-Bereich (Drawer-Menü, nur Leitung) — NEU Update 7

Reine Lese-Ansicht, eigener Screen:
- **Kassen-Übersicht (read-only):** Gesamtbestand, Verwalter hält, Bar-Vereinskasse, Deckungs-Kennzahl
- **Gesamtsumme Mitglieder-Guthaben** (eine Zahl, nicht pro Person)
- **Kassen-Historie (read-only):** alle `KassenTransaktion`-Einträge mit Typ, Konto, Betrag, Notiz, Datum
- **Sortenstatistik (read-only):** anonym aggregiert
- Keine Buttons für Aktionen, keine Mitglieder-Einzelsalden, keine Trinkjournale

### 7.4 Trinkjournal & Achievements

**Privat, nur User selbst** — auch vor Leitung geschützt.

**Hero:** Monatszahl, Amber-Glow. **Stat-Strip:** Diese Woche / Streak / Längste Pause. **30-Tage-Verlauf:** Balkendiagramm. **Achievements:** Erstbesteigung, Trockenwoche, Hüttenabend, Tourenrucksack, Hamster, Stammgast, Seilschaft (Future).

### 7.5 Sortenstatistik (Admin + Leitung)

App-weit aggregiert, anonym. Zeitfilter Woche/Monat/Quartal. Pro Drink: Anzahl + Umsatz. Keine User-Zuordnung.

### 7.6 Kassen-Screen (Admin)

- **Bestands-Hero:** Vereinsvermögen groß, darunter „Verwalter hält" + „Bar-Vereinskasse" getrennt
- **Deckungs-Card:** Vereinsvermögen − Summe Mitglieder-Guthaben, rot bei negativ, mit Erklär-Text
- **Aktionen:** Einkauf abrechnen, Geld in die Box legen, Auslage erfassen, Spende eintragen, Bar-Vereinskasse korrigieren
- **Kassen-Historie:** chronologische Liste aller `KassenTransaktion`-Einträge

---

## 8. Design-System (aus Design-Pack v2)

**Tokens:** `--bwza-*` Namespace, OKLCH-Farben
**Fonts:** Fraunces (Display), Inter (UI), JetBrains Mono (Code)
**Stil:** Dunkle Berghütten-Bar, Glass-Komponenten, Amber-Akzente
**Source of Truth:** `design/README_DESIGN.md` + `design/design-tokens.css`

**Primitives** (teils in B1, Rest in B5):
Glass, ShineEdge, BergMark, Avatar, TopBar, BottomNav, GlassButton, GlassInput, PasswordInput, StatCard, Flash, EmptyState, Skeleton, DrinkPicker (B2b), DrinkConfirm (B2c), DrinkCatalogRow (B2b), ProfileDrawer, AdminBanner, AufladungsAnfrageRow (B2f), MitgliederSaldoRow (B2g), KassenBestandCard (B2i), KassenTransaktionRow (B2i), EinkaufSheet (B2i), LeitungKassenView (B2j).

---

## 9. DSGVO

### Mindestpaket (vor Live-Gang — Phase B7)
- Datenschutzerklärung auf Login-Seite
- „Meine Daten exportieren" (JSON-Download)
- „Account löschen" (Soft-Delete mit 30-Tage-Frist, dann Hard-Delete)
- AVV mit Hosting-Provider (ab Hetzner)
- Verarbeitungsverzeichnis als Markdown im Repo

### Position zu Sortendaten
Keine persönlichen Trinkpräferenzen pro User — Trinkjournal sortenagnostisch. Sortenstatistiken nur App-weit aggregiert, ohne User-Bezug.

### Leitung-Einsicht (NEU Update 7)
Die Leitung-Rolle sieht **keine personenbezogenen** Finanzdaten: keine Einzelsalden, keine Trinkjournale. Nur aggregierte Kassen- und Guthaben-Summen plus die (ohnehin anonymen) Kassen-Transaktionen. Damit ist die Einsicht datenschutzrechtlich unkritisch. Im Verarbeitungsverzeichnis (B7) wird die Rolle dennoch erwähnt.

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
| **B2i** | Kassenführung: Kassen-Screen, Einkauf, Einlage, Auslage, Spende, Korrektur, Deckung | 1-2 Tage | offen |
| **B2j** | **Leitung-Rolle: Recht vergeben (Admin) + Read-only-Kassen-Einsicht** | 1 Tag | offen |
| **B3** | Sortenstatistik (Admin + Leitung) | 1 Tag | offen |
| **B4** | Trinkjournal + Achievements + 30-Tage-Verlauf | 2-3 Tage | offen |
| **B5** | Design-Politur (Dark-Bar überall) | 1-2 Tage | offen |
| **B6** | PWA + Letzter Schliff | 2-3 Tage | offen |
| **B7** | DSGVO (DSE, Export, Soft-Delete, Hard-Delete-Job, VVZ inkl. Leitung) | 2-3 Tage | offen |
| **B8** | Deploy Hetzner (SQLite → Postgres, Subdomain, AVV) + Testphase | 5-7 Tage | offen |
| **B9** | Go-Live | 1 Tag | offen |
| **Gesamt** | | **~6-8 Wochen** | |

**Begründungen zur Reihenfolge:**
- **B2a vorne:** Invite-UI zuerst, damit echte Mitglieder zum Testen anlegbar sind
- **B2e/B2f:** Aufladungen erzeugen gekoppelte Kassen-Buchungen — die `KassenTransaktion`-Entität muss spätestens hier im Schema sein (Anlage in B2e)
- **B2i nach den Aufladungen:** der Kassen-Screen visualisiert, was B2e/B2f erzeugen; Einkauf/Einlage/Auslage/Spende/Korrektur kommen hier dazu
- **B2j nach B2i:** die Leitung-Einsicht zeigt den Kassen-Screen read-only — der muss also vorher existieren
- **B3 vor B4:** Sortenstatistik = Verwalter-/Leitung-MVP, Trinkjournal = Mitglied-Bonus
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
- **Keine Bar/PayPal-Trennung im Kassen-Bestand** — „Verwalter hält" ist ein Topf (verworfen mit Update 6)
- **Getränk-Buchen bewegt kein Kassen-Geld** — nur die Mitglieder-Verbindlichkeit
- **Keine Sorten-Erfassung beim Einkauf** — nur Betrag + Notiz
- **Leitung sieht keine Einzelsalden und keine Trinkjournale** — nur aggregierte Kassen-Daten

---

## 12. Bekannte Inkonsistenzen aus Phase B1 (zu beheben in B2b)

| Code (B1) | Diese Spec | Bereinigung in |
|---|---|---|
| `User.guthaben` (Int-Feld) | kein Feld, live summiert | B2c |
| `InviteToken` (Modell-Name) | `Invite` | B2b |
| Keine Transaktions-Modelle | `Transaktion`, `AufladungsAnfrage` | B2b/B2c/B2f |
| Keine Kassen-Modelle | `KassenTransaktion` | B2e (Schema), B2i (Screen) |
| Kein `isLeitung`-Flag | `User.isLeitung` | B2j |

Außerdem: Form-Field-IDs auf Login-Page fehlen (DevTools-Warning) → B5 Politur.

---

## 13. Änderungshistorie (kompakt)

**Update 7 (04.06.2026):** Schuld-Modell für die Kasse + Leitung-Rolle
- Kassen-Modell umgebaut: statt Bar/PayPal-Trennung jetzt „Verwalter hält" (ein Topf, darf negativ werden) + „Bar-Vereinskasse" (physische Box, nachzählbar/korrigierbar)
- Verwalter ist Durchgangsstation: Einzahlungen gehen erst an ihn, dann via Einlage in die Box
- Neue KassenTransaktion-Typen: EINZAHLUNG, EINLAGE_BOX, EINKAUF (Quelle wählbar), AUSLAGE (Privattasche, darf negativ), SPENDE (Gast/Spende, Konto wählbar), KORREKTUR
- Ist/Soll-Abgleich für die Box erlaubt (Nachzählen + korrigieren)
- Einkauf erfasst nur Betrag + Notiz, keine Sorten
- Neue Rolle „Leitung" (`isLeitung`): reine Kassen-Einsicht für 3-4 Personen (Leitung + Kassier), keine Schreibrechte, keine Einzelsalden, keine Trinkjournale
- Deckung = Vereinsvermögen (Verwalter hält + Box) − Summe Mitglieder-Guthaben
- Neue Phasen B2i (Kassen-Screen, erweitert) und B2j (Leitung-Rolle)

**Update 6 (26.05.2026) — VERWORFEN, nie gebaut:**
- Hatte Bar/PayPal als zwei Kassen-Unterkonten mit Umbuchung dazwischen vorgesehen
- Durch Update 7 ersetzt, bevor Code entstand: Bar/PayPal-Trennung interessiert in der Praxis nicht; relevanter ist „beim Verwalter" vs „in der Box" (Schuld-Modell)
- Existierte nur als Doku-Stand (Commit ea1c92a), floss nie in den Code

**Update 5 (26.05.2026):** Klärungs-Konsolidierung nach Phase-1-Smoke-Test
- Komplette Neufassung nach 5 Klärungs-Schichten
- Neu: `AufladungsAnfrage`, `Transaktion.stornoVonId`, Live-Guthaben statt gespeichertem Feld
- 5-Min-Stornofenster, jederzeitiges Admin-Storno, PayPal via paypal.me-Link, Audio-Warning verworfen

**Update 4 (21.05.2026):** Flexibler Getränkekatalog + DSGVO-Reformulierung
- Single-Drink aus Update 3 zurückgenommen, CRUD-Katalog, feste Kategorien, `isActive`, `preisAtKauf` eingefroren

**Update 3 (20.05.2026, verworfen durch Update 4):**
- Versuch: einzelnes Getränk zu 1,50 € statt Katalog, rückgängig gemacht

**Update 2 (20.05.2026):** Design-Integration (Dark-Bar, Fraunces, Glass-Primitives)

**Update 1 (20.05.2026):** Architektur final (SQLite, kein Leaderboard, Admin-Invite, Hetzner)
