# Konfiguration — Bergwacht Getränkekasse

**Stand:** 21.05.2026 (Update 4: Flexibler Getränkekatalog + DSGVO-Reformulierung)
**Status:** 🟢 Phase 1 startbereit, Phase 2 vorbereitet

---

## Stack

| Bereich | Entscheidung |
|---|---|
| Frontend | React 18 + Vite + TypeScript + TailwindCSS |
| Backend | Node.js 20+ + Express + TypeScript + Prisma ORM |
| Datenbank | SQLite |
| Auth | Magic-Link-Invite + Passwort + JWT-Session |
| Email | Dev-Phase: Konsolen-Output · Prod: später |
| PWA | ab Phase B4 |
| Hosting Phase 1-5 | Lokal in Docker-Sandbox auf Mac Mini |
| Hosting ab Phase 6 | Default: Hetzner CX22 dediziert |

---

## Identitäten

| Rolle | Person | Email |
|---|---|---|
| Admin / Getränkeverwalter | Laura Sauer | laura_sauer@gmx.de |

---

## Domain

- **Hauptdomain:** `einfall.app`
- **Subdomain:** `getraenke.einfall.app` (anlegen zum Live-Deploy)

---

## Getränk-Modell (flexibler Katalog)

**Admin pflegt einen Getränkekatalog. Jedes Getränk hat Name, Preis, Icon, Kategorie.**

- **Kategorien (fest, kein CRUD):** `alkoholfrei`, `alkoholisch`, `sonstiges` — bewusst KEIN "Heißgetränk"
- **Felder pro Getränk:** `name`, `preis` (Int in Cent), `icon` (Emoji-String), `kategorie`, `isActive`
- **Soft-Disable statt Delete:** `isActive=false` blendet das Getränk aus der User-Auswahl aus, alte Buchungen bleiben referenziert
- **DB-Modell:** eigenes `Drink`-Modell. `Transaktion` referenziert `drinkId` UND friert `preisAtKauf` (Cent) ein → Preisänderungen verfälschen die Historie nicht
- **User-Flow:** Buchen-Tab zeigt alle aktiven Getränke gruppiert nach Kategorie → Tap → Confirm-Sheet mit Preis → Buchung
- **Admin:** CRUD-Liste + aggregierte Sorten-Statistik (siehe DSGVO)

---

## Onboarding

**Admin-only Invite, kein Selfsignup.**

1. Admin trägt Vorname, Nachname, Email ein
2. App generiert einmaligen Token, Email mit Magic-Link
3. User klickt Link → setzt Passwort → ist drin
4. Token läuft nach 7 Tagen ab, Admin kann neu generieren

---

## Guthaben-Logik

- Darf **negativ** werden
- Bei Kauf, der ins Minus führt: Confirm-Dialog "Du gehst auf -X,XX € — trotzdem buchen?"
- Im Dashboard: rote Anzeige (Rescue-Token) bei negativem Saldo
- Audio-Warning beim Confirm
- Admin sieht Übersicht aller Mitglieder mit negativem Saldo

---

## Aufladung-Flow (geschärft)

### Aus User-Sicht
- **PayPal:** App-Flow mit Aufladungs-Anfrage → Admin bestätigt
- **Bargeld:** kein App-Flow. Hinweis-Card auf dem Aufladen-Screen: *"Du willst bar aufladen? Sprich deinen Getränkeverwalter direkt an, er trägt die Aufladung dann hier ein."* — **kein Button**

### Aus Admin-Sicht
- Eingehende PayPal-Anfragen bestätigen / ablehnen
- Bargeld-Aufladungen manuell als "Guthaben-Anpassung" im Mitglieder-Detail eintragen, mit Pflicht-Notiz "Bar aufgeladen"

---

## Admin-Funktionen

