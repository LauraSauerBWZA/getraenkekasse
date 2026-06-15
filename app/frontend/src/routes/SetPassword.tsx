import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Glass, BergMark, PasswordInput, GlassButton } from '../components/primitives';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

const STR_COLORS = ['oklch(58% 0.18 25)', 'oklch(70% 0.15 50)', 'oklch(78% 0.16 70)', 'oklch(72% 0.14 145)'];
const STR_LABELS = ['schwach', 'okay', 'gut', 'stark'];

export default function SetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const strength = useMemo(() => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  }, [pw]);

  const match = !!pw && pw === pw2;
  const ready = strength >= 2 && match && !!token;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setErr(null);
    setBusy(true);
    try {
      const { user } = await api.redeem(token, pw);
      setUser(user);
      navigate('/', { replace: true });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Aktivierung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div className="bwza-stage" style={{ padding: '60px var(--bwza-page-x)' }}>
        <div style={{ color: 'var(--bwza-rescue-soft)', fontSize: 14 }}>
          Kein Magic-Link-Token in der URL. Bitte den Link aus der Einladungs-Email vollständig öffnen.
        </div>
      </div>
    );
  }

  return (
    <div className="bwza-stage" style={{ padding: '0 var(--bwza-page-x) 40px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginTop: 30, marginBottom: 22, textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            padding: 16,
            borderRadius: 22,
            background: 'rgba(20,14,10,0.55)',
            border: '1px solid var(--bwza-glass-line)',
            boxShadow: 'inset 0 1px 0 rgba(255,225,180,0.08), 0 0 60px rgba(217,138,74,0.18)',
          }}
        >
          <BergMark size={36} />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontFamily: 'var(--bwza-font-display)',
            fontSize: 28,
            fontWeight: 600,
            color: 'var(--bwza-ink)',
            letterSpacing: -0.4,
            lineHeight: 1.05,
          }}
        >
          Setze dein Passwort.
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--bwza-ink-dim)' }}>
          Willkommen — leg los.
        </div>
      </div>

      <form onSubmit={submit}>
        <Glass tone="dark" style={{ borderRadius: 22, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <PasswordInput
              label="Neues Passwort"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoFocus
              id="new-password"
              name="new-password"
              autoComplete="new-password"
            />
            <div style={{ display: 'flex', gap: 4, marginTop: 8, alignItems: 'center' }}>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 4,
                    background: i < strength ? STR_COLORS[strength - 1] : 'rgba(255,225,180,0.08)',
                    transition: 'background var(--bwza-dur) var(--bwza-ease)',
                  }}
                />
              ))}
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: strength > 0 ? STR_COLORS[strength - 1] : 'var(--bwza-ink-mute)',
                  marginLeft: 6,
                  minWidth: 50,
                  textAlign: 'right',
                }}
              >
                {pw ? STR_LABELS[strength - 1] || STR_LABELS[0] : ''}
              </span>
            </div>
          </div>
          <PasswordInput
            label="Bestätigung"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            error={pw2 && !match ? 'Passwörter stimmen nicht überein.' : err}
            id="new-password-confirm"
            name="new-password-confirm"
            autoComplete="new-password"
          />
        </Glass>

        <div style={{ marginTop: 16 }}>
          <GlassButton type="submit" full size="lg" disabled={!ready || busy}>
            {busy ? 'Aktiviere …' : 'Account aktivieren'}
          </GlassButton>
        </div>
      </form>

      <div
        style={{
          marginTop: 14,
          fontSize: 11,
          color: 'var(--bwza-ink-mute)',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        Der Einladungs-Link ist nur einmal gültig.
      </div>
    </div>
  );
}
