# Phase B2f — PayPal-Aufladungs-Anfragen

**Phase:** B2f. Sub-Commits **B2f.1 – B2f.5**, davor ein kurzer Workflow-Update-Commit (Schritt -1).
**Source of Truth:** `KONFIGURATION.md` **Update 8** — §5.5 (AufladungsAnfrage), §6.5 (PayPal-Flow), §6.4 (Kopplung wie Bargeld), §4 (Rechte), §7.1/§7.2 (UI), §12.
**Voraussetzung:** B2e abgeschlossen. `KassenTransaktion`, `Transaktion.kassenTransaktionId`, `User.paypalMeLink` liegen im Schema. Storno-Rückbuchung für `AUFLADUNG_*` ist generisch da (B2e.4).
**Modus:** Voll autonom (siehe Schritt 1) — Code committet selbst, pusht nicht.

---

## Schritt -1: CLAUDE.md auf den neuen Workflow bringen (eigener Commit, ZUERST)

Die Zusammenarbeit hat sich geändert. Aktualisiere `CLAUDE.md` **vor** B2f, damit künftige Sessions den richtigen Modus lesen. Konkrete Änderungen:

- **§1.1** (war „Niemals eigenmächtig committen … Freigabe abwarten") → ersetzen durch: *„Code committet sein Bündel selbst, sobald die eigenen Checks (Tests + Typecheck + Build) grün sind und der Bündel-Bericht geschrieben ist. Kein Commit-Freigabe-Ritual."*
- **§1.4** (war „Push macht nur Laura vom Mac. Niemals git push aus dem Container.") → ersetzen durch: *„Push ist ausschließlich Lauras Aktion. Claude Code pusht NIE autonom. Push ist via SSH-Deploy-Key jetzt auch aus dem Container möglich, wird aber nur von Laura ausgelöst — nach Review + Browser-Test."*
- **§1.6** (war „Pro Sub-Commit STOPP für Browser-Test") → ersetzen durch: *„Kein STOPP pro Sub-Commit. Autonome Bauphase; Laura reviewt + browser-testet asynchron vor dem Push."*
- **§3 Phase-Workflow** → den Sub-Commit-Loop von „Edit → Diff-Bericht → STOPP → Freigabe → commit" umstellen auf: *„Edit → (autonom weiter) → am Phasenende: Tests/Typecheck/Build grün → Code committet die Sub-Commits selbst → Bündel-Bericht mit echtem git status/diff/log → STOPP ohne Push. Laura reviewt + browser-testet + pusht asynchron."*
- **§8 Verbotenes** → „Niemals committen ohne Freigabe" entfernen; „Niemals git push aus der Sandbox" ersetzen durch „Claude Code pusht nie selbst (Push = Laura)". `git push --force` bleibt verboten.
- **§9 Berichts-Skepsis** bleibt — sogar wichtiger: Da Code jetzt selbst committet, **muss** der Bündel-Bericht das echte `git status` + `git diff --cached`/`git log` zeigen, damit Laura vor dem Push gegen die Realität prüfen kann.
- **§7 Sandbox** → ergänzen: Push aus dem Container via SSH-Deploy-Key eingerichtet (privater Key im Container, nur Laura löst Push aus).

Commit als eigener erster Commit: `chore: CLAUDE.md auf autonomen Workflow (Selbst-Commit, Push bleibt Laura)`. **Nicht pushen.**

---

## Schritt 0: Session-Start & Lese-Pflicht

```
git fetch origin
git status -sb
git log --oneline -4
```
Stand aus Git ableiten (HEAD = `origin/main`, aktuell `726d6c2` + dieser CLAUDE.md-Commit). **Lese-Pflicht:** aktualisierte `CLAUDE.md` · `KONFIGURATION.md` Update 8 (§5.5, §6.5, §6.4, §4, §7) · diese Datei.

Dann **Schritt-0-Recherche** (read-only) → `BERICHTE/PHASE_B2f_SCHRITT0.md` + 5–10 Zeilen im Chat. Prüfen:
1. Schema-Ist (User mit `paypalMeLink`, KassenTransaktion, Transaktion mit `kassenTransaktionId`). `AufladungsAnfrage` fehlt noch → kommt B2f.1.
2. Die gekoppelte Buchung aus B2e (`routes/aufladung.ts`) — die Bestätigung in B2f.3 nutzt dasselbe Muster, nur `typ=AUFLADUNG_PAYPAL`.
3. Die generische Storno-Rückbuchung (B2e.4 in `routes/buchen.ts`) — greift sie für `AUFLADUNG_PAYPAL` automatisch? In B2f.3 mit einem Test bestätigen.
4. Enum-Konstanten-Muster für `aufladungs-status.ts` (`OFFEN`,`BESTAETIGT`,`ABGELEHNT`).
5. Wie der Admin ermittelt wird (aktuell genau ein Admin = der zuständige Verwalter; die echte Lastverteilung ist B2k).
6. Wo `paypalMeLink` herkommt fürs Anzeigen (für den Test einmal manuell/seed gesetzt).

---

## 1. Arbeitsmodus (NEU — volle Autonomie)

- **Bauen voll autonom**, keine Echtzeit-Rückfragen. Code entscheidet Implementierung, Struktur, Naming, REST-Form, Validierung, Fehlertexte, Test-Aufbau, **Commit-Granularität/Datei-Splits** (dokumentieren, nicht fragen).
- **Code committet sein Bündel selbst**, sobald Tests + Typecheck + Build grün sind und der Bündel-Bericht steht. Pro Sub-Commit kein STOPP.
- **STOPP nur bei echtem Blocker** (Spec-Widerspruch mit realen Folgen, fehlende Spec, neue Dependency, technische Sackgasse). Kleinere Mehrdeutigkeiten selbst lösen + dokumentieren.
- **HART: Kein `git push`.** Push ist Lauras Aktion. Bündel-Bericht endet mit echtem `git status` + `git log --oneline -N` (Berichts-Skepsis), damit Laura vor dem Push verifizieren kann. **Kein `Co-Authored-By`.**

---

## 2. Sub-Commits

### B2f.1 — Schema: `AufladungsAnfrage`
`AufladungsAnfrage`-Modell voll nach §5.5: `id`, `userId` (FK→User), `betragCent` (Int), `status` (String/Konstante: `OFFEN`/`BESTAETIGT`/`ABGELEHNT`), `zugewiesenerVerwalterId` (FK→User), `requestedAt`, `decidedAt` (nullable), `decidedById` (FK→User, nullable), `adminNotiz` (nullable), `transaktionId` (FK→Transaktion, nullable). Konstante `aufladungs-status.ts`. Indizes auf FKs. `db push` (additiv), Dev-Server neu.

### B2f.2 — Backend: Mitglied stellt Anfrage + Verwalter-Link
- `GET` „zuständiger Verwalter + dessen `paypalMeLink`" für den Aufladen-Tab. **Zuständig = der Admin** (genau ein Admin aktuell; die Lastverteilung nach geringster Schuld ist **B2k** — hier simpel der/ein Admin).
- `POST` Anfrage: Body `{ betragCent }`, `requireAuth`. Legt `AufladungsAnfrage` an: `status=OFFEN`, `userId=` Mitglied, `zugewiesenerVerwalterId=` der zuständige Admin, `requestedAt=now`.
- Tests: Anfrage anlegen, Auth-Gate, Betrag-Validierung, Link-Endpoint liefert den Admin-Link.

### B2f.3 — Backend: Admin bestätigt / lehnt ab
- `GET` offene Anfragen (`requireAdmin`).
- `POST` bestätigen: erzeugt in **einer** `$transaction` die gekoppelte Buchung (wie B2e, aber `typ=AUFLADUNG_PAYPAL`): Mitglieder-`Transaktion` `+X` + Kassen-`EINZAHLUNG`/`konto=VERWALTER`/`verwalterId=` Admin, verlinkt; `AufladungsAnfrage.status=BESTAETIGT`, `decidedAt`, `decidedById`, `transaktionId`.
- `POST` ablehnen: `status=ABGELEHNT`, `decidedAt`, `decidedById`, optional `adminNotiz`. **Keine** Buchung.
- Tests: Bestätigen erzeugt gekoppelte Buchung + Mitglied-Guthaben steigt; Ablehnen ohne Buchung; doppelte Entscheidung verhindert; **Storno einer bestätigten PayPal-Aufladung** bucht die Kasse via B2e.4-Logik zurück (verifizieren).

### B2f.4 — Frontend: Mitglied-Aufladen-Tab (§7.1)
PayPal-Betrags-Buttons (5/10/20/50 + „anderer Betrag") → Anfrage abschicken → `https://paypal.me/{link}/{betrag}` öffnen. Zuständiger Verwalter-Link sichtbar. Bargeld-Hinweis-Card („sprich deinen Verwalter an"). Offene eigene Anfragen sichtbar (Status).

### B2f.5 — Frontend: Admin-Aufladungs-Anfragen (§7.2)
Liste offener Anfragen (Mitglied, Betrag, Zeit) → bestätigen / ablehnen (mit optionaler Notiz). Nach Aktion aus der Liste raus.

---

## 3. Scope-Abgrenzung (NICHT in B2f)

- **Keine Lastverteilung** (§6.9) — zuständig = der eine Admin. Berechnung nach geringster Schuld → **B2k**.
- **Keine paypal.me-Pflege-UI** — `paypalMeLink` fürs Testen manuell/seed setzen. Pflege → **B2k**.
- **Keine Multi-Verwalter-Filterung** der Anfragen → **B2k**.
- **Kein Kassen-Screen** → **B2i**.
- **Keine PayPal-API** — nur `paypal.me`-Link (§11).
- **Keine Design-Politur** → **B5**.

---

## 4. Done-Kriterien (Lauras async Review vor dem Push)

- [ ] Mitglied-Aufladen-Tab zeigt Beträge + Verwalter-Link; Anfrage abschicken erzeugt offene Anfrage
- [ ] Admin sieht die offene Anfrage, **bestätigt** → Mitglied-Guthaben steigt
- [ ] **Ablehnen** → keine Buchung, Status abgelehnt
- [ ] (Kopplung Kassen-Einzahlung + PayPal-Storno-Rückbuchung: über Tests abgedeckt)
- [ ] `pnpm test` grün
- [ ] **Setup für den Test:** `paypalMeLink` des Admins einmal gesetzt (sonst kein Link zum Anzeigen)

---

## 5. Sandbox-Hinweise

Nach `db push`: Dev-Server neu. Additiv → kein `--accept-data-loss`. Kein `db:reset`. Kein `pkill`/`ps` → `docker restart claude-bwza-getraenke`. Dev: `cd app && pnpm dev`.

---

## 6. Abschluss (autonom, ohne Push)

Tests/Typecheck/Build grün → Code committet die Sub-Commits selbst (sinnvolle Granularität, dokumentiert; kein `Co-Authored-By`) → `BERICHTE/PHASE_B2f_BUENDEL.md` mit **echtem** `git status` + `git log --oneline -N` + Browser-Test-Anleitung → **STOPP ohne Push**. Laura reviewt, testet, pusht.
