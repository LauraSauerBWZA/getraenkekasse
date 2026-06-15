import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Glass, GlassButton, GlassInput } from '../components/primitives';
import {
  api,
  ApiError,
  formatGuthaben,
  paypalMeUrl,
  type AufladungsStatus,
  type MeineAnfrage,
  type VerwalterPublic,
} from '../lib/api';
import { useAuth } from '../lib/auth';

// Schnellwahl-Beträge (Cent) — §7.1. „Anderer Betrag" über das Eingabefeld.
const PRESET_CENT = [500, 1000, 2000, 5000];

// Eingabe „1,50" / „1.50" / „2" → 150/150/200 Cent. Null bei ungültig/leer/negativ.
function parseEuroToCent(input: string): number | null {
  const trimmed = input.trim().replace(',', '.');
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const euro = Number(trimmed);
  if (!Number.isFinite(euro) || euro <= 0) return null;
  return Math.round(euro * 100);
}

function formatBetrag(cent: number): string {
  return (cent / 100).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' €';
}

const STATUS_LABEL: Record<AufladungsStatus, string> = {
  OFFEN: 'offen',
  BESTAETIGT: 'bestätigt',
  ABGELEHNT: 'abgelehnt',
};

const STATUS_COLOR: Record<AufladungsStatus, string> = {
  OFFEN: 'oklch(70% 0.16 70)',
  BESTAETIGT: 'oklch(72% 0.14 145)',
  ABGELEHNT: 'oklch(58% 0.18 25)',
};

export default function Aufladen() {
  const { user } = useAuth();
  const [verwalter, setVerwalter] = useState<VerwalterPublic | null>(null);
  const [anfragen, setAnfragen] = useState<MeineAnfrage[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customEuro, setCustomEuro] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [v, m] = await Promise.all([
        api.aufladungZustaendigerVerwalter(),
        api.aufladungMeine(),
      ]);
      setVerwalter(v.verwalter);
      setAnfragen(m.anfragen);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Aufladen-Seite konnte nicht geladen werden.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stelleAnfrage = async (betragCent: number) => {
    setErr(null);
    setHinweis(null);
    setBusy(true);
    try {
      const r = await api.aufladungPaypal(betragCent);
      // paypal.me öffnen, falls Link hinterlegt — sonst nur Anfrage anlegen.
      if (r.verwalter.paypalMeLink) {
        window.open(paypalMeUrl(r.verwalter.paypalMeLink, betragCent), '_blank', 'noopener');
      }
      setHinweis(
        `Anfrage über ${formatBetrag(betragCent)} gestellt. Überweise den Betrag an ` +
          `${r.verwalter.firstName}; sobald die Zahlung da ist, bestätigt ${r.verwalter.firstName} die Aufladung.`,
      );
      setCustomOpen(false);
      setCustomEuro('');
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Anfrage fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const submitCustom = () => {
    const betragCent = parseEuroToCent(customEuro);
    if (betragCent === null) {
      setErr('Betrag bitte als z.B. „15" oder „12,50" angeben (positiv).');
      return;
    }
    void stelleAnfrage(betragCent);
  };

  if (!user) return null;

  const hatLink = Boolean(verwalter?.paypalMeLink);

  return (
    <div className="bwza-stage" style={{ padding: '0 var(--bwza-page-x) 40px' }}>
      <div style={{ paddingTop: 30, paddingBottom: 18 }}>
        <div className="bwza-eyebrow">Phase B2f · Aufladen</div>
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
          Guthaben aufladen
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--bwza-ink-dim)' }}>
          Aktuelles Guthaben:{' '}
          <span
            style={{
              fontWeight: 600,
              color: user.guthabenCent < 0 ? 'var(--bwza-rescue-soft)' : 'var(--bwza-ink)',
            }}
          >
            {formatGuthaben(user.guthabenCent)}
          </span>
        </div>
      </div>

      {loadError && (
        <Glass tone="dark" style={{ borderRadius: 18, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--bwza-rescue-soft)' }}>{loadError}</div>
        </Glass>
      )}

      {/* PayPal-Aufladung */}
      <Glass tone="amber" style={{ borderRadius: 22, padding: '18px 16px' }}>
        <div className="bwza-eyebrow">💳 PayPal</div>
        <div
          style={{
            marginTop: 6,
            fontFamily: 'var(--bwza-font-display)',
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--bwza-ink)',
            letterSpacing: -0.2,
          }}
        >
          {verwalter ? `Zahlung an ${verwalter.firstName} ${verwalter.lastName}` : 'PayPal-Aufladung'}
        </div>

        {verwalter && hatLink ? (
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--bwza-ink-mute)' }}>
            paypal.me/{verwalter.paypalMeLink} · Betrag wählen, App öffnet PayPal.
          </div>
        ) : (
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--bwza-rescue-soft)' }}>
            Aktuell ist kein PayPal-Link hinterlegt — bitte per Bargeld aufladen (unten) oder
            deinen Verwalter ansprechen.
          </div>
        )}

        {hatLink && (
          <>
            <div
              style={{
                marginTop: 14,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
              }}
            >
              {PRESET_CENT.map((cent) => (
                <GlassButton
                  key={cent}
                  variant="ghost"
                  size="md"
                  full
                  disabled={busy}
                  onClick={() => void stelleAnfrage(cent)}
                >
                  {formatBetrag(cent)}
                </GlassButton>
              ))}
            </div>

            {customOpen ? (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <GlassInput
                  label="Anderer Betrag (€)"
                  value={customEuro}
                  onChange={(e) => setCustomEuro(e.target.value)}
                  placeholder="15,00"
                  hint="Euro mit Komma oder Punkt, z.B. 15 oder 12,50"
                  error={err}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 10 }}>
                  <GlassButton
                    variant="ghost"
                    full
                    size="md"
                    disabled={busy}
                    onClick={() => {
                      setCustomOpen(false);
                      setCustomEuro('');
                      setErr(null);
                    }}
                  >
                    Abbrechen
                  </GlassButton>
                  <GlassButton full size="md" disabled={busy} onClick={submitCustom}>
                    {busy ? 'Stelle …' : 'Anfrage stellen'}
                  </GlassButton>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 8 }}>
                <GlassButton
                  variant="ghost"
                  size="sm"
                  full
                  disabled={busy}
                  onClick={() => {
                    setCustomOpen(true);
                    setErr(null);
                  }}
                >
                  Anderer Betrag
                </GlassButton>
              </div>
            )}

            {err && !customOpen && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--bwza-rescue-soft)' }}>{err}</div>
            )}
          </>
        )}

        {hinweis && (
          <div
            style={{
              marginTop: 14,
              padding: '10px 12px',
              borderRadius: 12,
              background: 'rgba(0,0,0,0.28)',
              border: '1px solid var(--bwza-glass-line)',
              fontSize: 12,
              color: 'var(--bwza-ink-dim)',
              lineHeight: 1.45,
            }}
          >
            {hinweis}
          </div>
        )}
      </Glass>

      {/* Bargeld-Hinweis */}
      <Glass tone="dark" style={{ borderRadius: 18, padding: '14px 16px', marginTop: 14 }}>
        <div className="bwza-eyebrow">💶 Bargeld</div>
        <div style={{ marginTop: 4, fontSize: 13, color: 'var(--bwza-ink)', fontWeight: 600 }}>
          Lieber bar?
        </div>
        <div style={{ marginTop: 2, fontSize: 12, color: 'var(--bwza-ink-mute)', lineHeight: 1.45 }}>
          Sprich deinen Verwalter an — er trägt die Bargeld-Aufladung direkt ein, dein Guthaben
          steigt sofort.
        </div>
      </Glass>

      {/* Eigene Anfragen */}
      <EigeneAnfragen anfragen={anfragen} />
    </div>
  );
}