- **Mitgliederverwaltung:** Invite ausstellen, Guthaben manuell anpassen (Pflicht-Notiz), Schulden-Übersicht
- **Aufladungs-Anfragen:** PayPal-Anfragen bestätigen / ablehnen
- **Getränkekatalog (CRUD):**
  - Anlegen / Bearbeiten: Name, Preis (Cent), Kategorie, Icon (Emoji), `isActive`
  - Deaktivieren (kein Hard-Delete) — Historie bleibt referenziell intakt
- **Aggregierte Sorten-Statistik (App-weit, anonym):**
  - Zweck: Einkaufsplanung ("Wie oft wurde *Helles* diesen Monat gebucht?")
  - **Keine** Zuordnung zu einzelnen Usern, **keine** Top-Konsumenten-pro-Sorte
  - Zeitfilter: Woche / Monat / Quartal
  - Phase: kommt in B2 zusammen mit dem Katalog-CRUD

---

## Statistik-Konzept (privat, pro User)

**Stilbezeichnung:** "Eigenes Trinkjournal" — niemand außer User selbst sieht das.

### Hero
- Große Monatszahl in Fraunces: "42 Getränke diesen Monat"
- Amber-Glow-Card

### Stat-Strip (3 Cards)
- **Diese Woche** (Anzahl Buchungen)
- **Streak** (Tage in Folge mit mindestens einer Buchung)
- **Längste Pause** (Tage ohne Buchung — bewusst neutral, kein Wertungs-Coach)

### 30-Tage-Verlauf als Balkendiagramm
- Wochenenden in Amber-Deep, Wochentage in Amber-Light
- Tap auf Balken zeigt Buchungen dieses Tages
- Kein Trend-Pfeil, keine "mehr als letzten Monat"-Warnung

### Achievements (privat)

Locker, selbstironisch, niemals wertend in Richtung "trink mehr/weniger":

- 🏔️ **Erstbesteigung** — Erstes Getränk gebucht
- 🌧️ **Trockenwoche** — 7 Tage in Folge keine Buchung
- ⛺ **Hüttenabend** — 3 Getränke an einem Tag
- 🎒 **Tourenrucksack** — 20 Getränke im Monat
- 🪙 **Hamster** — Guthaben zum ersten Mal über 50 € aufgeladen
- 🎖️ **Stammgast** — 100 Buchungen gesamt
- 🧗 **Seilschaft** — erste Runde ausgegeben (Future-Feature)

### Verlaufsliste
- Chronologisch absteigend
- Aufladungen mit grünem `+`, Buchungen mit dezentem `−`
- Am Listenende: "Du bist seit *N Tagen* dabei. Auf die nächsten."

---

## Bottom-Nav

| Tab | Inhalt |
|---|---|
| 🏠 Theke | Dashboard: Guthaben groß, "Getränk buchen"-CTA (führt zum Buchen-Tab), "Aufladen" |
| 🍺 Buchen | Auswahl-Screen: alle aktiven Getränke nach Kategorie gruppiert, Tap → Confirm-Sheet mit Preis |
| 💳 Aufladen | PayPal-Anfrage stellen, Bargeld-Hinweis |
| 🕒 Verlauf | Statistik + Trinkjournal (sortenagnostisch — nur Anzahl/Beträge, keine Lieblings-Sorte) |

Admin-Bereich erreichbar via Profil-Drawer (Avatar-Tap).

---

## Design-System (aus Design-Pack v2)

**Tokens:** `--bwza-*` Namespace, OKLCH-Farben
**Fonts:** Fraunces (Display), Inter (UI), JetBrains Mono (Code)
**Stil:** Dunkle Berghütten-Bar, Glass-Komponenten, Amber-Akzente
**Primitives:** Glass, ShineEdge, BergMark, Avatar, TopBar, BottomNav, GlassButton, GlassInput, PasswordInput, StatCard, Flash, EmptyState, Skeleton, **DrinkPicker** (neu — kategorisierte Auswahl), **DrinkConfirm** (erweitert — zeigt gewählte Sorte + Preis), **DrinkCatalogRow** (neu — Admin-Liste mit Aktiv/Inaktiv-Toggle), ProfileDrawer, AdminBanner

