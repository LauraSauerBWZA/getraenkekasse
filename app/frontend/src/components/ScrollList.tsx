import type { CSSProperties, PropsWithChildren } from 'react';

// Einheitlicher Scroll-Container für wachsende Listen (B5a): feste Maximalhöhe,
// interner Scroll — die Seite wächst nicht mehr unbegrenzt. Bei ~30 Mitgliedern
// reicht reines Frontend-Scrollen (alle Einträge gerendert, keine Backend-
// Paginierung). Sortierung (neueste zuerst) bleibt Sache der Daten.
export function ScrollList({
  children,
  maxHeight = 380,
  gap = 8,
  style,
}: PropsWithChildren<{ maxHeight?: number; gap?: number; style?: CSSProperties }>) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap,
        maxHeight,
        overflowY: 'auto',
        // etwas Platz für die Scrollbar, damit Karten-Ränder nicht abgeschnitten wirken
        paddingRight: 2,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
