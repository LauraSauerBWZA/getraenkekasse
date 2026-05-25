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
- **Port-Mappings:** `3000:3000` und `4000:4000`
  - ⚠️ **Hinweis:** Vite-Dev läuft auf **3001**, nicht 3000. Port-Mapping ist nicht aktuell — Mac-Browser kann Frontend nicht erreichen. Wird in Phase B-Konsolidierung gefixt.
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

---

## 10. Wann diese Datei geändert wird

- **Selten.** Nur wenn sich Konventionen ändern.
- **Niemals pro Phase.** Phase-Inhalte gehören in `BERICHTE/`, nicht hier.
- **Bei neuen Lehren** (z.B. Phase B5 zeigt, dass ein neues Pattern nötig ist): in CLAUDE.md ergänzen + im Phase-Abschluss-Bericht erklären, warum.

---

**Letzte Aktualisierung:** 2026-05-25 (Initial-Version nach Phase 1 mit rückwirkender Konsolidierung)
