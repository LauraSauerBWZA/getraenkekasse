import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Glass, GlassButton, GlassInput } from '../components/primitives';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

// Eingabe → reiner Handle (ohne protocol / „paypal.me/"). Das Backend normalisiert
// nochmal; hier nur für die Live-Vorschau.
function toHandle(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^paypal\.me\//i, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

export default function AdminProfil() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [wert, setWert] = useState(user?.paypalMeLink ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (!user) return null;

  const handle = toHandle(wert);

  const speichern = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOk(null);
    setBusy(true);
    try {
      const r = await api.setMyPaypalLink(handle || null);
      await refresh();
      setWert(r.user.paypalMeLink ?? '');
      setOk(r.user.paypalMeLink ? 'Link gespeichert.' : 'Link entfernt.');
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Speichern fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const entfernen = async () => {
    setErr(null);
    setOk(null);
    setBusy(true);
    try {
      await api.setMyPaypalLink(null);
      await refresh();
      setWert('');
      setOk('Link entfernt.');
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Entfernen fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bwza-stage" style={{ padding: '0 var(--bwza-page-x) 40px' }}>
      <div style={{ paddingTop: 30, paddingBottom: 18 }}>
        <div className="bwza-eyebrow">Phase B2k · Profil</div>
        <div
          style={{
            fontFamily: 'var(--bwza-font-display)',
            fontSize: 30,
            fontWeight: 600,
            color: 'var(--bwza-ink)',
            letterSpacing: -0.4,
            marginTop: 4,
          }}
        >
          PayPal-Link
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--bwza-ink-dim)' }}>
          Mitglieder, die dir zugewiesen werden, zahlen über deinen paypal.me-Link.
        </div>
      </div>

      <form onSubmit={speichern}>
        <Glass
          tone="dark"
          style={{ borderRadius: 22, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <GlassInput
            label="paypal.me-Link oder Nutzername"
            value={wert}
            onChange={(e) => setWert(e.target.value)}
            placeholder="z.B. deinname oder paypal.me/deinname"
            error={err}
            autoFocus
          />
          <div style={{ fontSize: 12, color: 'var(--bwza-ink-mute)' }}>
            {handle ? (
              <>
                Vorschau:{' '}
                <span style={{ color: 'var(--bwza-ink-dim)' }}>paypal.me/{handle}</span>
              </>
            ) : (
              'Noch kein Link hinterlegt — du bekommst keine PayPal-Anfragen zugewiesen.'
            )}
          </div>
          {ok && <div style={{ fontSize: 12, color: 'var(--bwza-ink-dim)' }}>{ok}</div>}
        </Glass>

        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          {user.paypalMeLink && (
            <GlassButton variant="ghost" full size="lg" type="button" disabled={busy} onClick={() => void entfernen()}>
              Entfernen
            </GlassButton>
          )}
          <GlassButton type="submit" full size="lg" disabled={busy}>
            {busy ? 'Speichere …' : 'Speichern'}
          </GlassButton>
        </div>
      </form>

      <div style={{ marginTop: 22 }}>
        <GlassButton variant="ghost" full onClick={() => navigate('/admin')}>
          Zurück
        </GlassButton>
      </div>
    </div>
  );
}
