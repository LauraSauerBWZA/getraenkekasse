import { useCallback, useEffect, useState } from 'react';
import { Glass, GlassButton, GlassInput, Loading } from './primitives';
import { ScrollList } from './ScrollList';
import { api, ApiError, formatGuthaben, type AdminAnfrage } from '../lib/api';
import { useRefreshOnFocus } from '../lib/useRefreshOnFocus';

// Offene member-initiierte PayPal-Anfragen als Abschnitt (Bündel 4, Einheit 1):
// aus dem früheren eigenständigen AdminAufladungAnfragen-Screen extrahiert, damit er
// OBERHALB der Mitglieder-Auswahl im Einzahlungs-Flow erscheinen kann. Logik
// (bestätigen mit echter Summe / ablehnen) ist UNVERÄNDERT — nur die Platzierung.
//
// Rendert nichts, solange (noch) keine offene Anfrage da ist und keine frische
// Entscheidungs-Bestätigung ansteht → bei keinen Anfragen sieht man direkt die
// Mitglieder-Auswahl darunter.

function formatBetrag(cent: number): string {
  return (cent / 100).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' €';
}

// Eingabe „1,50" / „1.50" / „2" → 150/150/200 Cent. Null bei ungültig/leer/negativ.
function parseEuroToCent(input: string): number | null {
  const trimmed = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const euro = Number(trimmed);
  if (!Number.isFinite(euro) || euro <= 0) return null;
  return Math.round(euro * 100);
}

