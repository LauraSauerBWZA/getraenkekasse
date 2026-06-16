import type { CSSProperties, PropsWithChildren } from 'react';

// Einheitlicher Scroll-Container für wachsende Listen. B5c-Feinschliff: als
// erkennbarer **Kasten** abgesetzt (Rahmen + Inset-Schatten + getönte Fläche)
// mit **dauerhaft sichtbarem** Custom-Scrollbalken (Klasse `bwza-scrolllist`,
// gestylt in global.css). Frontend-Scroll reicht (kein Backend-Paging).
export function ScrollList({
  children,
  maxHeight = 360,
  gap = 8,
  style,
}: PropsWithChildren<{ maxHeight?: number; gap?: number; style?: CSSProperties }>) {
  return (
    <div
      style={{
        borderRadius: 'var(--bwza-radius-md)',
        border: '1px solid var(--bwza-glass-line)',
        background: 'rgba(255,255,255,0.03)',
        boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.30)',
        padding: 6,
        ...style,
      }}
    >
      <div
        className="bwza-scrolllist"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap,
          maxHeight,
          overflowY: 'auto',
          // Platz für den sichtbaren Scrollbalken, damit Karten nicht darunter liegen
          paddingRight: 8,
        }}
      >
        {children}
      </div>
    </div>
  );
}
