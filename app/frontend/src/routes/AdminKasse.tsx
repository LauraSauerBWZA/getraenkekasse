import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState, Glass, GlassButton, GlassInput, Loading } from '../components/primitives';
import { BackBar } from '../components/BackBar';
import { ScrollList } from '../components/ScrollList';
import {
  api,
  ApiError,
  type KassenHistorieEintrag,
  type KassenKonto,
  type KassenSummary,
} from '../lib/api';
import { useAuth } from '../lib/auth';

function formatEuro(cent: number): string {
  return (cent / 100).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' €';
}

function formatSigned(cent: number): string {
  const vz = cent > 0 ? '+ ' : cent < 0 ? '− ' : '';
  return vz + formatEuro(Math.abs(cent));
}

function formatZeit(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Positive-Euro-Eingabe → Cent (> 0). Null sonst.
function parsePositiveEuroToCent(input: string): number | null {
  const t = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const euro = Number(t);
  if (!Number.isFinite(euro) || euro <= 0) return null;
  return Math.round(euro * 100);
}

// Signierte Euro-Eingabe → Cent (≠ 0). Null sonst.
function parseSignedEuroToCent(input: string): number | null {
  const t = input.trim().replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return null;
  const euro = Number(t);
  if (!Number.isFinite(euro)) return null;
  const cent = Math.round(euro * 100);
  return cent === 0 ? null : cent;
}

type AktionKey = 'EINKAUF' | 'ENTNAHME' | 'EINLAGE_BOX' | 'SPENDE' | 'KORREKTUR';

interface AktionDef {
  key: AktionKey;
  label: string;
  desc: string;
  kontoWahl: boolean; // Konto-Umschalter zeigen?
  signed: boolean; // negativer Betrag erlaubt (Korrektur)?
  modus: 'buchung' | 'einlage';
}

const AKTIONEN: AktionDef[] = [
  { key: 'EINKAUF', label: 'Einkauf', desc: 'Getränke-Nachschub', kontoWahl: true, signed: false, modus: 'buchung' },
  { key: 'EINLAGE_BOX', label: 'Einlage in die Box', desc: 'Gehaltenes Geld in die Box legen', kontoWahl: false, signed: false, modus: 'einlage' },
  { key: 'ENTNAHME', label: 'Entnahme', desc: 'Vereinsfremde Ausgabe', kontoWahl: true, signed: false, modus: 'buchung' },
  { key: 'SPENDE', label: 'Spende', desc: 'Spende oder Gast-Einzahlung', kontoWahl: true, signed: false, modus: 'buchung' },
  { key: 'KORREKTUR', label: 'Korrektur', desc: 'Kassenstand anpassen (±)', kontoWahl: true, signed: true, modus: 'buchung' },
];

const KONTO_LABEL: Record<KassenKonto, string> = {
  VERWALTER: 'Mein Topf',
  BOX: 'Bar-Vereinskasse',
};

const TYP_LABEL: Record<string, string> = {
  EINZAHLUNG: 'Einzahlung',
  EINLAGE_BOX: 'Einlage Box',
  EINKAUF: 'Einkauf',
  ENTNAHME: 'Entnahme',
  SPENDE: 'Spende',
  KORREKTUR: 'Korrektur',
};

export default function AdminKasse() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<KassenSummary | null>(null);
  const [historie, setHistorie] = useState<KassenHistorieEintrag[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [aktion, setAktion] = useState<AktionDef | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [s, h] = await Promise.all([api.adminKasseSummary(), api.adminKasseHistorie()]);
      setSummary(s);
      setHistorie(h.buchungen);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Kasse konnte nicht geladen werden.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) return null;

  const deckungNegativ = (summary?.deckungCent ?? 0) < 0;

  return (
    <div className="bwza-stage" style={{ padding: '0 var(--bwza-page-x) 40px' }}>
      <BackBar />
      <div style={{ paddingTop: 30, paddingBottom: 16 }}>
        <div className="bwza-eyebrow">Phase B2i · Kasse</div>
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
          Vereinskasse
        </div>
      </div>

      {loadError && (
        <Glass tone="dark" style={{ borderRadius: 18, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--bwza-rescue-soft)' }}>{loadError}</div>
        </Glass>
      )}

      {summary && (
        <>
          {/* Bestands-Hero */}
          <Glass tone="amber" style={{ borderRadius: 22, padding: '18px 18px 20px' }}>
            <div className="bwza-eyebrow">Vereinsvermögen</div>
            <div
              style={{
                fontFamily: 'var(--bwza-font-ui)',
                fontSize: 'var(--bwza-text-num)',
                fontWeight: 300,
                letterSpacing: -1.5,
                marginTop: 6,
                overflowWrap: 'anywhere',
                color: 'var(--bwza-ink)',
              }}
            >
              {formatEuro(summary.vereinsvermoegenCent)}
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--bwza-ink-mute)' }}>
              Summe aller Verwalter-Töpfe + Bar-Vereinskasse
            </div>
          </Glass>

          {/* Töpfe + Box */}
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {summary.toepfe.map((t) => (
              <StandRow
                key={t.verwalterId}
                label={`${t.firstName} ${t.lastName}`}
                sub={t.verwalterId === user.id ? 'Dein Topf' : 'Verwalter-Topf'}
                betragCent={t.betragCent}
                hervorgehoben={t.verwalterId === user.id}
              />
            ))}
            <StandRow label="Bar-Vereinskasse" sub="Box · nachzählbar" betragCent={summary.boxCent} />
          </div>

          {/* Deckung */}
          <Glass
            tone="dark"
            style={{
              borderRadius: 18,
              padding: '14px 16px',
              marginTop: 14,
              border: deckungNegativ ? '1px solid var(--bwza-rescue-soft)' : undefined,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div className="bwza-eyebrow">Deckung</div>
              <div
                style={{
                  fontFamily: 'var(--bwza-font-display)',
                  fontSize: 20,
                  fontWeight: 600,
                  color: deckungNegativ ? 'var(--bwza-rescue-soft)' : 'var(--bwza-ink)',
                }}
              >
                {formatSigned(summary.deckungCent)}
              </div>
            </div>
            <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--bwza-ink-mute)', lineHeight: 1.45 }}>
              Vereinsvermögen minus dem, was die Kasse den Mitgliedern schuldet
              ({formatEuro(summary.mitgliederGuthabenSummeCent)} Guthaben).{' '}
              {deckungNegativ ? 'Negativ — die Kasse ist unterdeckt.' : 'Positiv = Puffer.'}
            </div>
          </Glass>

          {/* Aktionen */}
          <div style={{ marginTop: 24, marginBottom: 10 }}>
            <div
              style={{
                fontFamily: 'var(--bwza-font-display)',
                fontSize: 20,
                fontWeight: 600,
                color: 'var(--bwza-ink)',
                letterSpacing: -0.2,
              }}
            >
              Aktionen
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {AKTIONEN.map((a) => (
              <Glass
                key={a.key}
                tone="dark"
                onClick={() => setAktion(a)}
                style={{ borderRadius: 16, padding: '12px 14px', cursor: 'pointer' }}
              >
                <div
                  style={{
                    fontFamily: 'var(--bwza-font-display)',
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--bwza-ink)',
                    letterSpacing: -0.1,
                  }}
                >
                  {a.label}
                </div>
                <div style={{ marginTop: 2, fontSize: 10.5, color: 'var(--bwza-ink-mute)', lineHeight: 1.35 }}>
                  {a.desc}
                </div>
              </Glass>
            ))}
          </div>
        </>
      )}

      {/* Historie */}
      <Historie historie={historie} canStorno={user.isAdmin} onChange={() => void load()} />


      {aktion && (
        <AktionSheet
          aktion={aktion}
          onClose={() => setAktion(null)}
          onDone={() => {
            setAktion(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function StandRow({
  label,
  sub,
  betragCent,
  hervorgehoben,
}: {
  label: string;
  sub: string;
  betragCent: number;
  hervorgehoben?: boolean;
}) {
  const negativ = betragCent < 0;
  return (
    <Glass
      tone={hervorgehoben ? 'amber' : 'dark'}
      style={{
        borderRadius: 16,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
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
          {label}
        </div>
        <div style={{ fontSize: 11, color: 'var(--bwza-ink-mute)' }}>{sub}</div>
      </div>
      <div
        style={{
          flexShrink: 0,
          fontSize: 15,
          fontWeight: 600,
          color: negativ ? 'var(--bwza-rescue-soft)' : 'var(--bwza-ink)',
        }}
      >
        {formatEuro(betragCent)}
      </div>
    </Glass>
  );
}

function Historie({
  historie,
  canStorno,
  onChange,
}: {
  historie: KassenHistorieEintrag[] | null;
  canStorno: boolean;
  onChange: () => void;
}) {
  return (
    <div style={{ marginTop: 26 }}>
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
        Kassen-Historie
      </div>

      {historie === null ? (
        <Loading />
      ) : historie.length === 0 ? (
        <EmptyState title="Noch keine Bewegungen" sub="Einkäufe, Einzahlungen und Korrekturen erscheinen hier." />
      ) : (
        <ScrollList>
          {historie.map((b) => (
            <HistorieRow key={b.id} eintrag={b} canStorno={canStorno} onChange={onChange} />
          ))}
        </ScrollList>
      )}
    </div>
  );
}

function HistorieRow({
  eintrag,
  canStorno,
  onChange,
}: {
  eintrag: KassenHistorieEintrag;
  canStorno: boolean;
  onChange: () => void;
}) {
  const positiv = eintrag.betragCent > 0;
  const kontoText =
    eintrag.konto === 'BOX' ? 'Box' : eintrag.verwalterName ?? 'Verwalter-Topf';
  const istStorno = eintrag.stornoVonId !== null;
  const [offen, setOffen] = useState(false);
  const [notiz, setNotiz] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stornieren = async () => {
    const n = notiz.trim();
    if (!n) {
      setErr('Notiz ist beim Storno Pflicht — kurz, warum.');
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      await api.adminKasseStorno(eintrag.id, n);
      onChange();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Storno fehlgeschlagen.');
      setBusy(false);
    }
  };

  return (
    <Glass
      tone="dark"
      style={{
        borderRadius: 16,
        padding: '12px 14px',
        opacity: eintrag.storniert ? 0.6 : 1,
      }}
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
            }}
          >
            {TYP_LABEL[eintrag.typ] ?? eintrag.typ}{' '}
            <span style={{ color: 'var(--bwza-ink-mute)', fontWeight: 500 }}>· {kontoText}</span>
            {eintrag.storniert && <StatusTag text="storniert" />}
            {istStorno && <StatusTag text="Storno" />}
          </div>
          <div style={{ marginTop: 2, fontSize: 11, color: 'var(--bwza-ink-mute)' }}>
            {formatZeit(eintrag.createdAt)}
          </div>
          {eintrag.notiz && (
            <div style={{ marginTop: 3, fontSize: 11.5, color: 'var(--bwza-ink-dim)' }}>
              {eintrag.notiz}
            </div>
          )}
        </div>
        <div
          style={{
            flexShrink: 0,
            fontSize: 14,
            fontWeight: 600,
            color: positiv ? 'var(--bwza-ink)' : 'var(--bwza-rescue-soft)',
            textDecoration: eintrag.storniert ? 'line-through' : undefined,
          }}
        >
          {formatSigned(eintrag.betragCent)}
        </div>
      </div>

      {/* Storno — nur für Admins und nur bei stornierbaren Buchungen. */}
      {canStorno && eintrag.stornierbar && !offen && (
        <div style={{ marginTop: 10 }}>
          <GlassButton variant="ghost" size="sm" onClick={() => { setOffen(true); setErr(null); }}>
            Stornieren
          </GlassButton>
        </div>
      )}

      {canStorno && eintrag.stornierbar && offen && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11.5, color: 'var(--bwza-ink-dim)', lineHeight: 1.45 }}>
            Storno bucht eine Gegenbuchung (kein Löschen).
            {eintrag.transaktionId
              ? ' Die gekoppelte Mitglieder-Einzahlung wird ebenfalls zurückgenommen.'
              : ''}
          </div>
          <GlassInput
            label="Notiz (Pflicht)"
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
            placeholder="z.B. Versehentlich doppelt gebucht"
            error={err}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <GlassButton variant="ghost" full size="md" disabled={busy} onClick={() => { setOffen(false); setNotiz(''); setErr(null); }}>
              Abbrechen
            </GlassButton>
            <GlassButton full size="md" disabled={busy} onClick={() => void stornieren()}>
              {busy ? 'Storniere …' : 'Storno bestätigen'}
            </GlassButton>
          </div>
        </div>
      )}
    </Glass>
  );
}

function StatusTag({ text }: { text: string }) {
  return (
    <span
      style={{
        marginLeft: 8,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        color: 'var(--bwza-ink-mute)',
      }}
    >
      {text}
    </span>
  );
}

function AktionSheet({
  aktion,
  onClose,
  onDone,
}: {
  aktion: AktionDef;
  onClose: () => void;
  onDone: () => void;
}) {
  const [betrag, setBetrag] = useState('');
  const [konto, setKonto] = useState<KassenKonto>('VERWALTER');
  const [vermerk, setVermerk] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const betragCent = aktion.signed
      ? parseSignedEuroToCent(betrag)
      : parsePositiveEuroToCent(betrag);
    if (betragCent === null) {
      setErr(
        aktion.signed
          ? 'Betrag als z.B. „5", „12,50" oder „-5" angeben (nicht 0).'
          : 'Betrag als positiven Wert angeben, z.B. „12,50".',
      );
      return;
    }
    const vermerkTrim = vermerk.trim();
    if (!vermerkTrim) {
      setErr('Vermerk ist Pflicht — kurz, worum es geht.');
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      if (aktion.modus === 'einlage') {
        await api.adminKasseEinlage({ betragCent, vermerk: vermerkTrim });
      } else {
        await api.adminKasseBuchung({
          typ: aktion.key as Exclude<AktionKey, 'EINLAGE_BOX'>,
          konto: aktion.kontoWahl ? konto : 'VERWALTER',
          betragCent,
          vermerk: vermerkTrim,
        });
      }
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Buchung fehlgeschlagen.');
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 'var(--bwza-page-x)',
        zIndex: 50,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480 }}>
        <Glass
          tone="raise"
          style={{ borderRadius: 22, padding: '20px 18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div>
            <div className="bwza-eyebrow">Kassen-Aktion</div>
            <div
              style={{
                marginTop: 4,
                fontFamily: 'var(--bwza-font-display)',
                fontSize: 22,
                fontWeight: 600,
                color: 'var(--bwza-ink)',
                letterSpacing: -0.3,
              }}
            >
              {aktion.label}
            </div>
            <div style={{ marginTop: 2, fontSize: 12, color: 'var(--bwza-ink-mute)' }}>
              {aktion.desc}
            </div>
          </div>

          {aktion.kontoWahl && (
            <div>
              <div className="bwza-eyebrow" style={{ marginBottom: 6 }}>
                Konto
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['VERWALTER', 'BOX'] as KassenKonto[]).map((k) => (
                  <GlassButton
                    key={k}
                    variant={konto === k ? 'primary' : 'ghost'}
                    size="sm"
                    full
                    onClick={() => setKonto(k)}
                  >
                    {KONTO_LABEL[k]}
                  </GlassButton>
                ))}
              </div>
            </div>
          )}

          <GlassInput
            label="Betrag (€)"
            value={betrag}
            onChange={(e) => setBetrag(e.target.value)}
            placeholder={aktion.signed ? 'z.B. 5 oder -2,50' : 'z.B. 12,50'}
            hint={
              aktion.modus === 'einlage'
                ? 'Wandert von deinem Topf in die Box — Vereinsvermögen bleibt gleich.'
                : aktion.signed
                  ? 'Positiv hebt an, negativ senkt.'
                  : undefined
            }
            autoFocus
          />
          <GlassInput
            label="Vermerk (Pflicht)"
            value={vermerk}
            onChange={(e) => setVermerk(e.target.value)}
            placeholder={
              aktion.modus === 'einlage'
                ? 'Von Admin-Konto in Box gelegt'
                : 'z.B. Getränkemarkt 14.06.'
            }
            error={err}
          />

          <div style={{ display: 'flex', gap: 10 }}>
            <GlassButton variant="ghost" full size="md" onClick={onClose} disabled={busy}>
              Abbrechen
            </GlassButton>
            <GlassButton full size="md" onClick={() => void submit()} disabled={busy}>
              {busy ? 'Buche …' : 'Buchen'}
            </GlassButton>
          </div>
        </Glass>
      </div>
    </div>
  );
}
