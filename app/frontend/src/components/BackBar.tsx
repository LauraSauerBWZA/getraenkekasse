import { useNavigate } from 'react-router-dom';

// Sticky Zurück-Leiste oben auf Unter-Screens (B5c-Feinschliff): bleibt beim
// Scrollen sichtbar (sticky), Glass-Stil. Standard-Ziel ist die vorige Seite
// (navigate(-1)); optional ein festes `to`. Spannt sich edge-to-edge innerhalb
// der `.bwza-stage` (negative horizontale Margin gegen das Seiten-Padding).
export function BackBar({ to, title }: { to?: string; title?: string }) {
  const navigate = useNavigate();
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        margin: '0 calc(-1 * var(--bwza-page-x)) 8px',
        padding: '10px var(--bwza-page-x)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'var(--bwza-glass)',
        backdropFilter: 'var(--bwza-blur-nav)',
        WebkitBackdropFilter: 'var(--bwza-blur-nav)',
        borderBottom: '1px solid var(--bwza-glass-line)',
      }}
    >
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
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Zurück
      </button>
      {title && (
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--bwza-ink-dim)', letterSpacing: -0.1 }}>
          · {title}
        </span>
      )}
    </div>
  );
}
