# Konfiguration — Bergwacht Getränkekasse

**Stand:** 18.06.2026 (Update 17: PayPal-Umbau — betraglose Anfrage, Verwalter bucht echte Summe, nur Zuständiger bestätigt, WhatsApp-Benachrichtigung; Lastverteilung ohne Betrag)
**Status:** 🟢 Phase B1 abgeschlossen + verifiziert, Phase B2 vorbereitet

---

## 1. Zweck

Web-App zur Digitalisierung der Bergwacht-Zollernalb-Getränkekasse. Ersetzt die analoge Bar-Kasse + Strichliste. Mitglieder loggen sich ein, sehen ihr Guthaben, buchen Getränke aus dem Katalog ab. Aufladung läuft über PayPal (paypal.me-Link, manuell vom zuständigen Verwalter bestätigt) oder Bargeld (Verwalter trägt manuell ein). Negatives Guthaben ist erlaubt.

**Kassenführung (Schuld-Modell):** Die App führt das Vereinsgeld als eigene Buchhaltung — getrennt nach dem, was die einzelnen Verwalter halten, und dem, was in der physischen Bar-Vereinskasse liegt.

**Multi-Verwalter (Update 8):** Die Kassenverwaltung ist auf mehrere Personen verteilt — typischerweise die, die ohnehin oft Getränke einkaufen. PayPal-Einzahlungen werden automatisch dem Verwalter zugeteilt, der aktuell am wenigsten hält. So verteilt sich das gehaltene Vereinsgeld gleichmäßig und die Bucherei zwischen Einkäufern und Kasse wird minimiert.

**Transparenz:** Die Rolle „Leitung" erhält reine Einsicht auf die Kassen-Ebene (lesend), damit Leitung und Kassier die Finanzen nachvollziehen können.

**Größenordnung:** ca. 30 Mitglieder. Mehrere Verwalter (Einkäufer), 3-4 Personen mit Leitung-Einsicht.

---

## 2. Stack

| Bereich | Entscheidung |
|---|---|
| Frontend | React 18 + Vite + TypeScript + TailwindCSS |
| Backend | Node.js 20+ + Express + TypeScript + Prisma ORM |
| Datenbank | SQLite (Dev + Phasen B1-B7) → PostgreSQL (ab Phase B8 Deploy) |
| Auth | Magic-Link-Invite + Passwort (argon2) + JWT in Cookies |
| Email | Dev: Konsolen-Output · Prod: TBD (z.B. Resend) |
| PWA | **umgesetzt (B6)** — installierbar, standalone, BergMark-Icons, `vite-plugin-pwa` (autoUpdate); SW nur im Secure Context (Handy-Install voll ab HTTPS/B8) |
| Hosting Phase 1-7 | Lokal in Docker-Sandbox auf Mac Mini |
| Hosting ab Phase 8 | Hetzner CX22 dediziert |

---

## 3. Identitäten

| Rolle | Person(en) | Notiz |
|---|---|---|
| Verwalter (Admin) | Laura Sauer + weitere Einkäufer | jeder mit eigenem paypal.me-Link |
| Leitung (Einsicht) | 3-4 Personen (Leitung + Kassier) | wird vom Verwalter festgelegt |

**Erst-Admin:** Laura Sauer (laura_sauer@gmx.de) — via Seed angelegt, kann weitere Verwalter ernennen.

**Domain:** `getraenke.einfall.app` (Subdomain von `einfall.app`, anzulegen vor Phase B8)

**PayPal:** Jeder Verwalter hinterlegt seinen eigenen paypal.me-Link in seinem Profil (vor Phase B2k).

---

## 4. Rollen & Berechtigungen

Drei Rollen, gesteuert über zwei Flags am User: `isAdmin` (Verwalter) und `isLeitung` (Einsicht).

### Mitglied kann
- Login via Magic-Link (Initial-Setup) und danach via Email + Passwort
- Eigenes Guthaben sehen
- Getränk aus aktiven Katalog-Einträgen buchen → Confirm → Guthaben-Reduktion
- Eigene Buchung innerhalb **5 Minuten** stornieren
- PayPal-Aufladungs-Anfrage stellen — sieht den aktuell **zuständigen** Verwalter-Link
- Privates Trinkjournal mit Achievements und 30-Tage-Verlauf sehen
- Eigene Transaktions-Historie sehen
- Eigene Daten exportieren (DSGVO, Phase B7), eigenes Konto soft-deleten

### Leitung kann — reine Einsicht, keine Schreibrechte
Alles vom Mitglied plus **lesenden** Zugriff auf die Kassen-Ebene:
- Gesamtbestand sehen (alle Verwalter-Töpfe + Bar-Vereinskasse)
- Bestand pro Verwalter sehen (wer hält wie viel)
- Deckungs-Kennzahl sehen
- Alle Kassen-Transaktionen sehen (mit Beträgen, Vermerken, zugehörigem Verwalter)
- Gesamtsumme aller Mitglieder-Guthaben (**eine Zahl, nicht pro Person**)
- Sortenstatistik (anonym aggregiert)

**Leitung darf NICHT:** einzelne Mitglieder-Salden sehen, Trinkjournale sehen, irgendetwas eintragen/ändern/stornieren/bestätigen.

### Verwalter (Admin) kann
Alles vom Mitglied plus volle Schreibrechte:
- Neue Mitglieder einladen, weitere Verwalter ernennen, Leitung-Recht vergeben/entziehen
- Eigenen paypal.me-Link pflegen
- Bargeld-Aufladung manuell eintragen (gekoppelte Kassen-Einzahlung auf den eigenen Topf)
- **PayPal-Anfragen bestätigen/ablehnen — nur die ihm zugewiesenen** (siehe 6.5)
- Drink-Katalog pflegen
- Übersicht aller Mitglieder mit Saldo sehen, Guthaben korrigieren, Transaktionen stornieren (alle, mit Pflicht-Notiz)
- App-weite Sortenstatistik sehen
- **Kassenführung:** Einkäufe abrechnen, Entnahmen buchen, Geld in die Box legen, Spenden eintragen, Bar-Vereinskasse korrigieren (jeweils auf den eigenen Topf bzw. die Box)

**Alle Verwalter sehen alles und dürfen alles** — einzige Ausnahme: PayPal-Anfragen bestätigt nur der zugewiesene Verwalter.

---

## 5. Datenmodell

Fünf Entitäten. Beträge **immer in Cent als `Int`**, niemals als `Float`.

