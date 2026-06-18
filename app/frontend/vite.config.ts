import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // B6 — installierbare PWA. autoUpdate: neuer SW übernimmt sofort (kein Stale-
    // Cache). Precache nur die gebaute App-Shell/statische Assets; `/api` wird
    // bewusst NICHT gecacht (Daten immer live). navigateFallback hält das SPA-
    // Routing in standalone am Leben (Refresh/Deep-Link → index.html).
    VitePWA({
      registerType: 'autoUpdate',
      // SW-Registrierung erfolgt explizit im Entry (main.tsx).
      injectRegister: false,
      // Statische Nicht-Build-Assets, die mit-precacht werden sollen.
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Bergwacht Getränkekasse',
        short_name: 'Getränke',
        description: 'Getränkekasse der Bergwacht Zollernalb — Guthaben, Buchen, Aufladen.',
        lang: 'de',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0D1116',
        theme_color: '#0D1116',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Nur App-Shell / statische Assets precachen.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        navigateFallback: 'index.html',
        // API-Pfade NICHT auf index.html fallbacken und nicht cachen — immer live.
        // /game/ ebenfalls ausnehmen (B_GAME_INTEGRATION): das same-origin per iframe
        // eingebettete Phaser-Spiel liegt im SW-Scope; ohne Denylist würde der
        // navigateFallback die /game/-Navigation mit der App-Shell (index.html)
        // beantworten statt das Spiel zu laden.
        navigateFallbackDenylist: [/^\/api/, /^\/game/],
        // Kein runtimeCaching → /api & sonstige Requests laufen NetworkOnly durch.
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      // Damit der SW auch auf dem Mac über `localhost` (Secure Context) im
      // Dev-Server registriert und in DevTools prüfbar ist. Über LAN-IP (http)
      // registriert kein Browser einen SW — Handy-Install voll erst ab HTTPS/B8.
      devOptions: { enabled: true, type: 'module', navigateFallback: 'index.html' },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 3001,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  preview: { port: 3001, strictPort: true },
});
