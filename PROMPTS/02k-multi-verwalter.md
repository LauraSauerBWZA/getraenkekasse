# Phase B2k — Multi-Verwalter mit Lastverteilung (geringste Schuld zuerst)

**Phase:** B2k — letzte B2-Phase. Logische Einheiten siehe §3 — **Commit-Granularität entscheidet Code selbst** und dokumentiert sie.
**Source of Truth:** `KONFIGURATION.md` **Update 9** — §3 (paypal.me pro Verwalter), §4 (Verwalter ernennen), §5.1 (`paypalMeLink`), §5.5 (`zugewiesenerVerwalterId`), §6.5 (PayPal-Flow mit Zuweisung), **§6.9 (Lastverteilung — Kern)**, §7.2 (gefilterte Anfragen, Profil), §10 (Roadmap), §11/§12.
**Voraussetzung:** B2j abgeschlossen und gepusht. `isAdmin` (B1), `paypalMeLink` (B2e, Schema), `zugewiesenerVerwalterId` (B2f, Schema) liegen alle. **Kein Schema-Change, kein `db push`.**
**Modus:** Voll autonom — Code committet selbst, pusht nicht. Kein `Co-Authored-By`.

---

## 1. Arbeitsmodus (volle Autonomie, steht in CLAUDE.md)

Autonom bauen, keine Echtzeit-Rückfragen, Granularität selbst wählen + dokumentieren, selbst committen wenn Tests + Typecheck + Frontend-Build grün. STOPP nur bei echtem Blocker. **Kein `git push`** (Push = Laura). Bündel-Bericht mit echtem `git status` + `git log --oneline -N`. **Kein `Co-Authored-By`.**

---

## 2. Schritt 0 — Recherche (read-only)

Session-Start: `git status -sb` + `git log --oneline -4` (lokal, kein `git fetch`). Bericht in `BERICHTE/PHASE_B2k_SCHRITT0.md` + 5–10 Zeilen. Prüfen:
1. **`isAdmin`, `paypalMeLink`, `zugewiesenerVerwalterId`** im Schema bestätigen. Kein `db push`.
2. **B2f-Aufladungs-Flow** (`routes/aufladung.ts`): Wie wird die `AufladungsAnfrage` erstellt, **woher kommt aktuell der `zugewiesenerVerwalterId`** (B2f: der eine Admin) und **woher der paypal.me-Link** im Member-Flow? → das ist die Stelle, die auf die Lastverteilung umgestellt wird.
3. **Verwalter-Topf-Berechnung** (`routes/kasse.ts` / Domain-Helper aus B2i): `SUM betragCent WHERE konto=VERWALTER AND verwalterId=V` — wiederverwenden für die effektive Summe.
4. **Admin-Anfragen-Liste** (B2f): zeigt sie aktuell alle? → auf „eigene zugewiesene" filtern.
5. **B2j-Muster** für Recht-Toggle (`PATCH /admin/users/:id/leitung`, DB-Lookup-Guard) — als Vorlage für den `isAdmin`-Toggle.
6. **`/auth/me`** + Frontend-Profil: gibt es schon einen Profil-Screen? Sonst minimal neu (paypal.me-Feld). Kein voller ProfileDrawer (B5).

Kein Blocker erwartet → durchbauen. Falls die effektive-Summe-Definition oder die Kopplung an B2f unklar **mit Folgen** ist → STOPP.

---

## 3. Inhalt

### Backend — Verwalter ernennen (Admin-only)

- Endpoint (analog B2j, z.B. `PATCH /admin/users/:id/admin`), `requireAdmin`: setzt `User.isAdmin` true/false.
- **Letzter-Admin-Schutz:** das Entziehen des **letzten aktiven Admins** wird abgelehnt (`400`, klare Meldung) — die App darf nie ohne Verwalter dastehen. (Sich selbst entziehen ist erlaubt, solange ein weiterer aktiver Admin bleibt.)
- Tests: ernennen/entziehen; letzter Admin → 400; Nicht-Admin → 403; unbekannte ID → 404.

