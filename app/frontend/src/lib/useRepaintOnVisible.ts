import { useEffect } from 'react';

// Behebt den „weißen Screen" nach Rückkehr aus dem Hintergrund in der iOS-Standalone-
// PWA (Bündel 6, Einheit 2): Wechselt das Mitglied z.B. zu PayPal und wieder zurück,
// lebt die App zwar weiter (gleiche Route/State, gleiche Stelle), die WebView zeichnet
// den bestehenden Compositor-Layer aber nicht neu → leerer/weißer Screen bis zur ersten
// Interaktion.
//
// Fix: beim Sichtbarwerden (visibilitychange → visible ODER pageshow) ein sanfter
// Compositor-Nudge OHNE Reload und OHNE State-Verlust. `opacity` ist eine
// compositor-only-Eigenschaft und erzwingt ein Neuzeichnen, ohne — anders als
// `transform`/`filter` — einen Containing-Block für die fixierte App-Shell aufzuspannen
// (die `position:fixed; height:100dvh`-Shell bleibt also viewport-verankert). 0,999 ist
// optisch unsichtbar (kein Flackern); der Reflow dazwischen erzwingt den Repaint.
//
// Einmal im App-Root aufrufen. Listener werden sauber abgemeldet, laufende rAFs
// gecancelt; der opacity-Wechsel löst weder pageshow noch visibilitychange aus → kein
// Loop. KEIN location.reload() (würde Route/Stelle/State verlieren).
export function useRepaintOnVisible(): void {
  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;

    let raf1 = 0;
    let raf2 = 0;

    const nudge = () => {
      if (document.visibilityState !== 'visible') return;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      raf1 = requestAnimationFrame(() => {
        root.style.opacity = '0.999';
        // Layout-Reflow erzwingen, damit der geänderte opacity-Wert auch wirklich
        // einen Frame zeichnet, bevor er zurückgesetzt wird.
        void root.offsetHeight;
        raf2 = requestAnimationFrame(() => {
          root.style.opacity = '';
        });
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') nudge();
    };
    // pageshow feuert auch beim bfcache-Restore (persisted) — dort ist der Nudge
    // genauso erwünscht.
    const onPageShow = () => nudge();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      root.style.opacity = '';
    };
  }, []);
}
