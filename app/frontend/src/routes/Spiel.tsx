import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

// Spiel-Route (B_GAME_INTEGRATION): bettet das same-origin ausgelieferte Phaser-
// Spiel per iframe ein. In Prod aus /game/ (Auth-Cookie kommt same-origin mit →
// echter eingeloggter User im Score-Submit), in Dev aus dem Standalone-Dev-Server
// :3002 (dort greift serverseitig der Dev-Stub-User, cross-origin ohne Cookie).
// Full-bleed ohne Bottom-Nav; „Zurück" führt zurück zur Theke.
export default function Spiel() {
  const navigate = useNavigate();
  const src = import.meta.env.DEV ? 'http://localhost:3002/' : '/game/';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        // Voller dynamischer Viewport (Bündel 5, Einheit 4): kein App-seitiges
        // Letterboxing. Verbleibende Balken kommen aus dem Spiel selbst
        // (app/game: Phaser Scale.FIT auf fixem 480×800) — nicht aus dieser Hülle.
        height: '100dvh',
        zIndex: 50,
        background: 'var(--bwza-bg)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => navigate('/')}
        style={{
          all: 'unset',
          cursor: 'pointer',
          position: 'absolute',
          top: 'calc(8px + env(safe-area-inset-top, 0px))',
          left: 'calc(10px + env(safe-area-inset-left, 0px))',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          color: 'var(--bwza-ink)',
          background: 'var(--bwza-glass)',
          backdropFilter: 'var(--bwza-blur-nav)',
          WebkitBackdropFilter: 'var(--bwza-blur-nav)',
          border: '1px solid var(--bwza-glass-line)',
          borderRadius: 999,
          padding: '6px 12px 6px 8px',
          fontFamily: 'var(--bwza-font-ui)',
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        <ChevronLeft size={18} strokeWidth={2.2} aria-hidden />
        Zurück
      </button>
      <iframe
        src={src}
        title="Bergwacht-Alpinist"
        allow="fullscreen; autoplay"
        style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
      />
    </div>
  );
}
