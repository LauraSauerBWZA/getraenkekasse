# Bergwacht Zollernalb — Getränkekasse

Mobile-first Web-App für die digitalisierte Getränkekasse der DRK Bergwacht Zollernalb.

## Stack

- **Frontend:** React 18 + Vite + TypeScript + TailwindCSS + Framer Motion
- **Backend:** Node 20 + Express + TypeScript + Prisma + SQLite
- **Auth:** Admin-Invite → Magic-Link → Passwort → JWT (HTTP-Only-Cookie)
- **Tests:** vitest (Backend Happy-Path)

## Quickstart

```bash
# 1. Abhängigkeiten installieren
pnpm install

# 2. Prisma-Schema in die DB pushen und Laura als Admin seeden
pnpm db:push
pnpm seed

# 3. Frontend (3001) + Backend (4000) gleichzeitig starten
pnpm dev
```

Der Seed gibt einen Magic-Link in der Backend-Konsole aus. Diesen im Browser öffnen → Passwort setzen → eingeloggt.

## Ports

- Frontend: `http://localhost:3001` (3000 war auf der Dev-Maschine durch Docker belegt)
- Backend:  `http://localhost:4000`
- Health-Check: `GET http://localhost:4000/health` → `{"status":"ok"}`

## Skripte

| Script | Wirkung |
|---|---|
| `pnpm dev` | Frontend + Backend parallel |
| `pnpm test` | vitest-Suite im Backend |
| `pnpm seed` | Erzeugt Laura als Admin und gibt Magic-Link aus |
| `pnpm db:push` | Pusht das Prisma-Schema in die SQLite-DB |
| `pnpm db:reset` | Löscht und resettet die DB (Achtung — destruktiv) |
| `pnpm build` | Production-Build beider Pakete |

## .env

Kopiere `.env.example` auf `app/backend/.env` und `app/frontend/.env`. In dieser Phase reicht der Wert aus der Example-Datei — Production-Secrets kommen später.
