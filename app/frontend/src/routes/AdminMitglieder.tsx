import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState, Glass, GlassButton, GlassInput, Loading } from '../components/primitives';
import { ScrollList } from '../components/ScrollList';
import { api, ApiError, formatGuthaben, type AdminUser } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function AdminMitglieder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const r = await api.adminUsers();
      setUsers(r.users);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Mitgliederliste konnte nicht geladen werden.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const gefiltert = useMemo(() => {
    if (!users) return null;
    const q = filter.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  }, [users, filter]);

  if (!user) return null;

  return (
    <div className="bwza-stage" style={{ padding: '0 var(--bwza-page-x) 40px' }}>
      <div style={{ paddingTop: 30, paddingBottom: 18 }}>
        <div className="bwza-eyebrow">Phase B2g · Verwaltung</div>
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
          Mitglieder
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--bwza-ink-dim)' }}>
          Saldo je Mitglied — antippen für Detail, Korrektur und Storno.
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <GlassInput
          label="Mitglied suchen"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Name oder Email"
        />
      </div>

      {loadError ? (
        <Glass tone="dark" style={{ borderRadius: 18, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--bwza-rescue-soft)' }}>{loadError}</div>
        </Glass>
      ) : gefiltert === null ? (
        <Loading />
      ) : gefiltert.length === 0 ? (
        <EmptyState title="Keine Treffer" sub="Andere Suche probieren." />
      ) : (
        <ScrollList>
          {gefiltert.map((u) => (
            <MemberRow key={u.id} user={u} onPick={() => navigate(`/admin/mitglieder/${u.id}`)} />
          ))}
        </ScrollList>
      )}

      <div style={{ marginTop: 22 }}>
        <GlassButton variant="ghost" full onClick={() => navigate('/admin')}>
          Zurück
        </GlassButton>
      </div>
    </div>
  );
}

function MemberRow({ user, onPick }: { user: AdminUser; onPick: () => void }) {
  const negativ = user.guthabenCent < 0;
  return (
    <Glass
      tone="dark"
      onClick={onPick}
      style={{
        borderRadius: 16,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontFamily: 'var(--bwza-font-display)',
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--bwza-ink)',
            letterSpacing: -0.1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {user.firstName} {user.lastName}
          {user.isAdmin && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.4,
                color: 'var(--bwza-ink-mute)',
                textTransform: 'uppercase',
              }}
            >
              admin
            </span>
          )}
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
        </div>
      </div>
      <div
        style={{
          flexShrink: 0,
          fontSize: 13,
          fontWeight: 600,
          color: negativ ? 'var(--bwza-rescue-soft)' : 'var(--bwza-ink)',
        }}
      >
        {formatGuthaben(user.guthabenCent)}
      </div>
    </Glass>
  );
}
