import { useEffect, useRef } from 'react';

// Ruft `onFocus` auf, sobald die Seite wieder in den Vordergrund kommt
// (window-`focus` oder Tab/PWA wieder sichtbar → `visibilitychange`). Für frische
// Daten beim Zurückkehren in die laufende App, ohne harten Reload. Der eigentliche
// Mount-Load bleibt separat (eigener useEffect in der Seite).
//
// Der Callback wird per Ref gehalten, damit die Listener nur EINMAL registriert
// werden — auch wenn `onFocus` bei jedem Render eine neue Identität hat.
export function useRefreshOnFocus(onFocus: () => void): void {
  const ref = useRef(onFocus);
  ref.current = onFocus;

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') ref.current();
    };
    window.addEventListener('focus', handler);
    document.addEventListener('visibilitychange', handler);
    return () => {
      window.removeEventListener('focus', handler);
      document.removeEventListener('visibilitychange', handler);
    };
  }, []);
}