Vollständig in `frontend/src/styles/design-tokens.css` (aus Design-Pack v2).

---

## DSGVO-Mindestpaket (vor Live-Gang)

- Datenschutzerklärung auf Login-Seite
- "Meine Daten exportieren" (JSON-Download)
- "Account löschen" (Soft-Delete mit 30-Tage-Frist)
- AVV mit Hosting-Provider (ab Hetzner)
- Verarbeitungsverzeichnis als Markdown

💡 **DSGVO-Position (Update 4):** Wir tracken keine **persönlichen** Trinkpräferenzen pro User — das individuelle Trinkjournal bleibt sortenagnostisch (nur Anzahl und Beträge). Sortenstatistiken werden ausschließlich **App-weit aggregiert** für Admin-Einkaufsplanung erhoben und enthalten keinen User-Bezug. Auf Buchungsebene ist die Sortenzuordnung technisch notwendig (Historie, Stornos, Preisnachweis).

**Datenexport-Regel:** Im DSGVO-Datenexport eines Users werden seine eigenen Buchungen inkl. `drinkId` / Sortenname mitexportiert (Transparenz gegenüber dem Betroffenen). Aggregierte App-Statistiken anderer User werden **nicht** mitexportiert.

---

## Timeline

| Phase | Inhalt | Dauer |
|---|---|---|
| B1 | Grundgerüst + Auth + Magic-Link | 3-4 Tage |
| B2 | Kern-Features (Kauf, Aufladen, Admin, Design-Integration) | 5-6 Tage |
| B3 | Statistik / Trinkjournal | 2-3 Tage |
| B4 | PWA + Sound + Letzte Politur | 2-3 Tage |
| B5 | DSGVO + Härtung | 2-3 Tage |
| B6 | Deploy + Testphase | 5-7 Tage |
| B7 | Go-Live | 1 Tag |
| **Gesamt** | | **~4-6 Wochen** |

💡 Design-Integration wandert nach B2 (weil schon mit dem Design-Pack v2 startbereit), separate B4-Phase entfällt.

---

## Änderungshistorie

**Update 4 (21.05.2026):** Flexibler Getränkekatalog + DSGVO-Reformulierung
- Single-Drink-Modell aus Update 3 zurückgenommen — Admin pflegt CRUD-Katalog
- Kategorien fest: Alkoholfrei, Alkoholisch, Sonstiges (kein Heißgetränk)
- `isActive`-Flag statt Hard-Delete
- `Transaktion.preisAtKauf` eingefroren → Historie preisstabil
- Aggregierte Sorten-Statistik im Admin-Bereich für Einkaufsplanung (Phase B2)
- Trinkjournal bleibt sortenagnostisch — keine "Lieblings-Sorte" pro User
- DSGVO-Statement umformuliert: keine **persönlichen** Präferenzen, nur App-weite Aggregate
- DSGVO-Datenexport: eigene Buchungen inkl. Sorte mit, fremde Aggregate ohne
- Bottom-Nav "Buchen" wird Auswahl-Screen; neue Primitives `DrinkPicker`, `DrinkCatalogRow`, `DrinkConfirm` erweitert

**Update 3 (20.05.2026):** Getränk-Vereinfachung
- Keine Getränke-Liste mehr — ein einzelnes "Getränk" zu 1,50 €
- Bargeld-Aufladung ohne App-Flow (nur Hinweis-Card)
- Statistik als "Trinkjournal" mit privaten Achievements
- Design-Integration wandert nach B2 statt eigene Phase B4

**Update 2 (20.05.2026):** Design-Integration
- Farbpalette Dark-Bar statt Warm-Creme
- Fraunces statt Merriweather
- Pauschalpreis 1,50 € statt Kategorien
- Glass-Primitives definiert

**Update 1 (20.05.2026):** Architektur final
- SQLite statt PostgreSQL
- Leaderboard / Bierkönig gestrichen
- Onboarding: Admin-Invite via Magic-Link
- Hosting: erst lokal, später Hetzner
