import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Glass, ShineEdge, BergMark, GlassInput, PasswordInput, GlassButton } from '../components/primitives';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !pw) {
      setErr('Bitte Email und Passwort eingeben.');
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const { user } = await api.login(email.trim(), pw);
      setUser(user);
      navigate('/', { replace: true });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Login fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bwza-stage" style={{ padding: '0 var(--bwza-page-x) 40px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginTop: 30, marginBottom: 22, textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            padding: 18,
            borderRadius: 24,
            background: 'rgba(20,14,10,0.55)',
            border: '1px solid var(--bwza-glass-line)',
            boxShadow: 'inset 0 1px 0 rgba(255,225,180,0.08), 0 0 60px rgba(217,138,74,0.18)',
          }}
        >
          <BergMark size={42} color="#d98a4a" />
        </div>
      </div>

      <Glass tone="dark" style={{ borderRadius: 26, padding: '22px 20px 18px', position: 'relative' }}>
        <ShineEdge radius={26} />
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div
            style={{
              fontFamily: 'var(--bwza-font-display)',
              fontSize: 26,
              fontWeight: 600,
              color: 'var(--bwza-ink)',
              letterSpacing: -0.4,
            }}
          >
            Willkommen zurück.
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--bwza-ink-mute)' }}>
            Bergwacht Zollernalb · Getränkekasse
          </div>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <GlassInput
            label="E-Mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vorname.nachname@…"
          />
          <PasswordInput
            label="Passwort"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            error={err}
          />
          <GlassButton type="submit" full size="lg" disabled={busy} onClick={() => undefined}>
            {busy ? 'Moment …' : 'Anmelden'}
          </GlassButton>
        </form>
      </Glass>

      <div
        style={{
          marginTop: 'auto',
          paddingTop: 24,
          textAlign: 'center',
          fontSize: 11,
          color: 'var(--bwza-ink-mute)',
          lineHeight: 1.5,
        }}
      >
        Noch keinen Zugang?
        <br />
        Sprich deinen Getränkeverwalter an.
      </div>
    </div>
  );
}
