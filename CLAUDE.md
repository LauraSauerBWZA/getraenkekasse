# CLAUDE.md — Spielregeln für Claude Code

Dieses Dokument ist die **dauerhafte Konvention** für jede Claude-Code-Session in diesem Projekt. Bei jedem Session-Start lesen und befolgen.

---

## 1. Verhaltens-Regeln (immer)

1. **Niemals eigenmächtig committen.** Vor jedem `git commit` Lauras explizite Freigabe im Chat abwarten.
2. **Vor jedem Commit `git status` zeigen.** Damit Laura sieht, was wirklich gestaged ist.
3. **Vor jedem Push `git log -1` zeigen.** Damit Laura sieht, was wirklich gepusht wird (Berichts-Skepsis: nicht der Selbstbericht, sondern das echte Log zählt).
4. **Push macht nur Laura vom Mac.** Niemals `git push` aus dem Container ausführen.
5. **Bei Unklarheit: STOPP, fragen.** Niemals eigene Entscheidungen treffen bei widersprüchlichen Quellen oder fehlenden Specs.
6. **Pro Sub-Commit STOPP für Browser-Test.** Nach jedem in sich abgeschlossenen Edit auf Lauras Test + Freigabe warten, bevor committen.

---

## 2. Source-of-Truth-Hierarchie

Bei Widersprüchen gewinnt die **höhere Tier**.

| Tier | Quelle | Inhalt |
|---|---|---|
| 1 | Code im Live-Git | Tatsächliche Realität |
| 2 | `BERICHTE/PHASE_*_ABSCHLUSS.md` | Was wurde gebaut |
| 3 | `KONFIGURATION.md` | Tech-Stack-Entscheidungen + Domain + Modellierung |
| 4 | `PROMPTS/0X-*.md` | Was soll gebaut werden (aktuelle Phase) |
| 5 | `design/README_DESIGN.md` | Design-System |
| 6 | `archiv/` | Historische Dokumente, **NICHT als Quelle verwenden** |

**Bei widersprüchlichen Quellen:** Nicht raten. Stoppen und Laura fragen.

---

## 3. Phase-Workflow

Jede Phase folgt diesem Muster:

1. **Schritt 0 — Recherche** (nur lesen, kein Edit). Bericht in `BERICHTE/PHASE_BX_SCHRITT0.md`.
2. **Laura entscheidet** auf Basis der Recherche.
3. **Sub-Commits einzeln umsetzen.** Pro Sub-Commit:
   - Edit ausführen
   - Diff-Bericht in `BERICHTE/PHASE_BXa_DIFF.md`
   - 5-10 Zeilen Zusammenfassung im Chat
   - **STOPP**, auf Freigabe warten
   - Erst nach Freigabe: `git commit`
4. **Nach Phase-Abschluss**: `BERICHTE/PHASE_BX_ABSCHLUSS.md` mit Commit-Hashes + Zusammenfassung.

**Sub-Commit-Disziplin:** Jeder Sub-Commit ist eine logische Aussage, die ohne „und" formulierbar ist. Wenn eine Phase 3 logische Einheiten hat, sind das 3 Sub-Commits.

---

## 4. Datei-Ablage

| Ordner | Inhalt | In Git? |
|---|---|---|
| `app/` | Code (Backend + Frontend, pnpm-Monorepo) | ja |
| `PROMPTS/` | Phase-Specs (eine pro Phase, `0X-*.md`) | ja |
| `BERICHTE/` | Diff-Berichte, Abschluss-Berichte, Recherchen | **nein (`.gitignore`)** |
| `design/` | Design-Prototypen + `README_DESIGN.md` | ja |
| `docker/` | Sandbox-Setup | ja |
| `scripts/` | Helper-Skripte (z.B. `restart-dev.sh`) | ja |
| `archiv/` | Historische Doku, **nicht als Quelle verwenden** | ja |
| `KONFIGURATION.md` | Source of Truth für Tech-Stack | ja |
| `CLAUDE.md` | Diese Datei | ja |

---

## 5. Tooling-Konventionen

### Workspace

- **Paket-Manager:** `pnpm` (pnpm-Workspace-Monorepo unter `app/`)
- **Node:** ≥20 (`engines.node` ist gepinnt)
- **pnpm:** 11.1.3 (`packageManager` ist gepinnt)

### Befehle (von `app/` aus)

| Befehl | Was er tut |
|---|---|
| `pnpm dev` | Backend + Frontend parallel via `concurrently` (Backend 4000, Frontend 3001) |
| `pnpm test` | Tests (vitest) |
| `pnpm build` | Backend + Frontend bauen |
| `pnpm db:push` | Prisma-Schema in SQLite anwenden |
| `pnpm db:reset` | DB zurücksetzen + seeden |
| `pnpm seed` | Seed-Daten einspielen |

### Server-Restart in Sandbox

Aktuell läuft das via `pnpm dev`. Falls Restart-Probleme auftauchen (npm-Wrapper-Chain hängt, Ports blockiert), wird ein `scripts/restart-dev.sh` ergänzt — analog zum Einsatzboard-Pattern.

### Branch-Strategie

**`main`-only.** Keine Feature-Branches. Qualitäts-Mechanismus ist die Sub-Commit-Disziplin, nicht Branch-Disziplin.

### Domänen-Konventionen (Geschäftslogik)

Bei allen Code-Edits, die Beträge oder Getränke betreffen:

