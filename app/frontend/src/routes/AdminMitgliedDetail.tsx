import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EmptyState, Glass, GlassButton, GlassInput, Loading } from '../components/primitives';
import { ScrollList } from '../components/ScrollList';
import {
  api,
  ApiError,
  formatGuthaben,
  type AdminUserDetail,
  type DetailTransaktion,
  type TransaktionTyp,
} from '../lib/api';
import { useAuth } from '../lib/auth';

const TYP_LABEL: Record<TransaktionTyp, string> = {
  KAUF: 'Kauf',
  AUFLADUNG_PAYPAL: 'PayPal-Aufladung',
  AUFLADUNG_BARGELD: 'Bargeld-Aufladung',
  KORREKTUR: 'Korrektur',
  STORNO: 'Storno',
};

// Vorzeichen-behaftete Betragsanzeige fürs Ledger: „+ 10,00 €" / „− 1,50 €".
function formatSigned(cent: number): string {
  const vz = cent > 0 ? '+ ' : cent < 0 ? '− ' : '';
  const abs = Math.abs(cent);
  return vz + (abs / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function formatZeit(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Signierte Euro-Eingabe → Cent. „-5", „-5,00", „12,5" → -500/-500/1250.
// Null bei ungültig/leer/0.
function parseSignedEuroToCent(input: string): number | null {
  const trimmed = input.trim().replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const euro = Number(trimmed);
  if (!Number.isFinite(euro)) return null;
  const cent = Math.round(euro * 100);
  return cent === 0 ? null : cent;
}

export default function AdminMitgliedDetail() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [txs, setTxs] = useState<DetailTransaktion[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const r = await api.adminUserDetail(id);
      setDetail(r.user);
      setTxs(r.transaktionen);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Mitglied konnte nicht geladen werden.');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) return null;

  const negativ = (detail?.guthabenCent ?? 0) < 0;

  return (
    <div className="bwza-stage" style={{ padding: '0 var(--bwza-page-x) 40px' }}>
      <div style={{ paddingTop: 30, paddingBottom: 16 }}>
        <div className="bwza-eyebrow">Phase B2g · Mitglied</div>
        <div
          style={{
            fontFamily: 'var(--bwza-font-display)',
            fontSize: 28,
            fontWeight: 600,
            color: 'var(--bwza-ink)',
            letterSpacing: -0.4,
            marginTop: 4,
          }}
        >
          {detail ? `${detail.firstName} ${detail.lastName}` : 'Mitglied'}
        </div>
        {detail && (
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--bwza-ink-mute)' }}>
            {detail.email}
            {detail.isAdmin && ' · Admin'}
            {detail.isLeitung && ' · Leitung'}
          </div>
        )}
      </div>

      {loadError && (
        <Glass tone="dark" style={{ borderRadius: 18, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--bwza-rescue-soft)' }}>{loadError}</div>
        </Glass>
      )}

      {detail && (
        <Glass tone="amber" style={{ borderRadius: 22, padding: '18px 18px 20px' }}>
          <div className="bwza-eyebrow">Guthaben</div>
          <div
            className={negativ ? 'bwza-neg' : ''}
            style={{
              fontFamily: 'var(--bwza-font-display)',
              fontSize: 'var(--bwza-text-num)',
              fontWeight: 600,
              letterSpacing: -1,
              marginTop: 6,
              color: negativ ? undefined : 'var(--bwza-ink)',
            }}
          >
            {formatGuthaben(detail.guthabenCent)}
          </div>
        </Glass>
      )}

      {detail && <KorrekturCard userId={detail.id} onDone={() => void load()} />}

      {detail && (
        <VerwalterToggle userId={detail.id} isAdmin={detail.isAdmin} onDone={() => void load()} />
      )}

      {detail && (
        <LeitungToggle
          userId={detail.id}
          isLeitung={detail.isLeitung}
          isAdmin={detail.isAdmin}
          onDone={() => void load()}
        />
      )}

      <Historie txs={txs} onChanged={() => void load()} />

      <div style={{ marginTop: 22 }}>
        <GlassButton variant="ghost" full onClick={() => navigate('/admin/mitglieder')}>
          Zurück zur Liste
        </GlassButton>
      </div>
    </div>
  );
}

function KorrekturCard({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [offen, setOffen] = useState(false);
  const [betrag, setBetrag] = useState('');
  const [notiz, setNotiz] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);

  const reset = () => {
    setOffen(false);
    setBetrag('');
    setNotiz('');
    setErr(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const betragCent = parseSignedEuroToCent(betrag);
    if (betragCent === null) {
      setErr('Betrag als z.B. „5", „12,50" oder „-5" angeben (nicht 0).');
      return;
    }
    const notizTrim = notiz.trim();
    if (!notizTrim) {
      setErr('Notiz ist Pflicht — warum wird korrigiert?');
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const r = await api.adminKorrektur({ userId, betragCent, notiz: notizTrim });
      setOk(`Korrektur gebucht — neues Guthaben ${formatGuthaben(r.guthabenCent)}.`);
      reset();
      onDone();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Korrektur fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  if (!offen) {
    return (
      <div style={{ marginTop: 14 }}>
        {ok && (
          <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--bwza-ink-dim)' }}>{ok}</div>
        )}
        <GlassButton variant="ghost" full size="md" onClick={() => { setOffen(true); setOk(null); }}>
          Guthaben korrigieren
        </GlassButton>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 14 }}>
      <Glass
        tone="dark"
        style={{ borderRadius: 18, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <div className="bwza-eyebrow">Guthaben-Korrektur</div>
        <GlassInput
          label="Betrag (€)"
          value={betrag}
          onChange={(e) => setBetrag(e.target.value)}
          placeholder="z.B. 5 oder -2,50"
          hint="Positiv = gutschreiben, negativ = abziehen. Verändert nur das Mitglieder-Guthaben, keine Kasse."
          autoFocus
        />
        <GlassInput
          label="Notiz (Pflicht)"
          value={notiz}
          onChange={(e) => setNotiz(e.target.value)}
          placeholder="z.B. Ausgleich nach Kassensturz"
          error={err}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <GlassButton variant="ghost" full size="md" type="button" disabled={busy} onClick={reset}>
            Abbrechen
          </GlassButton>
          <GlassButton type="submit" full size="md" disabled={busy}>
            {busy ? 'Buche …' : 'Korrektur buchen'}
          </GlassButton>
        </div>
      </Glass>
    </form>
  );
}

// Admin-Toggle „Verwalter-Recht" (B2k). Setzt isAdmin. Der Letzter-Admin-Schutz
// sitzt im Backend (400) — die Meldung wird hier angezeigt.
function VerwalterToggle({
  userId,
  isAdmin,
  onDone,
}: {
  userId: string;
  isAdmin: boolean;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggle = async () => {
    setErr(null);
    setBusy(true);
    try {
      await api.adminSetAdmin(userId, !isAdmin);
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Verwalter-Recht konnte nicht geändert werden.');
      setBusy(false);
    }
  };

  return (
    <Glass tone="dark" style={{ borderRadius: 18, padding: '14px 16px', marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="bwza-eyebrow">Verwalter-Recht</div>
          <div style={{ marginTop: 3, fontSize: 12, color: 'var(--bwza-ink-dim)', lineHeight: 1.45 }}>
            {isAdmin
              ? 'Ist Verwalter: volle Schreibrechte, eigener Kassen-Topf, PayPal-Anfragen.'
              : 'Kein Verwalter. Ernennen gibt volle Schreibrechte + eigenen Kassen-Topf.'}
          </div>
          {err && (
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--bwza-rescue-soft)' }}>{err}</div>
          )}
        </div>
        <GlassButton
          variant={isAdmin ? 'ghost' : 'primary'}
          size="sm"
          disabled={busy}
          onClick={() => void toggle()}
        >
          {busy ? '…' : isAdmin ? 'Entziehen' : 'Ernennen'}
        </GlassButton>
      </div>
    </Glass>
  );
}

// Admin-Toggle „Leitung-Recht" (B2j). Setzt nur isLeitung (Verwalter-Recht hat
// seinen eigenen Toggle oben).
function LeitungToggle({
  userId,
  isLeitung,
  isAdmin,
  onDone,
}: {
  userId: string;
  isLeitung: boolean;
  isAdmin: boolean;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggle = async () => {
    setErr(null);
    setBusy(true);
    try {
      await api.adminSetLeitung(userId, !isLeitung);
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Leitung-Recht konnte nicht geändert werden.');
      setBusy(false);
    }
  };

  return (
    <Glass tone="dark" style={{ borderRadius: 18, padding: '14px 16px', marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="bwza-eyebrow">Leitung-Recht</div>
          <div style={{ marginTop: 3, fontSize: 12, color: 'var(--bwza-ink-dim)', lineHeight: 1.45 }}>
            {isLeitung
              ? 'Hat read-only Kassen-Einsicht (Vermögen, Töpfe, Deckung, Historie).'
              : 'Ohne Kassen-Einsicht. Vergeben gibt read-only Finanz-Überblick.'}
            {isAdmin && ' Admins sehen die Kasse ohnehin voll.'}
          </div>
          {err && (
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--bwza-rescue-soft)' }}>{err}</div>
          )}
        </div>
        <GlassButton
          variant={isLeitung ? 'ghost' : 'primary'}
          size="sm"
          disabled={busy}
          onClick={() => void toggle()}
        >
          {busy ? '…' : isLeitung ? 'Entziehen' : 'Vergeben'}
        </GlassButton>
      </div>
    </Glass>
  );
}

function Historie({ txs, onChanged }: { txs: DetailTransaktion[] | null; onChanged: () => void }) {
  return (
    <div style={{ marginTop: 28 }}>
      <div
        style={{
          fontFamily: 'var(--bwza-font-display)',
          fontSize: 20,
          fontWeight: 600,
          color: 'var(--bwza-ink)',
          letterSpacing: -0.2,
          marginBottom: 10,
        }}
      >
        Transaktionen
      </div>

      {txs === null ? (
        <Loading />
      ) : txs.length === 0 ? (
        <EmptyState title="Noch keine Transaktionen" sub="Käufe, Aufladungen und Korrekturen erscheinen hier." />
      ) : (
        <ScrollList>
          {txs.map((t) => (
            <TxRow key={t.id} tx={t} onChanged={onChanged} />
          ))}
        </ScrollList>
      )}
    </div>
  );
}

function TxRow({ tx, onChanged }: { tx: DetailTransaktion; onChanged: () => void }) {
  const [stornoOffen, setStornoOffen] = useState(false);
  const [notiz, setNotiz] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const titel = TYP_LABEL[tx.typ] + (tx.drinkName ? ` · ${tx.drinkName}` : '');
  const positiv = tx.betragCent > 0;

  const storno = async () => {
    const notizTrim = notiz.trim();
    if (!notizTrim) {
      setErr('Storno-Notiz ist Pflicht.');
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      await api.storno(tx.id, notizTrim);
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Storno fehlgeschlagen.');
      setBusy(false);
    }
  };

  return (
    <Glass
      tone="dark"
      style={{ borderRadius: 16, padding: '12px 14px', opacity: tx.storniert ? 0.6 : 1 }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontFamily: 'var(--bwza-font-display)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--bwza-ink)',
              letterSpacing: -0.1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {titel}
            {tx.storniert && (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.4,
                  color: 'var(--bwza-rescue-soft)',
                  textTransform: 'uppercase',
                }}
              >
                storniert
              </span>
            )}
          </div>
          <div style={{ marginTop: 2, fontSize: 11, color: 'var(--bwza-ink-mute)' }}>
            {formatZeit(tx.createdAt)}
          </div>
          {tx.notiz && (
            <div style={{ marginTop: 3, fontSize: 11.5, color: 'var(--bwza-ink-dim)' }}>
              {tx.notiz}
            </div>
          )}
        </div>
        <div
          style={{
            flexShrink: 0,
            fontSize: 14,
            fontWeight: 600,
            color: positiv ? 'var(--bwza-ink)' : 'var(--bwza-rescue-soft)',
          }}
        >
          {formatSigned(tx.betragCent)}
        </div>
      </div>

      {tx.stornierbar && !stornoOffen && (
        <div style={{ marginTop: 10 }}>
          <GlassButton variant="ghost" size="sm" onClick={() => setStornoOffen(true)}>
            Stornieren
          </GlassButton>
        </div>
      )}

      {tx.stornierbar && stornoOffen && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <GlassInput
            label="Storno-Notiz (Pflicht)"
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
            placeholder="z.B. Fehlbuchung"
            error={err}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <GlassButton
              variant="ghost"
              full
              size="sm"
              disabled={busy}
              onClick={() => {
                setStornoOffen(false);
                setNotiz('');
                setErr(null);
              }}
            >
              Abbrechen
            </GlassButton>
            <GlassButton full size="sm" disabled={busy} onClick={() => void storno()}>
              {busy ? 'Storniere …' : 'Storno bestätigen'}
            </GlassButton>
          </div>
        </div>
      )}
    </Glass>
  );
}
