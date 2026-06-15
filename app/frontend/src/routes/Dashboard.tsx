import { useNavigate } from 'react-router-dom';
import { Glass, GlassButton } from '../components/primitives';
import { useAuth } from '../lib/auth';
import { formatGuthaben } from '../lib/api';

// „Theke" (B5a): Guthaben groß + Quick-Buchung-CTA. Kein Navigations-Hub mehr —
// die Wege zu Buchen/Aufladen/Verlauf laufen über die Bottom-Nav, Admin/Leitung/
// Logout über den Profil-Drawer (beide im MemberLayout).
export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const negative = user.guthabenCent < 0;

  return (
    <div className="bwza-stage" style={{ padding: '0 var(--bwza-page-x) 40px' }}>
      <div style={{ paddingTop: 24, paddingBottom: 18 }}>
        <div className="bwza-eyebrow">Theke</div>
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
          Hallo {user.firstName}.
        </div>
      </div>

      <Glass tone="amber" style={{ borderRadius: 22, padding: '18px 18px 20px' }}>
        <div className="bwza-eyebrow">Guthaben</div>
        <div
          className={negative ? 'bwza-neg' : ''}
          style={{
            fontFamily: 'var(--bwza-font-display)',
            fontSize: 'var(--bwza-text-num)',
            fontWeight: 600,
            letterSpacing: -1,
            marginTop: 6,
            color: negative ? undefined : 'var(--bwza-ink)',
          }}
        >
          {formatGuthaben(user.guthabenCent)}
        </div>
        {negative && (
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--bwza-rescue-soft)' }}>
            Im Minus — lade über den Aufladen-Tab auf.
          </div>
        )}
      </Glass>

      {/* Quick-Buchung-CTA */}
      <div style={{ marginTop: 16 }}>
        <GlassButton full size="lg" onClick={() => navigate('/buchen')}>
          🍺 Getränk buchen
        </GlassButton>
      </div>
    </div>
  );
}