### Backend — paypal.me-Profil (eigener Link)

- Endpoint, mit dem ein **Admin seinen eigenen** `paypalMeLink` setzt/ändert (z.B. `PATCH /me/paypal` oder `/admin/profil`), `requireAuth`+Admin. Nur der eigene Link (nicht fremde).
- Validierung leichtgewichtig (nicht leer wenn gesetzt; paypal.me-URL-Form tolerant prüfen). Link darf auch wieder geleert werden.
- `/auth/me` liefert `paypalMeLink` mit aus.
- Tests: setzen/ändern/leeren; nur eigener Link.

### Backend — Lastverteilung (§6.9, Kern)

- **Helper `ermittleZustaendigenVerwalter()`** (live, kein gespeicherter Cursor):
  - **Wählbare Verwalter** = aktive User mit `isAdmin=true` **und** nicht-leerem `paypalMeLink`.
  - Pro wählbarem Verwalter **effektive gehaltene Summe** = Verwalter-Topf (`SUM kassenTransaktion.betragCent WHERE konto=VERWALTER AND verwalterId=V`) **plus** Summe `betragCent` seiner **offenen** Anfragen (`AufladungsAnfrage WHERE zugewiesenerVerwalterId=V AND status=OFFEN`).
  - Zuständig = **niedrigste** effektive Summe. **Tie-Break: alphabetisch nach `firstName`.**
  - **Sonderfall ein Verwalter:** degeneriert sauber zu diesem.
  - **Kein wählbarer Verwalter** (kein Admin mit paypal.me-Link): sauber behandeln — PayPal-Anfrage wird **abgelehnt** (`400`, Meldung „Kein Verwalter mit PayPal-Link hinterlegt"). Kein Crash, keine Zuteilung an jemanden ohne Link.
- **Anfrage-Erstellung umstellen:** beim **Abschicken** der PayPal-Anfrage (§6.9: Zuteilung beim Abschicken, nicht beim Tab-Öffnen) `zugewiesenerVerwalterId = ermittleZustaendigenVerwalter()`. Response enthält den zugewiesenen Verwalter + dessen `paypalMeLink`, damit das Frontend `paypal.me/{link}/{betrag}` öffnen kann.
- **Zuständig-Preview (read-only):** GET-Endpoint, der den **aktuell** zuständigen Verwalter (+ Link) liefert, **ohne** eine Anfrage anzulegen — für die Anzeige beim Öffnen des Aufladen-Tabs (§6.5 Schritt 1). Nutzt denselben Helper.
- **Bestätigen nur der Zugewiesene:** der Bestätigen-Endpoint (B2f) lehnt ab (`403`), wenn der bestätigende Admin **nicht** `zugewiesenerVerwalterId` ist. Die gekoppelte Kassen-`EINZAHLUNG` läuft auf den **zugewiesenen** Verwalter-Topf (wie schon B2f, jetzt korrekt der Zugewiesene). Ablehnen: ebenfalls nur der Zugewiesene.
- **Anfragen-Liste gefiltert:** der Admin sieht **seine eigenen zugewiesenen** Anfragen. (Optionale read-only „alle"-Übersicht ist Kür — Code-Entscheidung, nicht Pflicht.)
- Tests: niedrigste Summe gewinnt; offene Anfragen zählen mit (Klumpung verhindert — zwei schnelle Anfragen gehen an verschiedene Verwalter, sobald die erste den effektiven Stand hebt); Tie-Break alphabetisch; ein Verwalter degeneriert; kein-Link → 400; Bestätigen durch Nicht-Zugewiesenen → 403; Kassen-EINZAHLUNG landet im richtigen Topf.

### Frontend

- **Verwalter-ernennen-Toggle** im Mitglied-Detail (neben dem Leitung-Toggle aus B2j); Letzter-Admin-Fehler sauber anzeigen.
- **paypal.me-Profil:** schlichter Screen/Bereich, in dem der eingeloggte Admin seinen eigenen Link einträgt/ändert (Einstieg analog Admin-Card; kein ProfileDrawer).
- **Aufladen-Tab (Mitglied):** zeigt den **aktuell zuständigen Verwalter** (Preview) und öffnet beim Abschicken `paypal.me/{Link des zugewiesenen Verwalters}/{Betrag}`. Falls kein Verwalter mit Link: klarer Hinweis statt Button.
- **Admin-Anfragen-Liste:** auf **eigene zugewiesene** gefiltert; bestätigen/ablehnen nur dort.
- Kassen-Screen (B2i) zeigt die Verwalter-Töpfe schon pro `verwalterId` — mit mehreren Admins erscheinen jetzt automatisch mehrere Töpfe (kein Umbau nötig, nur verifizieren).
- `lib/api.ts`: `adminSetAdmin`, `setPaypalLink`, `zuständiger-Verwalter`-Preview; `/me`-Typ um `paypalMeLink`.

### Bewusst NICHT in B2k

- **Design-Politur / ProfileDrawer / scrollbare Listen** — **B5**.
- **Sortenstatistik** — **B3**, **Trinkjournal** — **B4**.
- **Kein Schema-Change.**

---

## 4. Done-Kriterien (Lauras async Review)

- [ ] Admin kann ein Mitglied zum **Verwalter ernennen** und wieder entziehen; **letzter Admin** lässt sich nicht entziehen (Fehlermeldung)
- [ ] Jeder Verwalter kann seinen **eigenen paypal.me-Link** pflegen
- [ ] PayPal-Anfrage eines Mitglieds wird dem Verwalter mit der **geringsten effektiven Summe** zugewiesen (Topf + offene Anfragen), Tie-Break alphabetisch; das Mitglied bekommt **dessen** Link
- [ ] **Bestätigen/Ablehnen nur durch den zugewiesenen** Verwalter; Kassen-EINZAHLUNG landet in dessen Topf
- [ ] Anfragen-Liste je Admin auf **eigene zugewiesene** gefiltert
- [ ] Kein Verwalter mit Link → PayPal-Aufladung sauber geblockt (kein Crash)
- [ ] Mehrere Verwalter-Töpfe erscheinen im Kassen-Screen (B2i) automatisch
- [ ] `pnpm --filter backend test` grün, Frontend-`build` grün

---

## 5. Sandbox-/Test-Hinweise

- Kein `db push`, kein `db:reset` (kaputt). Bei hängendem Prozess `docker restart claude-bwza-getraenke` (vom Mac). Dev: `cd app && pnpm dev`.
- **Browser-Test braucht mehrere Akteure:** ein zweites Mitglied zum Verwalter ernennen, **beiden** Verwaltern einen paypal.me-Link geben, dann als (drittes) Mitglied eine PayPal-Anfrage stellen und prüfen, dass sie an den Verwalter mit dem **niedrigeren Topf** geht; eine zweite Anfrage geht (wegen mitgezählter offener Anfrage) an den anderen. Im Bündel-Bericht eine **konkrete Mehr-Akteur-Anleitung** mit erwarteter Zuteilung geben (inkl. wie man die Töpfe vorab unterschiedlich befüllt, z.B. via Einkauf aus eigenem Topf).

---

## 6. Abschluss (autonom, ohne Push)

Tests/Typecheck/Frontend-Build grün → Code committet selbst (Granularität dokumentiert; kein `Co-Authored-By`) → `BERICHTE/PHASE_B2k_BUENDEL.md` mit echtem `git status` + `git log --oneline -N` + Mehr-Akteur-Browser-Test-Anleitung → **STOPP ohne Push.** Laura reviewt, testet, pusht.

**Mit B2k ist Phase B2 vollständig abgeschlossen.**
