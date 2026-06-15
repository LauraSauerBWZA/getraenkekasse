import { useState, type PropsWithChildren } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BergMark } from './primitives';
import { ProfileDrawer } from './ProfileDrawer';
import { useAuth } from '../lib/auth';

const TABS = [
  { to: '/', label: 'Theke', icon: '🏠' },
  { to: '/buchen', label: 'Buchen', icon: '🍺' },
  { to: '/aufladen', label: 'Aufladen', icon: '💳' },
  { to: '/verlauf', label: 'Verlauf', icon: '🕒' },
];

function Initialen(vorname: string, nachname: string): string {
  return ((vorname[0] ?? '') + (nachname[0] ?? '')).toUpperCase() || '?';
}

// Persistente Shell für die Member-Screens (B5a): schlanker Top-Header mit
// Avatar→Profil-Drawer + persistente Bottom-Nav (4 Tabs). Funktional mit
// bestehenden Tokens — kein Ästhetik-Feinschliff (B5b).
export function MemberLayout({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Top-Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px var(--bwza-page-x)',
          borderBottom: '1px solid var(--bwza-glass-line)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BergMark size={20} />
          <span
            style={{
              fontFamily: 'var(--bwza-font-display)',
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--bwza-ink)',
              letterSpacing: -0.2,
            }}
          >
            BWZA
          </span>
        </div>
        <button
          type="button"
          aria-label="Profil"
          onClick={() => setDrawer(true)}
          style={{
            all: 'unset',
            cursor: 'pointer',
            width: 36,
            height: 36,
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(180deg, #f4b56a, #d98a4a)',
            color: '#3a200a',
            fontFamily: 'var(--bwza-font-display)',
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {user ? Initialen(user.firstName, user.lastName) : '·'}
        </button>
      </header>

      {/* Inhalt — Platz für die fixierte Bottom-Nav lassen */}
      <div style={{ flex: 1, paddingBottom: 'calc(var(--bwza-nav-h) + 8px)' }}>{children}</div>

      {/* Bottom-Nav */}
      <nav
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          height: 'var(--bwza-nav-h)',
          display: 'flex',
          background: 'var(--bwza-glass)',
          backdropFilter: 'var(--bwza-blur-nav)',
          WebkitBackdropFilter: 'var(--bwza-blur-nav)',
          borderTop: '1px solid var(--bwza-glass-line)',
          boxShadow: 'var(--bwza-shadow-nav)',
          zIndex: 40,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {TABS.map((t) => {
          const aktiv = t.to === '/' ? location.pathname === '/' : location.pathname.startsWith(t.to);
          return (
            <button
              key={t.to}
              type="button"
              onClick={() => navigate(t.to)}
              style={{
                all: 'unset',
                cursor: 'pointer',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                paddingTop: 10,
                color: aktiv ? 'var(--bwza-amber)' : 'var(--bwza-ink-mute)',
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1, opacity: aktiv ? 1 : 0.75 }} aria-hidden>
                {t.icon}
              </span>
              <span style={{ fontSize: 10.5, fontWeight: aktiv ? 700 : 500, letterSpacing: 0.2 }}>
                {t.label}
              </span>
            </button>
          );
        })}
      </nav>

      {drawer && <ProfileDrawer onClose={() => setDrawer(false)} />}
    </div>
  );
}