function formatZeit(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface Erfolg {
  text: string;
  ton: 'gut' | 'neutral';
}

export function OffeneAnfragen() {
  const [anfragen, setAnfragen] = useState<AdminAnfrage[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [erfolg, setErfolg] = useState<Erfolg | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const r = await api.adminAufladungAnfragen();
      setAnfragen(r.anfragen);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Anfragen konnten nicht geladen werden.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Beim Zurückkehren in die App die Liste frisch holen (Bündel-1-Muster).
  useRefreshOnFocus(() => void load());

  // Nach einer Entscheidung die Anfrage aus der Liste nehmen (nicht mehr OFFEN) +
  // kurze Bestätigung.
  const entfernen = (id: string, e: Erfolg) => {
    setAnfragen((prev) => (prev ? prev.filter((a) => a.id !== id) : prev));
    setErfolg(e);
  };

  const hatAnfragen = (anfragen?.length ?? 0) > 0;

  // Nichts anzeigen, solange weder offene Anfragen noch ein Fehler noch eine frische
  // Bestätigung vorliegen — dann steht direkt die Mitglieder-Auswahl im Vordergrund.
  // (anfragen === null = lädt noch → ebenfalls nichts, kein Spinner-Flackern.)
  if (!hatAnfragen && !erfolg && !loadError) return null;

  return (
    <div style={{ marginBottom: 22 }}>
      <div
        style={{
          fontFamily: 'var(--bwza-font-display)',
          fontSize: 18,
          fontWeight: 600,
          color: 'var(--bwza-ink)',
          letterSpacing: -0.2,
          marginBottom: 4,
        }}
      >
        Offene PayPal-Anfragen
      </div>
      <div style={{ fontSize: 12, color: 'var(--bwza-ink-dim)', marginBottom: 10, lineHeight: 1.45 }}>
        Bestätigen schreibt das Guthaben gut und bucht die Einzahlung auf deinen Topf.
      </div>

      {erfolg && (
        <Glass tone="amber" style={{ borderRadius: 16, padding: '12px 14px', marginBottom: 12 }}>
          <div
            style={{
              fontSize: 13,
              color: erfolg.ton === 'gut' ? 'var(--bwza-ink)' : 'var(--bwza-ink-dim)',
              fontWeight: 600,
            }}
          >
            {erfolg.text}
          </div>
        </Glass>
      )}

      {loadError ? (
        <Glass tone="dark" style={{ borderRadius: 18, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--bwza-rescue-soft)' }}>{loadError}</div>
        </Glass>
      ) : anfragen === null ? (
        <Loading />
      ) : hatAnfragen ? (
        <ScrollList maxHeight={280}>
          {anfragen.map((a) => (
            <AnfrageCard key={a.id} anfrage={a} onEntschieden={entfernen} />
          ))}
        </ScrollList>
      ) : null}
    </div>
  );
}

// Welcher Inline-Dialog ist offen? Bestätigen verlangt die tatsächlich überwiesene
// Summe (Betrag Pflicht), Ablehnen eine optionale Notiz.
type Modus = 'idle' | 'bestaetigen' | 'ablehnen';

function AnfrageCard({
  anfrage,
  onEntschieden,
}: {
  anfrage: AdminAnfrage;
  onEntschieden: (id: string, erfolg: Erfolg) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [modus, setModus] = useState<Modus>('idle');
  const [notiz, setNotiz] = useState('');
  const [betragEuro, setBetragEuro] = useState('');

  const name = `${anfrage.user.firstName} ${anfrage.user.lastName}`;

  const schliessen = () => {
    setModus('idle');
    setNotiz('');
    setBetragEuro('');
    setErr(null);
  };

  const bestaetigen = async () => {
    const betragCent = parseEuroToCent(betragEuro);
    if (betragCent === null) {
      setErr('Bitte die überwiesene Summe angeben, z.B. „10" oder „12,50".');
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const r = await api.adminAufladungBestaetigen(anfrage.id, betragCent);
      onEntschieden(anfrage.id, {
        text: `${name}: ${formatBetrag(betragCent)} gutgeschrieben — neues Guthaben ${formatGuthaben(r.guthabenCent)}.`,
        ton: 'gut',
      });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Bestätigen fehlgeschlagen.');
      setBusy(false);
    }
  };

  const ablehnen = async () => {
    setErr(null);
    setBusy(true);
    try {
      await api.adminAufladungAblehnen(anfrage.id, notiz.trim() || undefined);
      onEntschieden(anfrage.id, {
        text: `${name}: PayPal-Anfrage abgelehnt.`,
        ton: 'neutral',
      });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Ablehnen fehlgeschlagen.');
      setBusy(false);
    }
  };

  return (
    <Glass tone="dark" style={{ borderRadius: 16, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontFamily: 'var(--bwza-font-display)',
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--bwza-ink)',
              letterSpacing: -0.1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--bwza-ink-mute)' }}>
            {anfrage.user.email} · {formatZeit(anfrage.requestedAt)}
          </div>
        </div>
        {/* Betraglose Anfrage → kein Betrag an der Karte; nur ein PayPal-Marker. */}
        <div
          style={{
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            color: 'var(--bwza-ink-mute)',
          }}
        >
          PayPal
        </div>
      </div>

      {err && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--bwza-rescue-soft)' }}>{err}</div>
      )}

      {modus === 'bestaetigen' && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <GlassInput
            label="Überwiesene Summe (€)"
            value={betragEuro}
            onChange={(e) => setBetragEuro(e.target.value)}
            placeholder="z.B. 10 oder 12,50"
            hint="Genau der Betrag, der real auf deinem PayPal eingegangen ist."
            autoFocus
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <GlassButton variant="ghost" full size="md" disabled={busy} onClick={schliessen}>
              Zurück
            </GlassButton>
            <GlassButton full size="md" disabled={busy} onClick={() => void bestaetigen()}>
              {busy ? 'Buche …' : 'Gutschreiben'}
            </GlassButton>
          </div>
        </div>
      )}

      {modus === 'ablehnen' && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <GlassInput
            label="Notiz (optional)"
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
            placeholder="z.B. keine Zahlung eingegangen"
            autoFocus
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <GlassButton variant="ghost" full size="md" disabled={busy} onClick={schliessen}>
              Zurück
            </GlassButton>
            <GlassButton full size="md" disabled={busy} onClick={() => void ablehnen()}>
              {busy ? 'Lehne ab …' : 'Ablehnen bestätigen'}
            </GlassButton>
          </div>
        </div>
      )}

      {modus === 'idle' && (
        <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
          <GlassButton
            variant="ghost"
            full
            size="md"
            disabled={busy}
            onClick={() => { setModus('ablehnen'); setErr(null); }}
          >
            Ablehnen
          </GlassButton>
          <GlassButton
            full
            size="md"
            disabled={busy}
            onClick={() => { setModus('bestaetigen'); setErr(null); }}
          >
            Bestätigen
          </GlassButton>
        </div>
      )}
    </Glass>
  );
}
