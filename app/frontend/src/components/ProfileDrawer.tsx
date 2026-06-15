import { useNavigate } from 'react-router-dom';
import { Glass } from './primitives';
import { useAuth } from '../lib/auth';

function Initialen(vorname: string, nachname: string): string {
  return ((vorname[0] ?? '') + (nachname[0] ?? '')).toUpperCase() || '?';
}

// Profil-Drawer (B5a): Bottom-Sheet vom Avatar-Tap. Der Identitäts-Header ist die
// „Profil"-Fläche (es gibt keinen separaten Member-Profil-Screen); darunter
// rollenabhängige Einstiege + Logout. Kein Ästhetik-Feinschliff (B5b).
export function ProfileDrawer({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  const eintraege: { label: string; sub: string; to: string }[] = [];
  if (user.isAdmin) {
    eintraege.push({ label: 'Verwaltung', sub: 'Mitglieder, Drinks, Anfragen, Kasse, Statistik', to: '/admin' });
    eintraege.push({ label: 'Mein PayPal-Link', sub: 'paypal.me-Link für Aufladungen', to: '/admin/profil' });
  }
  if (user.isLeitung) {
    eintraege.push({ label: 'Kassen-Einsicht', sub: 'Finanz-Überblick (nur Lesen)', to: '/leitung' });
    eintraege.push({ label: 'Sortenstatistik', sub: 'Anzahl + Umsatz je Getränk', to: '/statistik' });
  }

  const rollen = [user.isAdmin && 'Verwalter', user.isLeitung && 'Leitung'].filter(Boolean).join(' · ');

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 'var(--bwza-page-x)',
        zIndex: 60,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480 }}>
        <Glass tone="raise" style={{ borderRadius: 22, padding: '18px 16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Identitäts-Header = Profil */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              aria-hidden
              style={{
                width: 46,
                height: 46,
                flexShrink: 0,
                borderRadius: 999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(180deg, #f4b56a, #d98a4a)',
                color: '#3a200a',
                fontFamily: 'var(--bwza-font-display)',
                fontWeight: 700,
                fontSize: 18,
              }}
            >
              {Initialen(user.firstName, user.lastName)}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontFamily: 'var(--bwza-font-display)',
                  fontSize: 18,
                  fontWeight: 600,
                  color: 'var(--bwza-ink)',
                  letterSpacing: -0.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user.firstName} {user.lastName}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--bwza-ink-mute)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user.email}
                {rollen && ` · ${rollen}`}
              </div>
            </div>
          </div>

          {eintraege.map((e) => (
            <Glass
              key={e.to}
              tone="dark"
              onClick={() => go(e.to)}
              style={{
                borderRadius: 14,
                padding: '12px 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 15, fontWeight: 600, color: 'var(--bwza-ink)' }}>
                  {e.label}
                </div>
                <div style={{ marginTop: 1, fontSize: 11, color: 'var(--bwza-ink-mute)' }}>{e.sub}</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--bwza-ink-dim)', flexShrink: 0 }} aria-hidden>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Glass>
          ))}

          <button
            type="button"
            onClick={() => void logout()}
            style={{
              all: 'unset',
              cursor: 'pointer',
              textAlign: 'center',
              padding: '12px',
              borderRadius: 14,
              border: '1px solid var(--bwza-glass-line)',
              color: 'var(--bwza-rescue-soft)',
              fontFamily: 'var(--bwza-font-ui)',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Abmelden
          </button>
        </Glass>
      </div>
    </div>
  );
}