- **Beträge in Cent als `Int`.** Niemals `Float` für Geldbeträge. Beispiel: `2,50 €` → `250` (Cent).
- **`guthabenCent` darf negativ sein.** Keine DB-Constraint dagegen. Negatives Guthaben = Schulden, ist erlaubt.
- **`preisAtKaufCent` einfrieren.** In `Transaktion` wird der Preis zum Kaufzeitpunkt eingefroren. Preisänderungen am Drink ändern nie historische Transaktionen.
- **Soft-Disable statt Hard-Delete.** Drinks via `isActive=false` ausblenden, nicht löschen. Bestehende Transaktionen referenzieren weiterhin den `drinkId`.
- **Drink-Kategorien fest:** `alkoholfrei`, `alkoholisch`, `sonstiges`. Kein „Heißgetränk", keine User-definierten Kategorien.
- **Keine Lieblings-Sorte pro User.** Trinkjournal ist sortenagnostisch (nur Anzahl/Beträge). Sortenstatistik existiert nur App-weit aggregiert für Admin-Einkaufsplanung.
- **Magic-Link Auth, kein Self-Signup.** User kommen ausschließlich via Admin-Invite ins System.

---

## 6. Tech-Stack (Kurz-Referenz)

Vollständige Spec: `KONFIGURATION.md`.

- **Frontend:** React 18 + Vite 5 + TypeScript 5 + TailwindCSS 3 + Framer Motion 11
- **Backend:** Node 20 + Express + TypeScript + Prisma ORM
- **DB:** SQLite (Dev) → Postgres (ab Phase B6)
- **Auth:** Magic-Link-Invite (Admin-only) + argon2 + JWT in Cookies
- **Mail:** Konsolen-Output (Dev) → Resend o.ä. (Live)
- **PWA:** ab Phase B4

---

## 7. Sandbox-Setup

- **Mac-Host-Pfad:** `~/claude-sandbox/projects/getraenke/`
- **Container-Pfad:** `/home/claude/workspace/` (gleicher Inhalt via Volume-Mount)
- **Container-Name:** `claude-bwza-getraenke`
- **Image:** `bwza-getraenke-auth`
- **Port-Mappings:** `3001:3001` (Frontend Vite) und `4000:4000` (Backend Express). Vite-Host ist auf `0.0.0.0` gesetzt, damit der Mac-Browser den Container erreicht.
- **Start (Mac):** Doppelklick auf `docker/start-getraenke.command`
- **Push aus Sandbox NICHT möglich** (kein SSH-Auth). Push immer vom Mac.

---

## 8. Verbotene Verhalten

- Niemals `git push` aus der Sandbox.
- Niemals Code-Entscheidungen bei widersprüchlichen Specs eigenmächtig treffen.
- Niemals Dateien in `archiv/` als Quelle für aktuelle Entscheidungen verwenden.
- Niemals committen ohne explizite Freigabe von Laura.
- Niemals `git push --force` (auch nicht durch Laura — wird besprochen).

---

## 9. Berichts-Skepsis (wichtige Lehre)

Berichte über die eigene Arbeit nicht ungeprüft glauben. Vor jedem Commit/Push:

- `git status` zeigen (was ist wirklich gestaged?)
- `git diff --cached` zeigen (was wird wirklich committet?)
- Nach Commit: `git log -1` zeigen (was wurde wirklich committet?)

Symptome, die in Einsatzboard-Erfahrung auftraten:
- Bericht „fertig", Code aber unstaged
- Eigenmächtige Commits trotz STOPP-Anweisung
- Sandbox-Browser-Cache der trotz Code-Änderung alte Version zeigt

### Drift-Pattern aus Bergwacht-Phase 1

In der Geschichte dieses Projekts gab es zwei widersprüchliche Phase-1-Specs (`01-grundgeruest.md` und `CODE_PROMPT_PHASE1.md`), die aus unterschiedlichen Chats entstanden waren. Claude Code musste eigenständig wählen.

**Lehre:** Wenn du in `PROMPTS/` mehrere Specs findest, die dasselbe Thema adressieren — STOPP, nicht eigenmächtig wählen. Laura fragen.

**Vermeidungs-Konvention:** In `PROMPTS/` liegt **eine** Spec pro Phase, benannt `0X-name.md`. Wenn jemand eine zweite Variante schreibt, gehört eine davon ins `archiv/` mit Warn-Header.

---

## 10. Wann diese Datei geändert wird

- **Selten.** Nur wenn sich Konventionen ändern.
- **Niemals pro Phase.** Phase-Inhalte gehören in `BERICHTE/`, nicht hier.
- **Bei neuen Lehren** (z.B. Phase B5 zeigt, dass ein neues Pattern nötig ist): in CLAUDE.md ergänzen + im Phase-Abschluss-Bericht erklären, warum.

---

## 11. Verweise

Diese Datei (`CLAUDE.md`) regelt **wie** wir arbeiten. Für **was wir bauen** gilt:

- **`KONFIGURATION.md`** — Tech-Stack, Datenmodell (User, Drink, Transaktion, Invite),
  DSGVO-Position, Phasen-Roadmap (B1–B7), Domain, Identitäten.
  Source of Truth für Geschäftslogik-Entscheidungen.

- **`PROMPTS/0X-*.md`** — konkrete Spec der aktuell laufenden Phase.

- **`design/README_DESIGN.md`** — Design-System (Dark-Bar-Ästhetik, Fonts, Tokens, Komponenten).
  Source of Truth für visuelles Design.

- **`design/design-tokens.css`** — Source of Truth für Farben (OKLCH), Spacings, Radius.

- **`BERICHTE/`** — Berichte aus früheren Phasen (nicht in Git, lokal).

Bei Konflikt zwischen diesen Quellen: höhere Tier in der Hierarchie (Sektion 2) gewinnt.

---

**Letzte Aktualisierung:** 2026-05-26 (Erweiterungen nach Phase-1-Smoke-Test: Domänen-Konventionen, Drift-Pattern-Lehre, Verweise, Setup-Fix-Hinweis aktualisiert)
