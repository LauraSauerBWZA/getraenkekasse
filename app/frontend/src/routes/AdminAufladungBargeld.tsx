import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banknote, Check, Smartphone } from 'lucide-react';
import { EmptyState, Glass, GlassButton, GlassInput, Loading } from '../components/primitives';
import { BackBar } from '../components/BackBar';
import {
  api,
  ApiError,
  formatGuthaben,
  type AdminUser,
  type EinzahlungMethode,
  type KassenKonto,
} from '../lib/api';
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

// Geführter Einzahlungs-Flow (Bündel 3, Einheit 2):
//   mitglied → methode (Bar/PayPal) → betrag (+ bei Bar Topf/Box) → recap
//   (Zusammenfassung) → Bestätigen → Erfolgs-Popup → zurück in den Admin-Bereich.
type Phase = 'mitglied' | 'methode' | 'betrag' | 'recap';

// Zielkonto-Klartext für die Zusammenfassung.
function zielkontoText(methode: EinzahlungMethode, konto: KassenKonto): string {
  if (methode === 'PAYPAL') return 'Mein PayPal-Topf';
  return konto === 'VERWALTER' ? 'Mein Topf' : 'Bar-Vereinskasse (Box)';
}

export default function AdminAufladungBargeld() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const [phase, setPhase] = useState<Phase>('mitglied');
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [methode, setMethode] = useState<EinzahlungMethode>('BAR');
  const [konto, setKonto] = useState<KassenKonto>('VERWALTER');
  const [betragEuro, setBetragEuro] = useState('');
  const [vermerk, setVermerk] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Erfolgs-Popup: plopt auf und navigiert nach kurzer Zeit zurück.
  const [erfolg, setErfolg] = useState<string | null>(null);

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

  const betragCent = parsePreisToCent(betragEuro);

  // betrag → recap: Eingaben prüfen, dann zur Zusammenfassung.
  const weiterZuRecap = (e: FormEvent) => {
    e.preventDefault();
    if (betragCent === null) {
      setErr('Betrag bitte als z.B. „1,50" oder „10" angeben (positiv).');
      return;
    }
    if (!vermerk.trim()) {
      setErr('Vermerk ist Pflicht — kurzer Hinweis worauf sich die Einzahlung bezieht.');
      return;
    }
    setErr(null);
    setPhase('recap');
  };

  // recap → Bestätigen: buchen, dann Erfolgs-Popup, dann zurück.
  const bestaetigen = async () => {
    if (!selected || betragCent === null) return;
    setErr(null);
    setBusy(true);
    try {
      await api.adminAufladungEinzahlung({
        userId: selected.id,
        betragCent,
        vermerk: vermerk.trim(),
        methode,
        // konto ist nur bei BAR relevant; das Backend erzwingt bei PAYPAL VERWALTER.
        konto: methode === 'BAR' ? konto : 'VERWALTER',
      });
      setErfolg(`${selected.firstName} ${selected.lastName}: ${formatGuthaben(betragCent)} eingezahlt.`);
      // Kurz anzeigen, dann zurück in den Admin-Bereich (Aufladungen-Rubrik).
      window.setTimeout(() => navigate('/admin/aufladung-anfragen'), 1400);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Einzahlung fehlgeschlagen.');
      setBusy(false);
      // Bei Fehler zurück auf die Eingabe, damit der Admin korrigieren kann.
      setPhase('betrag');
    }
  };

  if (!user) return null;

  return (
    <div className="bwza-stage" style={{ padding: '0 var(--bwza-page-x) 40px' }}>
      <BackBar />
      <div style={{ paddingTop: 30, paddingBottom: 18 }}>
        <div className="bwza-eyebrow">Kasse · Einzahlung</div>
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
          Einzahlung
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--bwza-ink-dim)' }}>
          {phase === 'mitglied' && 'Mitglied auswählen, dem du eine Einzahlung gutschreiben möchtest.'}
          {phase === 'methode' &&
            `${selected!.firstName} ${selected!.lastName} · aktuelles Guthaben ${formatGuthaben(selected!.guthabenCent)}`}
          {phase === 'betrag' && (methode === 'BAR' ? 'Bargeld — Betrag, Vermerk und Zielkonto.' : 'PayPal — Betrag und Vermerk.')}
          {phase === 'recap' && 'Bitte prüfen und bestätigen.'}
        </div>
      </div>

      {phase === 'mitglied' && (
        <MitgliederWahl
          users={gefiltert}
          loadError={loadError}
          filter={filter}
          setFilter={setFilter}
          onPick={(u) => {
            setSelected(u);
            setErr(null);
            setPhase('methode');
          }}
        />
      )}

      {phase === 'methode' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <MethodeCard
            icon={Banknote}
            titel="Bargeld"
            sub="Bar gegeben — auf deinen Topf oder direkt in die Bar-Vereinskasse (Box)."
            onClick={() => {
              setMethode('BAR');
              setKonto('VERWALTER');
              setErr(null);
              setPhase('betrag');
            }}
          />
          <MethodeCard
            icon={Smartphone}
            titel="PayPal"
            sub="Direkt überwiesen — landet auf deinem PayPal-Topf. Ohne Anfrage."
            onClick={() => {
              setMethode('PAYPAL');
              setKonto('VERWALTER');
              setErr(null);
              setPhase('betrag');
            }}
          />
          <div style={{ marginTop: 4 }}>
            <GlassButton variant="ghost" full size="md" onClick={() => setPhase('mitglied')}>
              Anderes Mitglied
            </GlassButton>
          </div>
        </div>
      )}

      {phase === 'betrag' && (
        <form onSubmit={weiterZuRecap}>
          <Glass
            tone="dark"
            style={{ borderRadius: 22, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}
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
              placeholder={methode === 'BAR' ? 'z.B. Bar gegeben nach der Übung' : 'z.B. PayPal überwiesen 19.06.'}
              error={err}
            />

            {/* Konto-Wahl nur bei Bargeld — PayPal landet immer auf dem eigenen Topf. */}
            {methode === 'BAR' && (
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: 0.3,
                    color: 'var(--bwza-ink-dim)',
                    paddingLeft: 2,
                    marginBottom: 6,
                  }}
                >
                  BARGELD GEHT IN
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <GlassButton
                    type="button"
                    variant={konto === 'VERWALTER' ? 'primary' : 'ghost'}
                    size="sm"
                    full
                    onClick={() => setKonto('VERWALTER')}
                  >
                    Mein Topf
                  </GlassButton>
                  <GlassButton
                    type="button"
                    variant={konto === 'BOX' ? 'primary' : 'ghost'}
                    size="sm"
                    full
                    onClick={() => setKonto('BOX')}
                  >
                    Vereinskasse/Box
                  </GlassButton>
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--bwza-ink-mute)', lineHeight: 1.45 }}>
                  {konto === 'VERWALTER'
                    ? 'Geld liegt bei dir (Verwalter-Topf).'
                    : 'Geld liegt direkt in der gemeinsamen Bar-Kasse (Box).'}
                </div>
              </div>
            )}
          </Glass>

          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <GlassButton type="button" variant="ghost" full size="lg" onClick={() => { setErr(null); setPhase('methode'); }}>
              Zurück
            </GlassButton>
            <GlassButton type="submit" full size="lg">
              Weiter
            </GlassButton>
          </div>
        </form>
      )}

      {phase === 'recap' && selected && betragCent !== null && (
        <>
          <Glass tone="dark" style={{ borderRadius: 22, padding: '18px 16px' }}>
            <div className="bwza-eyebrow">Zusammenfassung</div>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <RecapRow label="Mitglied" value={`${selected.firstName} ${selected.lastName}`} />
              <RecapRow label="Methode" value={methode === 'BAR' ? 'Bargeld' : 'PayPal'} />
              <RecapRow label="Betrag" value={formatGuthaben(betragCent)} stark />
              <RecapRow label="Zielkonto" value={zielkontoText(methode, konto)} />
              <RecapRow label="Vermerk" value={vermerk.trim()} />
            </div>
          </Glass>

          {err && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--bwza-rescue-soft)' }}>{err}</div>}

          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <GlassButton variant="ghost" full size="lg" disabled={busy} onClick={() => { setErr(null); setPhase('betrag'); }}>
              Zurück
            </GlassButton>
            <GlassButton full size="lg" disabled={busy} onClick={() => void bestaetigen()}>
              {busy ? 'Buche …' : 'Bestätigen'}
            </GlassButton>
          </div>
        </>
      )}

      {/* Erfolgs-Popup — plopt auf, verschwindet mit der Navigation zurück. */}
      {erfolg && <ErfolgPopup text={erfolg} />}
    </div>
  );
}