function EigeneAnfragen({ anfragen }: { anfragen: MeineAnfrage[] | null }) {
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
        Meine Anfragen
      </div>

      {anfragen === null ? (
        <Glass tone="dark" style={{ borderRadius: 18, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--bwza-ink-mute)' }}>Lädt …</div>
        </Glass>
      ) : anfragen.length === 0 ? (
        <Glass tone="dark" style={{ borderRadius: 18, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--bwza-ink-mute)' }}>
            Noch keine PayPal-Anfragen gestellt.
          </div>
        </Glass>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {anfragen.map((a) => (
            <AnfrageRow key={a.id} anfrage={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function AnfrageRow({ anfrage }: { anfrage: MeineAnfrage }) {
  const color = STATUS_COLOR[anfrage.status];
  const datum = new Date(anfrage.requestedAt).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const kannErneutOeffnen =
    anfrage.status === 'OFFEN' && Boolean(anfrage.zugewiesenerVerwalter.paypalMeLink);

  return (
    <Glass
      tone="dark"
      style={{
        borderRadius: 16,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
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
          }}
        >
          {formatBetrag(anfrage.betragCent)}
        </div>
        <div style={{ marginTop: 2, fontSize: 11, color: 'var(--bwza-ink-mute)' }}>
          {datum} · an {anfrage.zugewiesenerVerwalter.firstName}
        </div>
        {kannErneutOeffnen && (
          <a
            href={paypalMeUrl(anfrage.zugewiesenerVerwalter.paypalMeLink!, anfrage.betragCent)}
            target="_blank"
            rel="noreferrer"
            style={{
              marginTop: 4,
              display: 'inline-block',
              fontSize: 11,
              color: 'var(--bwza-ink-dim)',
              textDecoration: 'underline',
            }}
          >
            PayPal erneut öffnen
          </a>
        )}
      </div>
      <StatusChip color={color} label={STATUS_LABEL[anfrage.status]} />
    </Glass>
  );
}

function StatusChip({ color, label }: { color: string; label: string }) {
  const style: CSSProperties = {
    flexShrink: 0,
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color,
    border: `1px solid ${color}`,
    background: 'rgba(0,0,0,0.30)',
  };
  return <span style={style}>{label}</span>;
}