Zwei Buchungs-Ebenen:
- **Mitglieder-Ebene** (`Transaktion`): Guthaben einzelner Mitglieder
- **Kassen-Ebene** (`KassenTransaktion`): Vereinsgeld, getrennt nach Verwalter-Töpfen und Bar-Vereinskasse

> **Enum-Hinweis (Update 15):** SQLite unterstützt keine Prisma-Enums. „Enum"-Felder
> sind real **`String`**-Spalten mit Zod-Validierung (`src/domain/*`). Unten als
> „String (validiert: …)" geführt. Diese §5 ist gegen das reale `schema.prisma` abgeglichen.

### 5.1 User

| Feld | Typ | Notiz |
|---|---|---|
| `id` | String (cuid) | |
| `email` | String, unique | Login-Identifier |
| `firstName` / `lastName` | String | Pflicht |
| `passwordHash` | String, nullable | argon2-Hash, null bis Magic-Link eingelöst |
| `isAdmin` | Boolean, default false | Verwalter-Flag (volle Schreibrechte) |
| `isLeitung` | Boolean, default false | Leitung-Flag (reine Kassen-Einsicht) |
| `paypalMeLink` | String, nullable | paypal.me-Link des Verwalters (nur bei Admins relevant) — NEU Update 8 |
| `whatsappNummer` | String, nullable | WhatsApp-Nummer des Verwalters, nur Ziffern (internationales Format ohne `+`/Leerzeichen, z.B. `491701234567`) für die `wa.me`-Benachrichtigung; nur bei Admins relevant — NEU Update 17 |
| `isActive` | Boolean, default true | Soft-Delete-/Aktiv-Marker (`false` = entfernt/deaktiviert; kein Login, raus aus Aggregaten) — Doku-Fix Update 13 |
| `createdAt` / `updatedAt` | DateTime | Standard-Audit |

**Kein gespeichertes `guthabenCent`-Feld.** Guthaben live aus Transaktionen summiert.

### 5.2 Drink

| Feld | Typ | Notiz |
|---|---|---|
| `id` | String (cuid) | |
| `name` | String | „Cola", „Bier klein" |
| `preisCent` | Int | Aktueller Verkaufspreis |
| `icon` | String, nullable | optional; seit B5c kein Emoji-Eingabefeld mehr, Feld bleibt |
| `kategorie` | String (validiert) | `alkoholfrei`, `alkoholisch`, `sonstiges` (fest) |
| `marke` | String, nullable | optional; Marke/Brauerei (z.B. „Coca-Cola", „Augustiner") — NEU Update 16 |
| `volumenMl` | Int, nullable | optional; Gebindegröße in Millilitern (z.B. 500, 330, 200) — NEU Update 16 |
| `bildDataUrl` | String, nullable | optional; komprimiertes Etikett-JPEG als Data-URL (`data:image/jpeg;base64,…`), clientseitig auf 400×400 (~30–50 KB) komprimiert, lebt in der DB; **nicht im Daten-Export** — NEU Drink-Fotos |
| `isActive` | Boolean, default true | Soft-Disable statt Hard-Delete |
| `createdAt` / `updatedAt` | DateTime | |