function RecapRow({ label, value, stark }: { label: string; value: string; stark?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <span style={{ fontSize: 12, color: 'var(--bwza-ink-mute)', flexShrink: 0 }}>{label}</span>
      <span
        style={{
          fontSize: stark ? 16 : 13.5,
          fontWeight: stark ? 700 : 600,
          color: 'var(--bwza-ink)',
          textAlign: 'right',
          minWidth: 0,
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function MethodeCard({
  icon: Icon,
  titel,
  sub,
  onClick,
}: {
  icon: typeof Banknote;
  titel: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <Glass
      tone="dark"
      onClick={onClick}
      style={{ borderRadius: 18, padding: '16px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 42,
          height: 42,
          borderRadius: 12,
          background: 'var(--bwza-glass-line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--bwza-teal)',
        }}
      >
        <Icon size={22} strokeWidth={2} aria-hidden />
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--bwza-font-display)',
            fontSize: 17,
            fontWeight: 600,
            color: 'var(--bwza-ink)',
            letterSpacing: -0.2,
          }}
        >
          {titel}
        </div>
        <div style={{ marginTop: 2, fontSize: 11.5, color: 'var(--bwza-ink-mute)', lineHeight: 1.4 }}>{sub}</div>
      </div>
    </Glass>
  );
}

function ErfolgPopup({ text }: { text: string }) {
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--bwza-page-x)',
        zIndex: 60,
        animation: 'bwza-pop 160ms ease-out',
      }}
    >
      <Glass tone="amber" style={{ borderRadius: 22, padding: '22px 22px', maxWidth: 360, textAlign: 'center' }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'var(--bwza-success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
          }}
        >
          <Check size={28} strokeWidth={3} color="#04210f" aria-hidden />
        </div>
        <div style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 18, fontWeight: 600, color: 'var(--bwza-ink)' }}>
          Eingezahlt
        </div>
        <div style={{ marginTop: 4, fontSize: 13, color: 'var(--bwza-ink-dim)' }}>{text}</div>
      </Glass>
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
        <Loading />
      ) : users.length === 0 ? (
        <EmptyState title="Keine Treffer" sub="Andere Suche probieren." />
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
