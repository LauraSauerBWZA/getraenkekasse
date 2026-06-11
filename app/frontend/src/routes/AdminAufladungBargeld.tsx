import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Glass, GlassButton, GlassInput } from '../components/primitives';
import { api, ApiError, formatGuthaben, type AdminUser } from '../lib/api';
import { useAuth } from '../lib/auth';

// Eingabe „1,50" / „1.50" / „2" → 150/150/200 Cent. Null bei ungültig/leer/negativ.
function parsePreisToCent(input: string): number | null {
  const trimmed = input.trim().replace(',', '.');
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const euro = Number(trimmed);
  if (!Number.isFinite(euro) || euro <= 0) return null;
  return Math.round(euro * 100);
}

type Phase = 'wahl' | 'formular' | 'erfolg';

interface ErfolgsData {
  empfaenger: AdminUser;
  betragCent: number;
  neuesGuthabenCent: number;
}

export default function AdminAufladungBargeld() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [betragEuro, setBetragEuro] = useState('');
  const [vermerk, setVermerk] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [erfolg, setErfolg] = useState<ErfolgsData | null>(null);

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

  const phase: Phase = erfolg ? 'erfolg' : selected ? 'formular' : 'wahl';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const betragCent = parsePreisToCent(betragEuro);
    if (betragCent === null) {
      setErr('Betrag bitte als z.B. „1,50" oder „10" angeben (positiv).');
      return;
    }
    const vermerkTrim = vermerk.trim();
    if (!vermerkTrim) {
      setErr('Vermerk ist Pflicht — kurzer Hinweis worauf sich die Einzahlung bezieht.');
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const r = await api.adminAufladungBargeld({
        userId: selected.id,
        betragCent,
        vermerk: vermerkTrim,
      });
      setErfolg({
        empfaenger: selected,
        betragCent,
        neuesGuthabenCent: r.guthabenCent,
      });
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Aufladung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setSelected(null);
    setBetragEuro('');
    setVermerk('');
    setErr(null);
    setErfolg(null);
    void load(); // frisches guthabenCent
  };

  if (!user) return null;

  return (
    <div className="bwza-stage" style={{ padding: '0 var(--bwza-page-x) 40px' }}>
      <div style={{ paddingTop: 30, paddingBottom: 18 }}>
        <div className="bwza-eyebrow">Phase B2e · Kasse</div>
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
          Bargeld-Aufladung
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--bwza-ink-dim)' }}>
          {phase === 'wahl' && 'Mitglied auswählen, dem du Bargeld gutschreiben möchtest.'}
          {phase === 'formular' &&
            `${selected!.firstName} ${selected!.lastName} · aktuelles Guthaben ${formatGuthaben(selected!.guthabenCent)}`}
          {phase === 'erfolg' && 'Buchung gespeichert.'}
        </div>
      </div>

      {phase === 'wahl' && (
        <MitgliederWahl
          users={gefiltert}
          loadError={loadError}
          filter={filter}
          setFilter={setFilter}
          onPick={setSelected}
        />
      )}

      {phase === 'formular' && (
        <form onSubmit={submit}>
          <Glass
            tone="dark"
            style={{
              borderRadius: 22,
              padding: '18px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <GlassInput
              label="Betrag (€)"
              value={betragEuro}
              onChange={(e) => setBetragEuro(e.target.value)}
              placeholder="10,00"
              hint="Eingabe in Euro mit Komma oder Punkt, z.B. 10 oder 12,50"
              autoFocus
            />
            <GlassInput
              label="Vermerk (Pflicht)"
              value={vermerk}
              onChange={(e) => setVermerk(e.target.value)}
              placeholder="z.B. Bar gegeben nach der Übung"
              error={err}
            />
          </Glass>

          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <GlassButton variant="ghost" full size="lg" onClick={() => setSelected(null)}>
              Anderes Mitglied
            </GlassButton>
            <GlassButton type="submit" full size="lg" disabled={busy}>
              {busy ? 'Buche …' : 'Buchen'}
            </GlassButton>
          </div>
        </form>
      )}

      {phase === 'erfolg' && erfolg && (
        <Glass tone="amber" style={{ borderRadius: 22, padding: '18px 16px' }}>
          <div className="bwza-eyebrow">✓ Aufladung gebucht</div>
          <div
            style={{
              marginTop: 6,
              fontFamily: 'var(--bwza-font-display)',
              fontSize: 22,
              fontWeight: 600,
              color: 'var(--bwza-ink)',
              letterSpacing: -0.3,
            }}
          >
            {erfolg.empfaenger.firstName} {erfolg.empfaenger.lastName}
          </div>
          <div
            style={{
              marginTop: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              fontSize: 13,
              color: 'var(--bwza-ink-dim)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Aufgeladen</span>
              <span style={{ color: 'var(--bwza-ink)', fontWeight: 600 }}>
                + {formatGuthaben(erfolg.betragCent)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Neues Guthaben</span>
              <span
                style={{
                  color: erfolg.neuesGuthabenCent < 0 ? 'var(--bwza-rescue-soft)' : 'var(--bwza-ink)',
                  fontWeight: 600,
                }}
              >
                {formatGuthaben(erfolg.neuesGuthabenCent)}
              </span>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <GlassButton full size="md" onClick={reset}>
              Weitere Aufladung
            </GlassButton>
          </div>
        </Glass>
      )}

      <div style={{ marginTop: 22 }}>
        <GlassButton variant="ghost" full onClick={() => navigate('/admin')}>
          Zurück
        </GlassButton>
      </div>
    </div>
  );
}

function MitgliederWahl({
  users,
  loadError,
  filter,
  setFilter,
  onPick,
}: {
  users: AdminUser[] | null;
  loadError: string | null;
  filter: string;
  setFilter: (s: string) => void;
  onPick: (u: AdminUser) => void;
}) {
  return (
    <>
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
      ) : users === null ? (
        <Glass tone="dark" style={{ borderRadius: 18, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--bwza-ink-mute)' }}>Lädt …</div>
        </Glass>
      ) : users.length === 0 ? (
        <Glass tone="dark" style={{ borderRadius: 18, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--bwza-ink-mute)' }}>
            Keine Treffer.
          </div>
        </Glass>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {users.map((u) => (
            <MemberRow key={u.id} user={u} onPick={() => onPick(u)} />
          ))}
        </div>
      )}
    </>
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
