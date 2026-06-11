import { useNavigate } from 'react-router-dom';
import { Glass, GlassButton } from '../components/primitives';
import { useAuth } from '../lib/auth';
import { formatGuthaben } from '../lib/api';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const negative = user.guthabenCent < 0;

  return (
    <div className="bwza-stage" style={{ padding: '0 var(--bwza-page-x) 40px' }}>
      <div style={{ paddingTop: 30, paddingBottom: 18 }}>
        <div className="bwza-eyebrow">Phase 1 · Grundgerüst</div>
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
          Hallo {user.firstName}, du bist drin.
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--bwza-ink-dim)' }}>
          {user.isAdmin ? 'Admin · Bergwacht Zollernalb' : 'Bergwacht Zollernalb'}
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
      </Glass>

      <Glass
        tone="dark"
        onClick={() => navigate('/buchen')}
        style={{
          borderRadius: 18,
          padding: '14px 16px',
          marginTop: 14,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div className="bwza-eyebrow">🍺 Buchen</div>
          <div
            style={{
              fontFamily: 'var(--bwza-font-display)',
              fontSize: 17,
              fontWeight: 600,
              color: 'var(--bwza-ink)',
              marginTop: 2,
              letterSpacing: -0.2,
            }}
          >
            Getränk buchen
          </div>
          <div style={{ marginTop: 2, fontSize: 11, color: 'var(--bwza-ink-mute)' }}>
            Sorte wählen, bestätigen, fertig
          </div>
        </div>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{ color: 'var(--bwza-ink-dim)', flexShrink: 0 }}
          aria-hidden
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </Glass>

      {user.isAdmin && (
        <Glass
          tone="dark"
          onClick={() => navigate('/admin')}
          style={{
            borderRadius: 18,
            padding: '14px 16px',
            marginTop: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div className="bwza-eyebrow">Admin</div>
            <div
              style={{
                fontFamily: 'var(--bwza-font-display)',
                fontSize: 17,
                fontWeight: 600,
                color: 'var(--bwza-ink)',
                marginTop: 2,
                letterSpacing: -0.2,
              }}
            >
              Verwaltung
            </div>
            <div style={{ marginTop: 2, fontSize: 11, color: 'var(--bwza-ink-mute)' }}>
              Mitglieder einladen
            </div>
          </div>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ color: 'var(--bwza-ink-dim)', flexShrink: 0 }}
            aria-hidden
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Glass>
      )}

      <div style={{ marginTop: 22, display: 'flex', gap: 10 }}>
        <GlassButton variant="ghost" full onClick={() => void logout()}>
          Abmelden
        </GlassButton>
      </div>

      <div style={{ marginTop: 22, fontSize: 11, color: 'var(--bwza-ink-mute)', textAlign: 'center' }}>
        Eingeloggt als <strong style={{ color: 'var(--bwza-ink-dim)' }}>{user.email}</strong>
      </div>
    </div>
  );
}
