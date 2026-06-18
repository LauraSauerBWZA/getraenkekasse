import { defineConfig } from 'vite';

// Standalone Phaser-App (Phase B_GAME_ALPINIST). Eigener Port 3002, damit sie
// neben Frontend (3001) und Backend (4000) parallel laufen kann. Der /api-Proxy
// leitet API-Calls ans Backend — so kann die Standalone-App schon gegen die
// echten Game-Routen testen (Dev-Stub-User, echter Auth-Flow erst in
// B_GAME_INTEGRATION).
export default defineConfig({
  // Mount-agnostisch (B_GAME_INTEGRATION): relative Asset-Pfade, damit derselbe
  // Build sowohl standalone (Dev :3002 an Root) als auch same-origin unter /game/
  // (Prod, vom Backend ausgeliefert + per iframe eingebettet) ohne Hardcoding läuft.
  base: './',
  server: {
    host: '0.0.0.0',
    port: 3002,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  preview: { port: 3002, strictPort: true },
});
