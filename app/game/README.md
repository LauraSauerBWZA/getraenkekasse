# Bergwacht-Alpinist 🧗 (Phase B_GAME_ALPINIST)

Standalone Phaser.js Jump-&-Run im „Bergwacht-Rettungs"-Szenario: einen Alpinisten
zum Windenhaken des Hubschraubers hochklettern lassen. Später folgt die
React-Integration (Phase B_GAME_INTEGRATION).

## Stack

- **Engine:** Phaser 3 (Arcade-Physik)
- **Build:** Vite
- **Assets:** vorerst prozedurale Platzhalter-Texturen (`src/utils/textures.js`),
  echte Pixel-Art kommt als eigene Aufgabe — gleiche Textur-Keys.

## Entwicklung

Vom Monorepo-Root `app/`:

```bash
pnpm install                 # Phaser etc. (game ist Workspace-Mitglied)
pnpm --filter game dev       # Dev-Server auf http://localhost:3002
pnpm --filter game build     # Produktions-Build nach game/dist
```

Der Dev-Server proxyt `/api` → `http://localhost:4000` (Backend), damit die
Standalone-App gegen die Game-Score-Routen testen kann. Echter Auth-Flow
(eingeloggter User) erst in B_GAME_INTEGRATION; standalone via Dev-Stub-User.

## Struktur

```
src/
  index.js          Entry-Point (erzeugt Phaser.Game)
  config.js         Phaser-Config + Szenen-Liste
  constants.js      Farben (aus design-tokens), Physik, Score, Szenen-Keys
  scenes/           BootScene, MenuScene, Level1Scene, WinScene, GameOverScene
  sprites/          Player, Enemy, Platform, Collectible
  utils/            textures (Platzhalter), api (Score-Client), mobile (Touch)
public/assets/      sprites/ + sounds/ (später echte Assets)
```

## Steuerung

- **Desktop:** ← → bewegen, Leertaste springen
- **Mobile:** Swipe links/rechts bewegen, Tap unten springen (ab B_GAME.9)
