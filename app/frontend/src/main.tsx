import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { AuthProvider } from './lib/auth';
import App from './App';
import './styles/global.css';

// PWA-Service-Worker registrieren (B6). registerType 'autoUpdate' → ein neuer SW
// wird sofort aktiv (kein Stale-Cache). Registriert nur im Secure Context
// (HTTPS/localhost); über LAN-IP per http passiert nichts — voll ab HTTPS/B8.
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
