import { useState, type PropsWithChildren } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Avatar, BergMark } from './primitives';
import { ProfileDrawer } from './ProfileDrawer';
import { useAuth } from '../lib/auth';

// Bottom-Nav: 3 Tabs (B5c-Feinschliff). „Buchen" ist kein Tab mehr — es ist über
// den Theke-CTA als Unter-Screen erreichbar (Route /buchen bleibt).
const TABS = [
  { to: '/', label: 'Theke', icon: '🏠' },
  { to: '/aufladen', label: 'Aufladen', icon: '💳' },
  { to: '/verlauf', label: 'Verlauf', icon: '🕒' },
];

// Persistente Shell für die Member-Screens: sticky Top-Header (Avatar→Drawer,
// Back-Pfeil auf Nicht-Tab-Routen wie /buchen) + persistente Bottom-Nav (3 Tabs).
export function MemberLayout({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);

  const istTab = TABS.some((t) => t.to === location.pathname);

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Sticky Top-Header */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 35,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px var(--bwza-page-x)',
          background: 'var(--bwza-glass)',
          backdropFilter: 'var(--bwza-blur-nav)',
          WebkitBackdropFilter: 'var(--bwza-blur-nav)',
          borderBottom: '1px solid var(--bwza-glass-line)',
        }}
      >
        {istTab ? (
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
        ) : (
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{
              all: 'unset',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--bwza-ink)',
              fontFamily: 'var(--bwza-font-ui)',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Zurück
          </button>
        )}
        <Avatar
          firstName={user?.firstName ?? ''}
          lastName={user?.lastName ?? ''}
          size={36}
          onClick={() => setDrawer(true)}
          ariaLabel="Profil"
        />
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
