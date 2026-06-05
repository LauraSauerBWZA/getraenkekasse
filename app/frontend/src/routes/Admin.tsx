import { useNavigate } from 'react-router-dom';
import { Glass, GlassButton } from '../components/primitives';
import { useAuth } from '../lib/auth';

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <div className="bwza-stage" style={{ padding: '0 var(--bwza-page-x) 40px' }}>
      <div style={{ paddingTop: 30, paddingBottom: 18 }}>
        <div className="bwza-eyebrow">Phase B2a · Verwaltung</div>
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
          Verwaltung
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--bwza-ink-dim)' }}>
          Mitglieder einladen und verwalten.
        </div>
      </div>

      <Glass tone="dark" style={{ borderRadius: 22, padding: '18px 18px 20px' }}>
        <div className="bwza-eyebrow">Platzhalter</div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--bwza-ink-dim)' }}>
          Hier folgt das Invite-Formular (B2a.3) und die Liste ausgestellter Invites (B2a.4).
        </div>
      </Glass>

      <div style={{ marginTop: 22 }}>
        <GlassButton variant="ghost" full onClick={() => navigate('/')}>
          Zurück
        </GlassButton>
      </div>
    </div>
  );
}
