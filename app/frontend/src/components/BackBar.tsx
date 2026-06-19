import { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Home } from 'lucide-react';
import { useAuth } from '../lib/auth';

// Zurück-Leiste oben auf den Admin-/Leitung-Unter-Screens.
//
// 3. Anlauf (Bündel 1): bewusst KEIN `position: sticky` mehr. Sticky pinnt relativ
// zum nächsten Scroll-Vorfahr und ist hier fragil — die meisten Admin-Seiten
// scrollen ihren Body gar nicht (lange Listen stecken in `ScrollList`), nur
// `AdminEinladen` wird hoch genug und zeigte, dass die in `.bwza-stage` eingebettete
// sticky-Leiste nicht zuverlässig oben klebt. Stattdessen `position: fixed`
// (viewport-verankert) + ein In-Flow-Spacer in exakter Leistenhöhe, damit der
// Inhalt nicht darunter rutscht. `fixed` ist robust, weil kein Vorfahr (html/body/
// #root) einen transformierten Containing-Block aufspannt. Safe-Area bleibt im
// Padding berücksichtigt (`env(safe-area-inset-*)`). Inhalt auf Stage-Breite
// zentriert (passt zur `.bwza-stage`), Chrome blutet edge-to-edge.
export function BackBar({ to, title, home = '/admin' }: { to?: string; title?: string; home?: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const barRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  // Leistenhöhe messen (inkl. Safe-Area-Padding) und als Spacer-Höhe spiegeln.
  // ResizeObserver fängt Orientierungs-/Safe-Area-Änderungen ohne festen px-Wert.
  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const update = () => setHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <>
      <div
        ref={barRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 30,
          background: 'var(--bwza-glass)',
          backdropFilter: 'var(--bwza-blur-nav)',
          WebkitBackdropFilter: 'var(--bwza-blur-nav)',
          borderBottom: '1px solid var(--bwza-glass-line)',
          // Safe-Area oben: BackBar ist auf Admin-/Leitung-Screens die oberste
          // Leiste → +inset-top schiebt „Zurück" unter die iOS-Statusleiste.
          paddingTop: 'calc(10px + env(safe-area-inset-top, 0px))',
          paddingBottom: 10,
        }}
      >
        {/* Inhalt auf Stage-Breite zentriert (deckungsgleich mit `.bwza-stage`). */}
        <div
          style={{
            maxWidth: 'var(--bwza-screen-w)',
            margin: '0 auto',
            paddingLeft: 'calc(var(--bwza-page-x) + env(safe-area-inset-left, 0px))',
            paddingRight: 'calc(var(--bwza-page-x) + env(safe-area-inset-right, 0px))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          {/* Links: „Zurück" (eine Ebene) + optionaler Titel. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <button
              type="button"
              onClick={() => (to ? navigate(to) : navigate(-1))}
              style={{
                all: 'unset',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                minHeight: 'var(--bwza-tap)',
                color: 'var(--bwza-ink)',
                fontFamily: 'var(--bwza-font-ui)',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <ChevronLeft size={18} strokeWidth={2.2} aria-hidden />
              Zurück
            </button>
            {title && (
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--bwza-ink-dim)', letterSpacing: -0.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                · {title}
              </span>
            )}
          </div>

          {/* Rechts: dezenter Home-Button → Admin-Hub (Verwaltungs-Startseite).
              Bündel 4, Einheit 3. Nur für Admins (Leitung-only erreicht /admin nicht);
              „Zurück" bleibt davon unberührt (eine Ebene zurück). */}
          {user?.isAdmin && (
            <button
              type="button"
              onClick={() => navigate(home)}
              aria-label="Zur Verwaltungs-Startseite"
              style={{
                all: 'unset',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 'var(--bwza-tap)',
                minHeight: 'var(--bwza-tap)',
                color: 'var(--bwza-ink-dim)',
                flexShrink: 0,
              }}
            >
              <Home size={19} strokeWidth={2.1} aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* In-Flow-Spacer: hält exakt die Höhe der fixierten Leiste frei. */}
      <div aria-hidden style={{ height: height || undefined }} />
    </>
  );
}
