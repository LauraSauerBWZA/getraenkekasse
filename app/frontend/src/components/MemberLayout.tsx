import { useLayoutEffect, useState, type PropsWithChildren } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Gamepad2, History, Home, Wallet } from 'lucide-react';
import { Avatar, BergMark } from './primitives';
import { ProfileDrawer } from './ProfileDrawer';
import { useAuth } from '../lib/auth';

// Bottom-Nav: 3 Tabs (B5c-Feinschliff). „Buchen" ist kein Tab mehr — es ist über
// den Theke-CTA als Unter-Screen erreichbar (Route /buchen bleibt).
// B5-Icons: lucide-Line-Icons statt Emoji (Home/Wallet/History), aktiv in Teal.
const TABS = [
  { to: '/', label: 'Theke', icon: Home },
  { to: '/aufladen', label: 'Aufladen', icon: Wallet },
  { to: '/verlauf', label: 'Verlauf', icon: History },
];

// 🎮-Spiel-Tab (B_GAME_INTEGRATION) — nur für Admins. Wird unten an die Tab-Liste
// gehängt, wenn isAdmin. Die Route /spiel ist zusätzlich admin-gegateet (App.tsx),
// d.h. auch per Direktlink für Nicht-Admins gesperrt.
const SPIEL_TAB = { to: '/spiel', label: 'Spiel', icon: Gamepad2 };

// Persistente Shell für die Member-Screens: Top-Header (Avatar→Drawer, Back-Pfeil
// auf Nicht-Tab-Routen wie /buchen) + persistente Bottom-Nav (3 Tabs).
//
// Höhenmodell (Bündel 3 → 5): Die Shell ist eine **fixierte Flex-Spalte**, der
// mittlere Bereich ist der EINZIGE Scroller, die Bottom-Nav ist die unterste
// **Flex-Zeile** (kein `position:fixed`); der Safe-Area-Inset wirkt als Padding
// INNERHALB der Leiste.
//
// Bündel 5, Einheit 3: Shell an den **dynamischen Viewport** gebunden —
// `position:fixed; top/left/right:0; height:100dvh` statt `inset:0`. Grund:
// `inset:0` (≙ bottom:0) ankerte die Unterkante in iOS-**Standalone** an der
// safe-area-AUSGESCHLOSSENEN Viewportkante → ein Charcoal-Spalt unter der Nav; in
// **Safari** an der Layout-Viewport (hinter der Adressleiste) → Nav verdeckt.
// `100dvh` misst in beiden Kontexten die SICHTBARE Höhe: Standalone = Vollbild bis
// zur Kante (Nav-bg füllt die Safe-Area, Tab-Inhalt per env() über dem Indicator),
// Safari = Höhe ohne Adressleiste (Nav sitzt darüber). Der Body-Lock (Bündel 4)
// bleibt. Kompromiss Safari: beim Ein-/Ausblenden der Leiste wandert die Nav mit
// dem dvh — akzeptiert (PWA hat Priorität).
export function MemberLayout({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);

  // Dokument-Scroll sperren, solange eine Member-Route aktiv ist (Bündel 4,
  // Einheit 2): unterbindet den iOS-Standalone-Rubber-Band, der die fixierte Shell
  // (v.a. die untere Nav) sonst beim Wischen mitzieht. useLayoutEffect (synchron vor
  // Paint) hält die Klasse beim Wechsel zwischen Member-Routen ohne Flackern. Beim
  // Unmount (Wechsel auf Admin/Login) entfernt → dort scrollt der Body wieder normal.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add('bwza-app-locked');
    return () => root.classList.remove('bwza-app-locked');
  }, []);

  // Admins sehen einen zusätzlichen 🎮-Tab; Mitglieder die unveränderten 3 Tabs.
  const tabs = user?.isAdmin ? [...TABS, SPIEL_TAB] : TABS;
  const istTab = tabs.some((t) => t.to === location.pathname);

  // Nav-Höhe/-Padding kommen aus den Tokens (Bündel 7: eine Quelle, damit Member-
  // Bottom-Sheets exakt über der Nav enden können). --bwza-nav-pad = kompaktes
  // Home-Indicator-Padding (Bündel 6), --bwza-nav-total = Gesamthöhe inkl. Safe-Area.

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        // Dynamischer Viewport (Bündel 5): in PWA Vollbild bis zur Kante, in Safari
        // ohne Adressleiste → Nav sitzt in beiden Fällen bündig/sichtbar unten.
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Top-Header — oberste Flex-Zeile der Shell (nicht mehr sticky nötig). */}
      <header
        style={{
          flexShrink: 0,
          zIndex: 35,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          // Safe-Area oben: im iOS-Standalone liegt der Inhalt unter der
          // Statusleiste (status-bar-style black-translucent). +inset-top schiebt
          // Zurück/Profil darunter. Seitliche Insets für Querformat/Notch. Desktop
          // (alle Insets 0) unverändert.
          paddingTop: 'calc(10px + env(safe-area-inset-top, 0px))',
          paddingBottom: '10px',
          paddingLeft: 'calc(var(--bwza-page-x) + env(safe-area-inset-left, 0px))',
          paddingRight: 'calc(var(--bwza-page-x) + env(safe-area-inset-right, 0px))',
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
            <ChevronLeft size={18} strokeWidth={2.2} aria-hidden />
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

      {/* Inhalt — der EINZIGE Scroller. `min-height:0` lässt die Flex-Zeile unter
          ihren Inhalt schrumpfen (sonst kein internes Scrollen). overscroll-contain
          hält das Gummiband im Bereich, statt die ganze Shell zu wackeln. */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'contain',
        }}
      >
        {children}
      </div>

      {/* Bottom-Nav — unterste Flex-Zeile (kein position:fixed mehr). Das
          Home-Indicator-Inset wirkt als paddingBottom INNERHALB der Leiste; sie
          selbst sitzt durch das Flex-Layout sofort korrekt am unteren Rand. */}
      <nav
        style={{
          flexShrink: 0,
          // Gesamthöhe inkl. Safe-Area aus den Tokens; darunter nur der schmale
          // --bwza-nav-pad statt des vollen Insets (border-box, kompakt).
          minHeight: 'var(--bwza-nav-total)',
          display: 'flex',
          background: 'var(--bwza-glass)',
          backdropFilter: 'var(--bwza-blur-nav)',
          WebkitBackdropFilter: 'var(--bwza-blur-nav)',
          borderTop: '1px solid var(--bwza-glass-line)',
          boxShadow: 'var(--bwza-shadow-nav)',
          zIndex: 40,
          paddingBottom: 'var(--bwza-nav-pad)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)',
        }}
      >
        {tabs.map((t) => {
          const aktiv = t.to === '/' ? location.pathname === '/' : location.pathname.startsWith(t.to);
          const Icon = t.icon;
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
                gap: 4,
                paddingTop: 10,
                color: aktiv ? 'var(--bwza-teal)' : 'var(--bwza-ink-mute)',
              }}
            >
              <Icon size={22} strokeWidth={aktiv ? 2.4 : 2} aria-hidden />
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
