# Phase B2b — Bau-Etappe: InviteToken → Invite (Naming-Konsolidierung)

**Ziel:** Das Prisma-Modell `InviteToken` durchgehend in `Invite` umbenennen. Reiner Rename, keine Verhaltensänderung. Die API-Routen (`/admin/invite`, `/admin/invites`) und Response-Shapes bleiben unverändert — nur das interne Modell wird umbenannt.

**Grundlage:** `BERICHTE/PHASE_B2b_SCHRITT0.md`. **Entscheidung: Option A.**
**Source of Truth:** `KONFIGURATION.md` (Update 8). Konventionen: `CLAUDE.md`.
**Umfang:** EIN atomarer Sub-Commit (B2b.1).

---

## Entscheidungen (von Laura festgelegt)

- **Nur `InviteToken → Invite`.** `guthaben` bleibt komplett unangetastet (fällt in B2c weg, kein Zwischen-Rename).
- **`generateInviteToken()` behält seinen Namen** — Krypto-Schicht, beschreibt korrekt was sie tut, kein Modell-Bezug.
- **Kein B2b.2** (kein Schema-Kommentar) — der Hinweis steht schon in KONFIGURATION.md Sektion 12.
- **Migration: `pnpm db:push --accept-data-loss`** — kein `@@map`-Workaround (würde die Drift auf DB-Ebene verschleppen). Datenverlust = der eine Seed-Invite, in der Dev-DB egal.
- **`db:reset`-Script-Bug NICHT in B2b** — eigenes Anliegen für später, nicht hier mitfixen.
- **Nach Migration: Test-Invite anlegen** für den Browser-Test der Liste.

---

## Warum ein einziger atomarer Sub-Commit

Ein Rename über mehrere Dateien lässt sich nicht sinnvoll aufteilen: Sobald das Schema `Invite` sagt, aber `admin.ts` noch `prisma.inviteToken` aufruft, bricht der Build. Alle Stellen müssen in einem Commit zusammen umgestellt werden, damit `pnpm test` durchgehend grün bleibt. Die „Aussage ohne und" ist hier sauber: „InviteToken zu Invite umbenennen."

---

## Sub-Commit B2b.1 — InviteToken → Invite (atomar)

**Aussage:** „Prisma-Modell InviteToken in Invite umbenennen."

**Betroffene Dateien** (laut Schritt-0-Recherche — bitte beim Bauen gegen die echte Code-Basis verifizieren, falls eine Stelle fehlt):
- `app/backend/prisma/schema.prisma` — `model InviteToken` → `model Invite`, Relations-Feld auf `User` anpassen
- `app/backend/src/routes/admin.ts` — `prisma.inviteToken.*` → `prisma.invite.*`
- `app/backend/src/routes/auth.ts` — `prisma.inviteToken.*` → `prisma.invite.*` (Magic-Link-Einlösung)
- `app/backend/tests/auth-flow.test.ts` — alle `inviteToken`-Referenzen
- `app/backend/prisma/seed.ts` — `prisma.inviteToken.*` → `prisma.invite.*`

**Was NICHT anfassen:**
- `generateInviteToken()` (Funktionsname bleibt)
- Die Route-Pfade `/admin/invite` und `/admin/invites` (bleiben)
- Die JSON-Response-Shapes (bleiben — Frontend merkt nichts)
- `guthaben` / `guthabenCent` (bleibt B2c)
- Das `db:reset`-Script (eigenes Anliegen)

**Schritte:**
1. Alle oben genannten Stellen umbenennen. Mit `grep -ri "invitetoken" app/` gegenprüfen, dass keine Stelle übersehen wurde (außer `generateInviteToken`).
2. `pnpm db:push --accept-data-loss` — Schema in die DB anwenden (Tabelle `InviteToken` → `Invite`, alte Daten gehen verloren)
3. `pnpm seed` — frischen Admin + Magic-Link erzeugen
4. **Test-Invite anlegen:** entweder per `curl` POST `/admin/invite` mit Admin-Cookie, oder Hinweis im Chat, dass Laura im Browser einen anlegt
5. `pnpm test` — auth-flow.test.ts muss grün bleiben
6. `npx tsc --noEmit` (Backend) — keine neuen Typfehler

**Verifikation vor Freigabe:**
- `grep -ri "prisma.inviteToken\|model InviteToken" app/` → leer (nur `generateInviteToken` darf noch auftauchen)
- `pnpm test` grün
- Diff-Bericht in `BERICHTE/PHASE_B2b1_DIFF.md`

**Browser-Test (Laura):**
- `pnpm dev` läuft, als Admin einloggen (frischer Magic-Link aus Seed)
- `/admin` öffnen → Invite-Formular + Liste laden weiterhin korrekt
- Neuen Invite anlegen → erscheint in der Liste mit Status „offen"
- GET `localhost:4000/admin/invites` im Browser → liefert JSON wie vorher (Shape unverändert)

→ Wenn die UI sich exakt wie vor dem Rename verhält, ist der Rename geglückt (keine sichtbare Änderung = Erfolg).

---

## Commit (nach Freigabe)

- **Vorher zeigen:** `git status` + `git diff --cached` als eigenständiger Tool-Call (nicht via `&&` gechaint) — laut Memory `feedback-pre-commit-review.md`
- **Kein Co-Authored-By-Trailer** — laut Memory `feedback-commit-trailer.md`
- Commit-Message-Vorschlag:
  ```
  refactor: Prisma-Modell InviteToken in Invite umbenennen

  Sub-Commit B2b.1 — reiner Rename ohne Verhaltensänderung.
  schema.prisma, admin.ts, auth.ts, seed.ts, auth-flow.test.ts.
  Route-Pfade und Response-Shapes unverändert. DB via db:push
  --accept-data-loss migriert. guthaben bleibt unangetastet (B2c).
  ```
- Danach `git log -1`
- Dann `BERICHTE/PHASE_B2b_ABSCHLUSS.md` mit Commit-Hash + Zusammenfassung
- STOPP. Push macht Laura vom Mac.

---

## Was NICHT in B2b gehört

- ❌ Kein `guthaben`-Rename oder -Streichen (B2c)
- ❌ Keine `generateInviteToken`-Umbenennung
- ❌ Keine Route-/Response-Änderung
- ❌ Kein `db:reset`-Script-Fix
- ❌ Kein `git push`
- ❌ Kein Commit ohne Lauras Freigabe
