import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Glass, GlassButton } from './primitives';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

// Profil-Drawer (B5a): Bottom-Sheet vom Avatar-Tap. Der Identitäts-Header ist die
// „Profil"-Fläche (es gibt keinen separaten Member-Profil-Screen); darunter
// rollenabhängige Einstiege + Datenexport/Konto-Löschung + Logout (Account-A).
export function ProfileDrawer({ onClose }: { onClose: () => void }) {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!user) return null;

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  // Eigene Daten als JSON herunterladen (Account-A §3.4, §9). Nur eigene Daten.
  const exportieren = async () => {
    setErr(null);
    setExporting(true);
    try {
      const data = await api.meExport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'getraenkekasse-export.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Export fehlgeschlagen.');
    } finally {
      setExporting(false);
    }
  };

  // Eigenes Konto löschen (Account-A §3.3): Soft-Delete + sofort ausgeloggt.
  const loeschen = async () => {
    setErr(null);
    setBusy(true);
    try {
      await api.deleteMe();
      setUser(null);
      onClose();
      navigate('/');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Konto konnte nicht gelöscht werden.');
      setBusy(false);
    }
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
            <Avatar firstName={user.firstName} lastName={user.lastName} size={46} />
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

          {/* Meine Daten (Account-A): Export + Konto-Löschung */}
          <div style={{ height: 1, background: 'var(--bwza-glass-line)', margin: '2px 0' }} />

          <GlassButton variant="ghost" full size="md" disabled={exporting} onClick={() => void exportieren()}>
            {exporting ? 'Exportiere …' : 'Meine Daten exportieren'}
          </GlassButton>

          {!confirmDelete ? (
            <GlassButton
              variant="quiet"
              full
              size="md"
              onClick={() => {
                setErr(null);
                setConfirmDelete(true);
              }}
              style={{ color: 'var(--bwza-rescue-soft)' }}
            >
              Konto löschen
            </GlassButton>
          ) : (
            <Glass tone="dark" style={{ borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12.5, color: 'var(--bwza-ink)', lineHeight: 1.5 }}>
                Dein Konto wird gelöscht — du wirst abgemeldet und kannst dich nicht mehr einloggen.
                <strong> Restguthaben bitte vorher mit dem Verwalter klären.</strong>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <GlassButton variant="ghost" full size="sm" disabled={busy} onClick={() => setConfirmDelete(false)}>
                  Abbrechen
                </GlassButton>
                <GlassButton variant="danger" full size="sm" disabled={busy} onClick={() => void loeschen()}>
                  {busy ? 'Lösche …' : 'Konto löschen'}
                </GlassButton>
              </div>
            </Glass>
          )}

          {err && (
            <div style={{ fontSize: 12, color: 'var(--bwza-rescue-soft)', textAlign: 'center' }}>{err}</div>
          )}

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
