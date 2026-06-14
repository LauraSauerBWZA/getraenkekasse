# Phase B2b (Fortsetzung) — Drink-Katalog (Modell + Admin-CRUD)

**Phase:** B2b, Fortsetzung. Rename war B2b.1 (Commit `99e08db`). Diese Phase baut den noch fehlenden Katalog: Sub-Commits **B2b.2 – B2b.6**.
**Source of Truth:** `KONFIGURATION.md` **Update 8** — besonders §5.2 (Drink-Modell), §4 (Verwalter-Rechte), §7.2 (Admin-Drawer), §8 (Primitives), §11 (Verbotenes), §12 (Inkonsistenzen).
**Modus:** Autarke Bauphase (siehe „Arbeitsmodus" unten). Ein gebündelter STOPP am Ende.

---

## 0. Lese-Pflicht (in dieser Reihenfolge)

1. `CLAUDE.md` — Konventionen
2. `KONFIGURATION.md` (Update 8) — §5.2, §4, §7.2, §8, §11, §12
3. Diese Datei

`archiv/` ist **nicht** als Quelle zu verwenden.

---

## 1. Arbeitsmodus (NEU — gilt ab dieser Phase)

**Code arbeitet autark, lange Bauphase, ein STOPP am Ende.**

Code **entscheidet selbst** (ohne Rückfrage): interne Implementierung, Komponenten- und Datei-Struktur, Helper-/Funktions-Namen, exakte REST-Detailform der Endpoints, Validierungs-Logik, Fehlermeldungs-Texte, Test-Aufbau, Styling im Rahmen der vorhandenen Design-Tokens.

Code macht **nur bei einem echten Blocker** STOPP und fragt Laura:
- Widerspruch zur `KONFIGURATION.md` (Update 8)
- fehlende Spec für eine nötige Entscheidung
- **neue Dependency** wäre nötig (z.B. eine neue Library)
- technische Sackgasse (Beispiel siehe Schritt 0: Prisma-Enums auf SQLite)

**Unverändert (harte Regeln):**
- **Kein `git commit` ohne Lauras explizite Freigabe.**
- Vor dem Commit: `git status` **und** `git diff --cached` als **eigener Tool-Call** zeigen (Berichts-Skepsis).
- **Kein `git push` aus der Sandbox.** Push macht Laura vom Mac.
- **Kein `Co-Authored-By`-Trailer** in Commits.

---

## 2. Schritt 0 — Recherche (read-only, kein Edit)

Bericht in `BERICHTE/PHASE_B2b_SCHRITT0.md`, dazu 5–10 Zeilen Zusammenfassung im Chat. Prüfe:

1. **Aktuelles Prisma-Schema** — `app/backend/prisma/schema.prisma`. Welche Modelle existieren (User, Invite, Session)? Wie sind sie aufgebaut (cuid, Timestamps-Konvention)?
2. **Prisma-Enums auf SQLite** — **wichtig:** prüfe, ob der SQLite-Connector von Prisma in der aktuell installierten Version `enum` unterstützt. Falls **nicht**, ist der saubere Weg: `kategorie` als `String` speichern + zentrale Konstante `KATEGORIEN = ['alkoholfrei','alkoholisch','sonstiges']` + Laufzeit-Validierung (Zod ist bereits im Projekt). **Das darfst du selbst entscheiden** — kein STOPP nötig, nur im Schritt-0-Bericht dokumentieren, welchen Weg du gehst und warum. (Hinweis: das betrifft auch B2c/B2e später — `Transaktion.typ`, `KassenTransaktion.typ` sind ebenfalls Enums in der Spec. Wähle hier eine Linie, die dort wiederverwendbar ist.)
3. **Bestehendes Admin-Backend-Muster** — wie sind die `/admin/invites`-Routes aus B2a aufgebaut (`requireAuth + requireAdmin`, Response-Shape, Error-Handling)? Drink-Routes spiegeln dieses Muster.
4. **Bestehendes Admin-Frontend-Muster** — wie ist der `/admin`-Bereich + die Invite-Liste/-Form aufgebaut? Welche Primitives liegen schon vor (`Glass`, `GlassButton`, `GlassInput`, …)?
5. **Seed-Mechanik** — wie funktioniert `pnpm seed` aktuell (`app/backend/...`)? Wie wird ein Eintrag idempotent angelegt?

**Wenn Schritt 0 keinen echten Blocker (§1) zutage fördert: bau direkt weiter, ohne Zwischenstopp.** Nur bei echtem Blocker: STOPP + Laura fragen.

---

## 3. Das Drink-Modell (Spec, §5.2)

| Feld | Typ | Notiz |
|---|---|---|
| `id` | String (cuid) | Prisma-Default, wie bestehende Modelle |
| `name` | String | Anzeige-Name („Cola", „Bier klein") |
| `preisCent` | Int | Verkaufspreis in **Cent**. Niemals Float. `1,50 €` → `150` |
| `icon` | String, **optional** | Emoji-String („🥤", „🍺", „☕") |
| `kategorie` | Enum **oder** String (siehe Schritt 0) | fest: `alkoholfrei`, `alkoholisch`, `sonstiges` |
| `isActive` | Boolean, default `true` | Soft-Disable statt Hard-Delete |
| `createdAt` / `updatedAt` | DateTime | Standard-Audit, wie bestehende Modelle |

**Harte Regeln (aus §11):**
- Beträge **immer Cent als Int**.
- Kategorien **fest**, kein CRUD, **keine** user-definierten Kategorien.
- **Soft-Disable, kein Hard-Delete.** `isActive=false` blendet aus, löscht nicht — spätere Transaktionen referenzieren `drinkId` weiter.

---

## 4. Sub-Commits

Jeder Sub-Commit = eine logische Aussage, ohne „und" formulierbar. Diff-Bericht je Sub-Commit in `BERICHTE/PHASE_B2bX_DIFF.md`.

### B2b.2 — `Drink`-Modell ins Schema
- `Drink`-Modell in `schema.prisma` (Felder wie §3, Enum-/String-Entscheidung aus Schritt 0).
- `pnpm db:push`.
- **Nach `db:push`: Dev-Server neu starten** (sonst lädt `tsx watch` den neuen Prisma-Client nicht — bekannter Stolperstein).
- Noch kein UI, noch keine Routes.

### B2b.3 — Backend: Admin-CRUD-Endpoints für Drinks
Hinter `requireAuth + requireAdmin`, Muster wie `/admin/invites`. Empfohlene Form (Detailform darfst du anpassen):
- `GET /admin/drinks` — alle Drinks (inkl. inaktive), für die Verwaltung
- `POST /admin/drinks` — anlegen `{ name, preisCent, icon?, kategorie }`
- `PATCH /admin/drinks/:id` — bearbeiten `{ name?, preisCent?, icon?, kategorie? }`
- `PATCH /admin/drinks/:id/active` — `isActive` setzen (Soft-Disable/Enable)

Validierung (Zod, bereits im Projekt — **keine neue Dependency**): `name` nicht leer; `preisCent` ganzzahlig, `>= 0`; `kategorie` ∈ feste Liste.

### B2b.4 — Frontend: Admin-Drink-Katalog-Screen (Liste)
- Einstieg „🍺 Drink-Katalog" im Admin-Drawer/-Bereich (§7.2), nur für `isAdmin` sichtbar.
- Liste aller Drinks, **nach Kategorie gruppiert**.
- Primitive `DrinkCatalogRow` (§8): Zeile mit Icon, Name, Preis, **Aktiv/Inaktiv-Toggle**. Inaktive Drinks klar markiert (z.B. gedimmt), **nicht** ausgeblendet (Admin sieht alle).
- Vorhandene Glass-Primitives wiederverwenden.

### B2b.5 — Frontend: Drink anlegen / bearbeiten
- Sheet/Form mit Feldern: Name, Preis (Eingabe in €, intern Cent), Icon (Emoji), Kategorie (Auswahl aus den drei festen).
- Anlegen + Bearbeiten teilen sich dasselbe Form (Edit-Modus vorbefüllt).
- Nach Speichern: Liste aktualisiert sichtbar.

### B2b.6 — Seed: Beispiel-Getränke
- Bestehenden Seed erweitern, idempotent (Mechanik aus Schritt 0).
- Vorschlag (anpassbar): Cola 🥤 150 (alkoholfrei), Wasser 💧 100 (alkoholfrei), Apfelschorle 🍎 150 (alkoholfrei), Bier 🍺 200 (alkoholisch), Radler 🍻 200 (alkoholisch), Kaffee ☕ 100 (sonstiges).

---

## 5. Scope-Abgrenzung (bewusst NICHT in dieser Phase)

- **Kein** Mitglieder-`DrinkPicker` / Buchen-Flow — das ist **B2c**. (Hinweis: §8 labelt `DrinkPicker` lose als B2b; funktional gehört der member-seitige Picker zum Buchen-Flow. Hier nur die **Admin**-Seite.)
- **Keine** Transaktions-Logik, kein Guthaben — B2c.
- **Keine** Design-Politur über das Funktionale hinaus — visuelle Feinabstimmung ist **B5**. Tokens/Primitives nutzen, aber nicht über-investieren.

---

## 6. Done-Kriterien (Browser-Test am Phasenende)

Gebündelter STOPP, dann gemeinsam testen:
- [ ] `/admin` zeigt „Drink-Katalog"-Einstieg (nur als Admin)
- [ ] Liste zeigt geseedete Getränke, nach Kategorie gruppiert
- [ ] Neues Getränk anlegen → erscheint sofort in der Liste
- [ ] Getränk bearbeiten (z.B. Preis ändern) → Änderung sichtbar
- [ ] Aktiv/Inaktiv-Toggle → inaktiv klar markiert, nicht gelöscht
- [ ] Nicht-Admin sieht keinen Zugang zum Katalog
- [ ] `pnpm test` grün (falls Tests ergänzt)

---

## 7. Sandbox-Hinweise (Stolpersteine)

- Nach `db:push` (Schema-Änderung): **Dev-Server neu starten**, sonst alter Prisma-Client.
- Container hat **kein `pkill`/`ps`** — bei hängendem Prozess / belegtem Port: `docker restart claude-bwza-getraenke` (vom Mac).
- `db:reset` ist **kaputt** (ruft `prisma migrate reset` ohne `migrations/`-Ordner) — **nicht** verwenden. Für DB-Reset nur `db:push` + `seed`.
- Bei Docker-„socket not found": Docker Desktop ist nicht gestartet.
- Dev-Server: `cd app && pnpm dev` (Backend 4000, Vite 3001).

---

## 8. Commit-Ablauf am Ende (nach Lauras Freigabe)

1. Browser-Test mit Laura, Freigabe abwarten.
2. Pro Sub-Commit B2b.2 … B2b.6: `git status` + `git diff --cached` als eigener Tool-Call zeigen, dann committen (ohne `Co-Authored-By`).
3. **Kein Push.** Laura pusht vom Mac.
4. Danach: `BERICHTE/PHASE_B2b_ABSCHLUSS.md` (lokal, nicht im Git) mit Commit-Hashes + Zusammenfassung.