**Anzeige (Update 16):** Name fett + gedämpfte Subzeile „Marke · Größe" (nur vorhandene Teile,
mit „ · " verbunden; keine Subzeile wenn beides leer). `volumenMl` wird als deutsche Liter-Angabe
gezeigt (`formatVolumen`: 500→„0,5 l", 330→„0,33 l", 1000→„1 l"). Drink-Listen sind je
Kategorie deutsch-alphabetisch sortiert (`localeCompare 'de'`, Umlaute + Groß/Klein egal).

### 5.3 Transaktion (Mitglieder-Ebene)

Jede Bewegung am Guthaben eines Mitglieds. **Niemals löschen** — Audit-Trail.

| Feld | Typ | Notiz |
|---|---|---|
| `id` | String (cuid) | |
| `userId` | String, FK → User | |
| `typ` | String (validiert) | `KAUF`, `AUFLADUNG_PAYPAL`, `AUFLADUNG_BARGELD`, `KORREKTUR`, `STORNO` |
| `betragCent` | Int | Positiv bei Aufladung/Korrektur+, negativ bei Kauf |
| `drinkId` | String, FK → Drink, nullable | Nur bei `KAUF` |
| `preisAtKaufCent` | Int, nullable | Eingefroren bei `KAUF` |
| `stornoVonId` | String, FK → Transaktion, nullable | Bei `STORNO`: Verweis auf Original |
| `notiz` | String, nullable | Pflicht bei `KORREKTUR`, `AUFLADUNG_BARGELD`, `STORNO` |
| `erstelltVonId` | String, FK → User | Wer hat es ausgelöst (welcher Verwalter / User selbst) |
| `kassenTransaktionId` | String, FK → KassenTransaktion, nullable | Bei Aufladungen: gekoppelte Kassen-Buchung |
| `createdAt` | DateTime | |

### 5.4 Invite

**Schlankes Modell** — der Invite ist nur ein Token, der auf einen User zeigt; Email,
Namen **und Rollen leben am User**, nicht am Invite.

| Feld | Typ | Notiz |
|---|---|---|
| `id` | String (cuid) | |
| `tokenHash` | String, unique | SHA-256 des Klartext-Tokens |
| `userId` | String, FK → User (onDelete: Cascade) | der eingeladene/betroffene User |
| `createdAt` | DateTime, default now | |
| `expiresAt` | DateTime | 7 Tage |
| `redeemedAt` | DateTime, nullable | gesetzt beim Einlösen |

**Rollen-Einladung (Account-B):** „Direkt mit Recht einladen" setzt `isAdmin`/`isLeitung`
**am User beim Anlegen** (`POST /admin/invite`, nur create-Zweig) — nicht am Invite; die
Redemption setzt nur das Passwort. Der **Passwort-Reset** (Account-B) erzeugt einfach einen
weiteren Token-Invite für den bestehenden User.

**Hinweis:** B1-Code nennt diese Entität `InviteToken`. Umbenennung auf `Invite` in B2b.

### 5.5 AufladungsAnfrage

PayPal-Aufladungs-Anfrage mit State-Machine und Verwalter-Zuweisung.

| Feld | Typ | Notiz |
|---|---|---|
| `id` | String (cuid) | |
| `userId` | String, FK → User | Wer hat gestellt |
| `betragCent` | Int, **nullable** | **NULL bei der betraglosen Anfrage** (Mitglied überweist selbst frei gewählt). Beim Bestätigen setzt der zuständige Verwalter die tatsächlich überwiesene Summe (Int > 0) — die wird gebucht und hier zur Doku gehalten. — geändert Update 17 |
| `status` | String (validiert), default `OFFEN` | `OFFEN`, `BESTAETIGT`, `ABGELEHNT` |
| `zugewiesenerVerwalterId` | String, FK → User (required) | zuständiger Verwalter (per Lastverteilung); bei Wegfall (Demote/Remove) auf den least-loaded aktiven Verwalter umgehängt (Cleanup) — NEU Update 8 |
| `requestedAt` | DateTime | |
| `decidedAt` | DateTime, nullable | |
| `decidedById` | String, FK → User, nullable | Welcher Verwalter hat entschieden (= zugewiesener) |
| `adminNotiz` | String, nullable | Optional |
| `transaktionId` | String, FK → Transaktion, nullable | Bei `BESTAETIGT`: erzeugte Aufladungs-Transaktion |

### 5.6 KassenTransaktion (Kassen-Ebene) — Schuld-Modell + Multi-Verwalter

Jede Bewegung am Vereinsgeld. `konto` trennt Verwalter-Töpfe von der Box; `verwalterId` sagt welcher Verwalter. **Niemals löschen** — Audit-Trail.

| Feld | Typ | Notiz |
|---|---|---|
| `id` | String (cuid) | |
| `typ` | String (validiert) | `EINZAHLUNG`, `EINLAGE_BOX`, `EINKAUF`, `ENTNAHME`, `SPENDE`, `KORREKTUR` (AUSLAGE gestrichen, Update 9) |
| `konto` | String (validiert) | `VERWALTER` oder `BOX` |
| `verwalterId` | String, FK → User, nullable | Welcher Verwalter-Topf. Gesetzt wenn `konto=VERWALTER`, null bei `BOX` — NEU Update 8 |
| `betragCent` | Int | Positiv = Zufluss, negativ = Abfluss |
| `notiz` | String | **Pflicht bei JEDER Kassen-Bewegung** (Update 8) |
| `transaktionId` | String, FK → Transaktion, nullable | Bei `EINZAHLUNG`: gekoppelte Mitglieder-Aufladung |
| `einlageGegenId` | String, FK → KassenTransaktion, nullable | Bei `EINLAGE_BOX`: Verweis auf Gegenbuchung |
| `erstelltVonId` | String, FK → User | Immer ein Admin |
| `createdAt` | DateTime | |

**Typen-Logik im Detail:**

| Typ | Konto | Vorzeichen | Bedeutung |
|---|---|---|---|
| `EINZAHLUNG` | VERWALTER | + | Mitglied zahlt ein (bar/PayPal), Geld geht an den zuständigen Verwalter. Gekoppelt. |
| `EINLAGE_BOX` | VERWALTER / BOX | −/+ | Verwalter legt gehaltenes Geld in die Box. Zwei Zeilen, verknüpft über `einlageGegenId`. |
| `EINKAUF` | VERWALTER **oder** BOX | − | Getränke-Einkauf. Quelle wählbar. |
| `ENTNAHME` | VERWALTER **oder** BOX | − | Vereinsfremde Ausgabe (z.B. „Waschstraße Einsatzfahrzeuge"). Getrennt vom Getränke-Einkauf. — NEU Update 8 |
| `SPENDE` | VERWALTER **oder** BOX | + | Spende/Gast-Einzahlung. Konto wählbar (ein Verwalter oder Box). — erweitert Update 8 |
| `KORREKTUR` | VERWALTER **oder** BOX | ± | Manuelle Korrektur, z.B. Box nach Nachzählen. |

### 5.7 Relationen-Übersicht

```
User 1 ──n Transaktion (userId / erstelltVonId)
User 1 ──n AufladungsAnfrage (userId / decidedById / zugewiesenerVerwalterId)
User 1 ──n Invite (erstelltVonId)
User 1 ──n KassenTransaktion (erstelltVonId / verwalterId)
Drink 1 ──n Transaktion (drinkId, optional)
Transaktion 1 ──1 Transaktion (stornoVonId, optional, reflexiv)
Transaktion 1 ──1 KassenTransaktion (kassenTransaktionId, optional)  ← Kopplung
AufladungsAnfrage 1 ──1 Transaktion (transaktionId, optional)
KassenTransaktion 1 ──1 KassenTransaktion (einlageGegenId, optional, reflexiv)
```

---

## 6. Geschäftslogik

### 6.1 Mitglieder-Guthaben

Guthaben = `SUM(transaktionen.betragCent) WHERE userId = X`. Live, kein Feld, „cannot be wrong by design".

### 6.2 Buchen-Flow

1. Mitglied wählt Drink, Confirm-Sheet zeigt neues Guthaben (rot falls negativ)
2. Transaktion `KAUF`, `preisAtKaufCent` eingefroren, `betragCent=-Preis`
3. 5 Min storno-fähig

**Buchen bewegt nichts auf Kassen-Ebene** — das Geld kam beim Einzahlen herein.

### 6.3 Storno-Flow

5-Min-Fenster für Mitglieder (eigene KAUF), jederzeit für Admin (alle, Pflicht-Notiz). Storno einer gekoppelten Aufladung macht auch die Kassen-Buchung per Gegen-KORREKTUR rückgängig (auf demselben Verwalter-Topf). Storno-Transaktionen selbst sind nicht stornierbar.

### 6.4 Aufladung — Bargeld

1. Verwalter → Mitglied X → „Bargeld-Aufladung": Betrag + Pflicht-Vermerk
2. Zwei gekoppelte Buchungen:
   - Mitglieder-`Transaktion`: `AUFLADUNG_BARGELD`, `+X`
   - Kassen-`KassenTransaktion`: `EINZAHLUNG`, `konto=VERWALTER`, `verwalterId=` der eintragende Verwalter, `+X`
3. Der Topf des eintragenden Verwalters steigt.

### 6.5 Aufladung — PayPal (betraglos, Verwalter bucht echte Summe) — überarbeitet Update 17

**Warum:** Der frühere Flow ließ das Mitglied einen Betrag vorwählen, der gutgeschrieben wurde — unabhängig vom real Überwiesenen (Vorauswahl 20 €, überwiesen 10 € → 20 € gutgeschrieben). Jetzt zählt nur die echte Summe, eingegeben vom Verwalter, der den Geldeingang auf *seinem* PayPal sieht.

1. Mitglied öffnet Aufladen-Tab → sieht **nur den paypal.me-Link des aktuell zuständigen Verwalters** (kein Betrag vorwählen)
2. **Zuständig = Verwalter mit dem niedrigsten Topf** (mit paypal.me-Link). Berechnung siehe 6.9.
3. Mitglied **überweist selbst einen frei gewählten Betrag** an `https://paypal.me/{link-des-zuständigen-verwalters}` (ohne Betrag im Link — gibt ihn in PayPal ein)
4. Mitglied tippt **„Überweisung erledigt — Verwalter benachrichtigen"**:
   - **Beim Abschicken:** **betraglose** `AufladungsAnfrage` (`betragCent=null`) mit `status=OFFEN` und `zugewiesenerVerwalterId=` dem aktuell zuständigen Verwalter.
   - **WhatsApp:** App öffnet `https://wa.me/{whatsappNummer}?text=...` mit vorgefertigtem Text („Hallo [Verwalter], ich habe per PayPal für die Getränkekasse überwiesen, bitte freischalten. Grüße [Mitglied]"). Hat der Verwalter **keine** `whatsappNummer` → kein WhatsApp-Button, nur ein Hinweis, ihm Bescheid zu geben.
5. Der **zugewiesene Verwalter** sieht die Anfrage in seiner Liste (nur seine eigenen, §7.2)
6. **Bestätigen (nur der Zugewiesene — harter Backend-Guard, sonst 403):** Verwalter gibt die **tatsächlich überwiesene Summe** ein (`betragCent`, Int > 0, Pflicht). Daraus zwei gekoppelte Buchungen:
   - Mitglieder-`Transaktion`: `AUFLADUNG_PAYPAL`, `+X`
   - Kassen-`KassenTransaktion`: `EINZAHLUNG`, `konto=VERWALTER`, `verwalterId=` zugewiesener Verwalter, `+X`
   - `status=BESTAETIGT`, `betragCent=X` (zur Doku), `transaktionId` verknüpft
7. **Ablehnen (nur der Zugewiesene, sonst 403):** `status=ABGELEHNT`, optional Notiz. Keine Buchung.

### 6.6 Negatives Guthaben

Erlaubt, unbegrenzt, visuell rot, kein Audio, kein Hard-Stop. Confirm-Sheet warnt bei Minus.

### 6.7 Account-Lifecycle

Soft-Delete über `isActive=false` (Doku-Fix Update 13 — es gibt **kein** `deletedAt`-Feld): kein Login mehr, raus aus aktiver Liste + Aggregaten (Statistik/Mitglieder-Summe/Deckung, Ausschluss via User-Relation). Mitglieder-Transaktionen **bleiben** erhalten; gekoppelte Kassen-Buchungen bleiben, ihre Kopplung wird auf null gesetzt (Bestand unverfälscht). Hard-Delete nach 30 Tagen (B7, optional). Keine Gast-Konten.

**Verwalter-Austritt:** Wird ein Verwalter soft-gelöscht, bleiben seine Kassen-Transaktionen erhalten (das Geld war real). Sein Topf-Saldo sollte vorher durch Einlage in die Box oder Übergabe an einen anderen Verwalter auf 0 gebracht werden — Prozess-Hinweis, kein automatischer Mechanismus.

### 6.8 Kassenführung (Schuld-Modell mit mehreren Verwaltern)

**Konten, alle live summiert:**
- **Verwalter-Topf je Verwalter** = `SUM(kassenTransaktionen.betragCent) WHERE konto=VERWALTER AND verwalterId=V`. Darf negativ werden.
- **Bar-Vereinskasse** = `SUM(...) WHERE konto=BOX`.
- **Vereinsvermögen (Gesamt)** = Summe aller Verwalter-Töpfe + Bar-Vereinskasse.

**Deckung** = Vereinsvermögen − `SUM(alle Mitglieder-Guthaben)`. Positiv = Puffer/Marge. Negativ = Warnsignal. Rot bei negativ.

**Geldflüsse:**

| Aktion | Auslöser | Effekt |
|---|---|---|
| Mitglied lädt auf (bar/PayPal) | Admin (6.4/6.5) | `EINZAHLUNG`, `konto=VERWALTER`, `verwalterId=` eintragender/zugewiesener Verwalter, `+X` |
| Geld in die Box legen | Admin | `EINLAGE_BOX`: `VERWALTER −X` (eigener Topf) + `BOX +X`, verknüpft |
| Getränke-Einkauf | Admin | `EINKAUF`, Quelle (eigener Topf ODER Box), `−X`, Pflicht-Vermerk |
| Vereinsfremde Ausgabe | Admin | `ENTNAHME`, Quelle (eigener Topf ODER Box), `−X`, Pflicht-Vermerk (z.B. „Waschstraße") |
| Spende / Gast | Admin | `SPENDE`, Konto wählbar (ein Verwalter ODER Box), `+X`, Pflicht-Vermerk |
| Korrektur | Admin | `KORREKTUR`, Konto wählbar, `±X`, Pflicht-Vermerk |

**Jede Kassen-Bewegung braucht einen Pflicht-Vermerk** (freies Notiz-Feld, z.B. „Getränkemarkt 24.05.", „Waschstraße Einsatzfahrzeuge", „Bar aufgeladen Sascha").

**Einkauf ≠ Entnahme:** `EINKAUF` ist Getränke-Nachschub, `ENTNAHME` ist alles andere (vereinsfremde Ausgaben). Sauber getrennt für die Auswertung.

**Ist/Soll-Abgleich:** nur für die Box (nachzählbar, per KORREKTUR). Verwalter-Töpfe sind Vertrauens-/Schuld-Größen, kein Abgleich.

### 6.9 Lastverteilung — geringste Schuld zuerst (NEU Update 8)

**Ziel:** Das gehaltene Vereinsgeld gleichmäßig auf alle Verwalter verteilen. Wer viel einkauft (niedriger/negativer Topf), bekommt automatisch die nächsten Einzahlungen.

**Zuständiger Verwalter für die nächste PayPal-Aufladung (überarbeitet Update 17 — Anfragen sind betraglos):**
- Kandidaten = aktive Verwalter **mit nicht-leerem paypal.me-Link** (ohne Link gibt es nichts zum Überweisen).
- **Primär:** der mit dem **niedrigsten Verwalter-Topf** (`SUM KassenTransaktion betragCent WHERE konto=VERWALTER AND verwalterId=V`). Wer viel einkauft (niedriger/negativer Topf) bekommt die nächsten Einzahlungen.
- **Tie-Break 1 (gleicher Topf):** die **wenigsten offenen (`OFFEN`) zugewiesenen Anfragen** — gegen Klumpung, wenn mehrere Mitglieder kurz hintereinander aufladen (der frühere „Summe offener Anfragen"-Term entfällt, weil Anfragen keinen Betrag mehr tragen; gezählt wird die **Anzahl**).
- **Tie-Break 2 (auch gleiche Anzahl):** alphabetisch nach Vorname.

**Zeitpunkt der Zuteilung:** beim **Abschicken** der Anfrage (nicht beim Öffnen des Tabs) — bloßes Anschauen verbraucht keine Zuteilung.

**Berechnung ist live, kein gespeicherter Cursor** — der zuständige Verwalter ergibt sich immer aus dem aktuellen Stand. „Cannot be wrong by design."

**Sonderfall ein Verwalter:** Gibt es nur einen Admin mit paypal.me-Link, ist immer dieser zuständig — die Logik degeneriert sauber zum Einzel-Verwalter-Fall.

**Wegfall eines Verwalters (Demote/Remove):** seine offenen Anfragen werden dem nach gleicher Regel least-loaded verbliebenen aktiven Verwalter neu zugewiesen (bleiben `OFFEN`/bestätigbar).

---

## 7. UI/UX

### 7.1 Bottom-Nav (Mitglied) — 3 Tabs (Update 11)

Icons sind **lucide-react Line-Icons** (Update 12), aktiver Tab in **Teal**, inaktiv in Ink-mute.

| Tab | Icon (lucide) | Inhalt |
|---|---|---|
| Theke | `Home` | Guthaben groß, Quick-Buchung-CTA |
| Aufladen | `Wallet` | **PayPal-Link des zuständigen Verwalters** öffnen (kein Betrag vorwählen), „Überweisung erledigt — Verwalter per WhatsApp benachrichtigen", Bargeld-Hinweis — überarbeitet Update 17 |
| Verlauf | `History` | Historie + Trinkjournal + Achievements |

**Buchen** ist **kein** Bottom-Nav-Tab mehr, sondern ein **Unter-Screen** (aktive Getränke nach Kategorie, Confirm-Sheet), erreichbar über den **Theke-CTA „Getränk buchen"** (Route `/buchen` bleibt, Bottom-Nav bleibt sichtbar, sticky Zurück oben). Admin-/Leitung-Bereiche via Profil-Drawer, je nach Rolle. Unter-Screens (Buchen, Admin, Kasse, Leitung, Statistik, Profil …) haben einen **sticky Zurück-Header** (Zurück-Pfeil = `ChevronLeft`).

### 7.2 Admin-Bereich (jeder Verwalter)

Card-Labels mit **lucide-Line-Icons** (Update 12, Teal-Akzent) statt Emoji:

- `Users` — Mitglieder (Salden, Detail, Korrektur, Recht vergeben)
- `UserPlus`/`Mail` — Mitglied einladen / Verwalter ernennen
- `Beer` — Drink-Katalog
- `Inbox` — Aufladungs-Anfragen — **gefiltert auf die eigenen zugewiesenen** (betraglos; Bestätigen verlangt die Eingabe der **tatsächlich überwiesenen Summe**, nur der Zugewiesene darf — Update 17)
- `Banknote` — Bargeld-Aufladung
- `Landmark` — Kasse: Gesamtbestand, Töpfe je Verwalter, Box, Deckung, Aktionen (Einkauf, Entnahme, Einlage, Spende, Korrektur), Kassen-Historie
- `BarChart3` — Sortenstatistik
- `User` — eigenes Verwalter-Profil: paypal.me-Link **und WhatsApp-Nummer** pflegen (Update 17)

### 7.3 Leitung-Bereich (read-only)

- Kassen-Übersicht: Gesamtbestand, Töpfe je Verwalter, Box, Deckung
- Gesamtsumme Mitglieder-Guthaben (eine Zahl)
- Kassen-Historie (read-only)
- Sortenstatistik (read-only)
- Keine Aktionen, keine Einzelsalden, keine Trinkjournale

### 7.4 Trinkjournal & Achievements

Privat, nur User selbst (auch vor Leitung). Hero-Monatszahl, Stat-Strip, 30-Tage-Verlauf, Achievements.

### 7.5 Sortenstatistik (Admin + Leitung)

App-weit aggregiert, anonym. Zeitfilter, pro Drink Anzahl + Umsatz.

### 7.6 Kassen-Screen (Admin)

- **Bestands-Hero:** Vereinsvermögen groß
- **Töpfe-Liste:** jeder Verwalter mit seinem aktuellen Stand (eigener hervorgehoben), darunter Bar-Vereinskasse
- **Deckungs-Card:** rot bei negativ, mit Erklär-Text
- **Aktionen:** Einkauf, Entnahme, Einlage in die Box, Spende, Korrektur — jeweils mit Pflicht-Vermerk-Feld
- **Kassen-Historie:** chronologisch, mit Typ, Konto/Verwalter, Betrag, Vermerk

---

## 8. Design-System (B5c „Visual Redirection", Update 10)

**Tokens:** `--bwza-*`. **Fonts:** **Inter** durchgehend (Fraunces entfernt), JetBrains Mono nur für Code. **Stil:** kühl, mehrfarbig, echtes Glass (Backdrop-Blur + Lichtkante) auf dunklem Charcoal-Grund. **Palette:** Teal (Primär/CTA/aktiv), Blau (Info), Gold (offen/Warnung), Grün (Aufladung/bestätigt/positiv), Koralle (Schulden/Storno/Deckung negativ/abgelehnt). Großzahlen leicht (Weight 300), Beträge tabellarisch. **Source of Truth:** `design/README_DESIGN.md` + `design/design-tokens.css`. (Die Design-Pack-v2-Mockups zeigen den abgelösten Amber/Fraunces-Look — nur noch historisch.)

**Primitives** (teils B1, Rest B5): Glass, ShineEdge, BergMark, Avatar, TopBar, BottomNav, GlassButton, GlassInput, PasswordInput, StatCard, Flash, EmptyState, Skeleton, DrinkPicker (B2b), DrinkConfirm (B2c), DrinkCatalogRow (B2b), ProfileDrawer, AdminBanner, AufladungsAnfrageRow (B2f), MitgliederSaldoRow (B2g), KassenBestandCard (B2i), KassenTransaktionRow (B2i), EinkaufSheet (B2i), VerwalterTopfRow (B2k), LeitungKassenView (B2j).

---

## 9. DSGVO

### Mindestpaket (vor Live-Gang — Phase B7)
DSE auf Login, JSON-Export, Account-Soft-Delete (30-Tage-Frist), AVV ab Hetzner, Verarbeitungsverzeichnis als Markdown.

### Position zu Sortendaten
Keine persönlichen Trinkpräferenzen. Trinkjournal sortenagnostisch. Sortenstatistik nur aggregiert.

### Leitung-Einsicht
Keine personenbezogenen Finanzdaten (keine Einzelsalden, keine Trinkjournale). Nur aggregierte Kassen- und Guthaben-Summen + Kassen-Transaktionen. Im VVZ erwähnt.

### Datenexport-Regel
- ✅ Eigene Buchungen inkl. Drink-Name
- ❌ Aggregierte Statistiken anderer, soft-deleted Transaktionen anderer
- **Kassen-Daten** = Vereinsbuchhaltung ohne personenbezogenen Mitglieder-Bezug (außer `erstelltVonId`/`verwalterId`=Admin) → nicht Teil des Mitglieder-Exports

---

## 10. Phasen-Roadmap

Phase B1 abgeschlossen. Ab B2 feinere Sub-Phasen. Das Datenmodell wird **von Anfang an multi-verwalter-fähig** angelegt (User mit `paypalMeLink`, KassenTransaktion mit `verwalterId`), die Zuteilungs-Logik + Multi-Verwalter-UI kommt gebündelt in B2k.

| Phase | Inhalt | Dauer | Status |
|---|---|---|---|
| **B1** | Grundgerüst (Auth + Magic-Link + Admin-Bootstrap via Seed) | 3-4 Tage | ✅ abgeschlossen 25.05.2026 |
| **B2a** | Mitglieder-Invite-UI (Admin) | 0.5-1 Tag | offen |
| **B2b** | Drink-Katalog (Modell + Admin-CRUD) + Naming-Drift-Bereinigung | 1-2 Tage | offen |
| **B2c** | Buchen-Flow + Live-Guthaben | 2 Tage | offen |
| **B2d** | Storno-Flow (5-Min User, jederzeit Admin) | 1 Tag | offen |
| **B2e** | Bargeld-Aufladung (Admin) — Kassen-Schema multi-fähig anlegen (verwalterId) | 1-2 Tage | offen |
| **B2f** | PayPal-Aufladungs-Anfragen (User + Admin) — inkl. gekoppelter Kassen-Buchung | 1-2 Tage | offen |
| **B2g** | Mitglieder-Übersicht + manuelle Guthaben-Korrektur | 1 Tag | offen |
| **B2i** | Kassen-Screen: Töpfe, Box, Deckung, Einkauf, Entnahme, Einlage, Spende, Korrektur | 2 Tage | offen |
| **B2j** | Leitung-Rolle: Recht vergeben + Read-only-Kassen-Einsicht | 1 Tag | offen |
| **B2k** | **Multi-Verwalter: Verwalter ernennen, paypal.me pflegen, Lastverteilung (geringste Schuld), zugewiesene Anfragen** | 2 Tage | offen |
| **B3** | Sortenstatistik (Admin + Leitung) | 1 Tag | offen |
| **B4** | Trinkjournal + Achievements + 30-Tage-Verlauf | 2-3 Tage | offen |
| **B5** | Design-Politur | 1-2 Tage | offen |
| **B6** | PWA + Letzter Schliff | 2-3 Tage | **PWA umgesetzt** (installierbar, standalone, Icons, autoUpdate) — SW voll ab HTTPS/B8 |
| **B7** | DSGVO (DSE, Export, Soft-Delete, Hard-Delete-Job, VVZ) | 2-3 Tage | offen |
| **B8** | Deploy Hetzner (SQLite → Postgres, Subdomain, AVV) + Testphase | 5-7 Tage | offen |
| **B9** | Go-Live | 1 Tag | offen |
| **Gesamt** | | **~7-9 Wochen** | |

**Begründungen:**
- **B2e legt das Kassen-Schema schon multi-fähig an** (`verwalterId`-Feld), damit später keine Migration nötig ist — kostet jetzt fast nichts.
- **B2k nach B2i/B2j:** Lastverteilung + Verwalter-UI bauen auf dem fertigen Kassen-Screen und der Rollen-Logik auf. Eigene Phase, weil eigenständige Logik (Zuteilungs-Algorithmus, Profil-paypal.me, gefilterte Anfragen).
- **B3 vor B4:** Sortenstatistik = Verwalter-/Leitung-MVP, Trinkjournal = Mitglied-Bonus.

---

## 11. Verbotenes / explizit aus dem Scope

- Kein Self-Signup, kein Leaderboard/Bierkönig, kein Lieblings-Drink-Tracking
- Keine User-definierten Drink-Kategorien, kein Audio-Warning, keine PayPal-API (nur paypal.me)
- Keine Gast-Konten, keine Storno-Stornos
- Keine Aufbewahrung gelöschter User-Transaktionen für Statistik
- **Keine Bar/PayPal-Trennung im Kassen-Bestand** — „Verwalter hält" ist pro Person ein Topf (Bar/PayPal-Idee verworfen mit Update 6)
- **Getränk-Buchen bewegt kein Vereinsgeld** — nur die Mitglieder-Verbindlichkeit
- **Keine Sorten-Erfassung beim Einkauf** — nur Betrag + Vermerk
- **Leitung sieht keine Einzelsalden und keine Trinkjournale**
- **Keine manuelle Verwalter-Wahl durch das Mitglied** — die Zuteilung erfolgt automatisch nach geringster Schuld
- **Kein gespeicherter Rotations-Cursor** — Zuständigkeit wird live berechnet

---

## 12. Bekannte Inkonsistenzen aus Phase B1 (zu beheben in B2b/c)

| Code (B1) | Diese Spec | Bereinigung in |
|---|---|---|
| `User.guthaben` (Int-Feld) | kein Feld, live summiert | B2c |
| `InviteToken` (Modell-Name) | `Invite` | B2b |
| Keine Transaktions-Modelle | `Transaktion`, `AufladungsAnfrage` | B2b/c/f |
| Keine Kassen-Modelle | `KassenTransaktion` (multi-fähig) | B2e (Schema), B2i (Screen), B2k (Verteilung) |
| Kein `isLeitung` / `paypalMeLink` | beide auf User | B2e (Schema), B2j/B2k (Logik) |

Außerdem: Form-Field-IDs auf Login fehlen → B5 Politur.

---

## 13. Änderungshistorie (kompakt)

**Update 17 (18.06.2026):** PayPal-Umbau — betraglose Anfrage, echte Summe vom Verwalter, WhatsApp (additive Schema-Änderung)
- **Schema (additiv/nicht-destruktiv):** `User.whatsappNummer String?` (neu) + `AufladungsAnfrage.betragCent`
  `Int` → `Int?` (required→nullable, bestehende Werte bleiben). **Prod braucht ein additives
  `prisma db push` (Backup zuerst).**
- **Member-Flow (§6.5):** keine Betrags-Vorauswahl mehr. Mitglied überweist frei gewählt an den
  paypal.me-Link des Zuständigen, stellt eine **betraglose** `OFFEN`-Anfrage und benachrichtigt
  den Verwalter per **`wa.me`** (vorgefertigter Text). Fallbacks: keine WhatsApp-Nummer → nur
  Hinweis; kein Verwalter mit Link → klarer Hinweis, kein Crash.
- **Admin-Bestätigung (§6.5/§7.2):** **harter Backend-Guard** — nur der Admin mit
  `id===zugewiesenerVerwalterId` darf bestätigen/ablehnen (sonst 403). Bestätigen verlangt die
  **tatsächlich überwiesene Summe** (`betragCent` > 0) → bucht `AUFLADUNG_PAYPAL` + Kassen-
  `EINZAHLUNG` auf den Topf des Zuständigen, setzt `status=BESTAETIGT` + `betragCent` + `transaktionId`.
- **Lastverteilung (§6.9):** ohne Betrag — niedrigster Topf → Tie-Break **Anzahl** offener
  zugewiesener Anfragen → alphabetisch (Vorname).
- **Admin-Profil (§7.2):** WhatsApp-Nummer-Feld (optional, internationales Format, nur Ziffern)
  neben dem paypal.me-Link; gemeinsamer Endpoint `PATCH /admin/me/paypal` (nur mitgeschickte
  Felder ändern). Keine PayPal-API, keine neue Dependency. Bargeld-Aufladung unverändert.

**Update 16 (16.06.2026):** Drink-Erweiterung (additiv, kein Breaking Change)
- **Zwei optionale Felder am Drink:** `marke String?` (Marke/Brauerei) und `volumenMl Int?`
  (Gebindegröße in ml). Beide nullable, **additive** Schema-Änderung → kein Daten-Verlust,
  bestehende Drinks bleiben gültig (`marke`/`volumenMl` = null).
- **Anzeige:** Subzeile „Marke · Größe" unter dem Namen (nur vorhandene Teile; `formatVolumen`:
  500→„0,5 l") in Buchen (DrinkRow + ConfirmSheet) und Admin-Katalog-Zeile.
- **Sortierung:** Drink-Listen je Kategorie deutsch-alphabetisch (`localeCompare 'de'`,
  Umlaute + Groß/Klein egal) — vorher SQLite-Bytevergleich.
- **Validierung:** `volumenMl` ganzzahlig > 0 wenn gesetzt; leere `marke`/`volumenMl: null`
  löschen den Wert. Kein `icon`-Feld umbenannt/gelöscht (bleibt ungenutzt). Keine neue Dependency.
- **Deploy-Hinweis:** Prod braucht ein additives `prisma db push` (vorher DB-Backup) — siehe
  Bündel-Bericht.

**Update 15 (16.06.2026):** Vor-Deploy-Cleanup (kein Verhaltens-Change außer den Guards)
- **Backend-Build deploy-fest:** eigenes `tsconfig.build.json` (nur `src` → kein TS6059),
  `build` = `prisma generate && tsc`, `req.auth`-Typ in dedizierter `src/types/express.d.ts`.
  `pnpm --filter backend build` ist ab jetzt ein echtes Gate.
- **Storno-Admin-Guard** liest den **DB-Stand** (nicht den JWT-Claim) — Rechtentzug wirkt sofort.
- **Offene PayPal-Anfragen** eines wegfallenden Verwalters (Demote B2k / Remove Account-A)
  werden dem **least-loaded** aktiven Verwalter neu zugewiesen (§6.9), bleiben `OFFEN`/bestätigbar.
- **§5 an reales `schema.prisma` angeglichen:** schlankes `Invite` (nur Token+userId), „Enum"→
  „String (validiert)" (SQLite), `isActive`, `verwalterId`/`zugewiesenerVerwalterId`, AUSLAGE-Hinweis.

**Update 14 (16.06.2026):** B6 — PWA (installierbar)
- App ist **installierbar** (Web-Manifest, `display: standalone`, `orientation: portrait`,
  Charcoal-Splash `#0D1116`), startet mit **BergMark-Icon** (192/512/maskable 512 +
  apple-touch 180, aus der BergMark-Geometrie auf Charcoal gerendert).
- **`vite-plugin-pwa`** (`registerType: autoUpdate`, sauberes Update, kein Stale-Cache);
  Precache nur App-Shell/statische Assets, **`/api` NICHT gecacht** (Daten live);
  `navigateFallback: index.html` (SPA-Deep-Links/Refresh in standalone).
- iOS-Head-Meta (`apple-touch-icon`, `apple-mobile-web-app-*`), `theme-color` → `#0D1116`.
- **Service-Worker registriert nur im Secure Context** (HTTPS/localhost) — auf dem Mac
  über `localhost` verifiziert; **Handy-Install + Offline-Shell voll erst ab HTTPS/B8**.
- Dev-Dependencies (PWA-Freigabe): `vite-plugin-pwa`, `workbox-window`, `sharp` (Icon-
  Rasterung). Keine Backend-/Logik-/Schema-Änderung.

**Update 13 (16.06.2026):** Account-B — Passwort-Reset + Invite-mit-Rolle + Doku-Fix
- **Admin-Passwort-Reset:** `POST /admin/users/:id/reset-password` erzeugt einen
  einmaligen Reset-Link (bestehende Token-Infra, neuer Invite für den bestehenden
  User); Einlösen über `/auth/invite-redeem` setzt das neue Passwort. Altes Passwort
  gilt bis zum Einlösen; `isActive` unberührt; Reset-Link wird angezeigt (kein
  E-Mail-Versand). Frontend: Karte im Mitglied-Detail (kopierbar).
- **Invite-mit-Rolle:** `POST /admin/invite` nimmt `isAdmin`/`isLeitung` und setzt sie
  beim Anlegen am User (Checkboxen im Invite-Formular, Default aus). **Kein**
  Schema-Change (Rollen am User, schlankes Invite — siehe §5.4).
- **Doku-Fix:** §5.1/§6.7 `deletedAt` → `isActive` (real existierendes Feld; Account-A);
  §5.4 Realitäts-Note zum schlanken Invite. Kein Verhaltens-Change.

**Update 12 (16.06.2026):** B5-Icons — Emoji-Entkernung + Line-Icon-System
- **Alle UI-Emojis entfernt** (Bottom-Nav, Admin-Hub-Cards, Leitung, Sektions-Labels,
  Buttons) → konsistente **lucide-react Line-Icons** (Größe/Stroke/Farbe einheitlich;
  aktiver Nav-Tab Teal, sonst Ink/Akzent). Neue `Eyebrow`-Komponente (Icon + Kicker).
- Icon-Mapping §7.1/§7.2. **Achievement-Emojis bleiben** (🏔️🌧️⛺🎒🪙🎖️🧗).
- **Eine neue Dependency:** `lucide-react`. Drink-Kategorie-Marker + BergMark unverändert.
- Reine Präsentation, keine Logik-/Endpoint-/Daten-/Schema-Änderung.

**Update 11 (16.06.2026):** B5c-Feinschliff (Präsentation/Nav)
- Bottom-Nav **3 Tabs** (Theke/Aufladen/Verlauf); Buchen ist Unter-Screen über den
  Theke-CTA (§7.1). Sticky Zurück-Header auf allen Unter-Screens.
- Hintergrund durchgehend (fixierter Layer, kein Umbruch auf langen Screens).
- ScrollList als erkennbarer Kasten (dauerhaft sichtbarer Scrollbalken, Rahmen).
- Getränke ohne Emoji → **Kategorie-Farbmarker** (alkoholfrei=Blau, alkoholisch=
  Gold, sonstiges=Teal); Emoji-Input im Drink-Formular entfernt (`icon`-Feld bleibt
  im Modell, kein Schema-Change).
- Reine Frontend-Präsentation/Nav-Struktur, keine Logik/Daten/Schema-Änderung.

**Update 10 (15.06.2026):** Visual Redirection — kühl/mehrfarbig/Glass/Inter
- Design-System neu definiert: dunkler kühler Charcoal-Grund, echtes Glass
  (Backdrop-Blur + Lichtkante), **Inter durchgehend** (Fraunces entfernt).
- Palette: Teal (Primär/CTA/aktiv), Blau (Info), Gold (offen), Grün (positiv/
  bestätigt), Koralle (negativ/Storno/abgelehnt). Großzahlen Weight 300,
  Beträge tabellarisch.
- Token-Werte repurposed (Namen behalten) + neue semantische Tokens; reine
  Frontend-Präsentation, keine Logik-/Daten-/Schema-Änderung.
- (Vorher B5a Struktur/Bottom-Nav, B5b Primitive-Konsolidierung.)

**Update 9 (15.06.2026):** AUSLAGE-Typ gestrichen
- Redundant zu EINKAUF/ENTNAHME aus dem eigenen Verwalter-Topf (beide dürfen
  den Topf negativ machen = „Verein schuldet dem Verwalter").
- „Auslage" beschrieb nur die Geldquelle (privat), die ohnehin im negativen
  Topf abgebildet ist, und lieferte keine saubere eigene Auswertungs-Kategorie.
- Kassen-Typen jetzt sechs: EINZAHLUNG, EINLAGE_BOX, EINKAUF, ENTNAHME, SPENDE, KORREKTUR.

**Update 8 (04.06.2026):** Multi-Verwalter mit Lastverteilung
- Mehrere Verwalter, jeder mit eigenem `paypalMeLink` und eigenem „Verwalter hält"-Topf (`KassenTransaktion.verwalterId`)
- PayPal-Aufladung: Mitglied sieht nur den Link des zuständigen Verwalters; `AufladungsAnfrage.zugewiesenerVerwalterId`
- **Zuteilung nach geringster Schuld** (effektive Summe inkl. offener Anfragen, Tie-Break alphabetisch), live berechnet, Zuteilung beim Abschicken
- Nur der zugewiesene Verwalter bestätigt seine Anfrage
- Neuer Typ `ENTNAHME` (vereinsfremde Ausgabe, getrennt vom Getränke-`EINKAUF`)
- `SPENDE` jetzt auch an einen konkreten Verwalter wählbar (nicht nur Box)
- `notiz` auf KassenTransaktion ist jetzt **bei jeder Bewegung Pflicht**
- Deckung = Summe aller Verwalter-Töpfe + Box − Summe Mitglieder-Guthaben
- Neue Phase B2k (Multi-Verwalter), Kassen-Schema schon ab B2e multi-fähig

**Update 7 (04.06.2026):** Schuld-Modell + Leitung-Rolle
- „Verwalter hält" (ein Topf, darf negativ) + „Bar-Vereinskasse" (nachzählbar) statt Bar/PayPal
- KassenTransaktion-Typen EINZAHLUNG, EINLAGE_BOX, EINKAUF, SPENDE, KORREKTUR
- Rolle „Leitung" (read-only Kassen-Einsicht)
- Deckung = Vereinsvermögen − Summe Mitglieder-Guthaben

**Update 6 (26.05.2026) — VERWORFEN, nie gebaut:**
- Bar/PayPal als zwei Kassen-Unterkonten mit Umbuchung; durch Update 7 ersetzt bevor Code entstand

**Update 5 (26.05.2026):** Klärungs-Konsolidierung nach Smoke-Test
- `AufladungsAnfrage`, `stornoVonId`, Live-Guthaben, 5-Min-Storno, paypal.me, Audio-Warning verworfen

**Update 4 (21.05.2026):** Flexibler Katalog, feste Kategorien, `isActive`, `preisAtKauf` eingefroren

**Update 3 (20.05.2026, verworfen durch Update 4):** Single-Drink 1,50 €, rückgängig gemacht

**Update 2 (20.05.2026):** Design-Integration (Dark-Bar, Fraunces, Glass)

**Update 1 (20.05.2026):** Architektur final (SQLite, kein Leaderboard, Admin-Invite, Hetzner)
