import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Glass, GlassButton, GlassInput } from '../components/primitives';
import { ScrollList } from '../components/ScrollList';
import { api, ApiError, formatGuthaben, type AdminAnfrage } from '../lib/api';
import { useAuth } from '../lib/auth';

function formatBetrag(cent: number): string {
  return (cent / 100).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' €';
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

export default function AdminAufladungAnfragen() {
  const { user } = useAuth();
  const navigate = useNavigate();
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

  // Nach einer Entscheidung die Anfrage aus der Liste nehmen (sie ist nicht mehr
  // OFFEN) + kurze Bestätigung anzeigen.
  const entfernen = (id: string, erfolg: Erfolg) => {
    setAnfragen((prev) => (prev ? prev.filter((a) => a.id !== id) : prev));
    setErfolg(erfolg);
  };

  if (!user) return null;

  return (
    <div className="bwza-stage" style={{ padding: '0 var(--bwza-page-x) 40px' }}>
      <div style={{ paddingTop: 30, paddingBottom: 18 }}>
        <div className="bwza-eyebrow">Phase B2f · Kasse</div>
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
          Aufladungs-Anfragen
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--bwza-ink-dim)' }}>
          Offene PayPal-Anfragen. Bestätigen schreibt das Guthaben gut und bucht die
          Kassen-Einzahlung auf deinen Topf.
        </div>
      </div>

      {erfolg && (
        <Glass tone="amber" style={{ borderRadius: 16, padding: '12px 14px', marginBottom: 14 }}>
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
        <Glass tone="dark" style={{ borderRadius: 18, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--bwza-ink-mute)' }}>Lädt …</div>
        </Glass>
      ) : anfragen.length === 0 ? (
        <Glass tone="dark" style={{ borderRadius: 18, padding: '18px 16px' }}>
          <div style={{ fontSize: 13, color: 'var(--bwza-ink-mute)' }}>
            Keine offenen Anfragen.
          </div>
        </Glass>
      ) : (
        <ScrollList>
          {anfragen.map((a) => (
            <AnfrageCard key={a.id} anfrage={a} onEntschieden={entfernen} />
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

function AnfrageCard({
  anfrage,
  onEntschieden,
}: {
  anfrage: AdminAnfrage;
  onEntschieden: (id: string, erfolg: Erfolg) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ablehnenOffen, setAblehnenOffen] = useState(false);
  const [notiz, setNotiz] = useState('');

  const name = `${anfrage.user.firstName} ${anfrage.user.lastName}`;

  const bestaetigen = async () => {
    setErr(null);
    setBusy(true);
    try {
      const r = await api.adminAufladungBestaetigen(anfrage.id);
      onEntschieden(anfrage.id, {
        text: `${name}: ${formatBetrag(anfrage.betragCent)} gutgeschrieben — neues Guthaben ${formatGuthaben(r.guthabenCent)}.`,
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
        text: `${name}: Anfrage über ${formatBetrag(anfrage.betragCent)} abgelehnt.`,
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
        <div
          style={{
            flexShrink: 0,
            fontFamily: 'var(--bwza-font-display)',
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--bwza-ink)',
          }}
        >
          {formatBetrag(anfrage.betragCent)}
        </div>
      </div>

      {err && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--bwza-rescue-soft)' }}>{err}</div>
      )}

      {ablehnenOffen ? (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <GlassInput
            label="Notiz (optional)"
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
            placeholder="z.B. keine Zahlung eingegangen"
            autoFocus
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <GlassButton
              variant="ghost"
              full
              size="md"
              disabled={busy}
              onClick={() => {
                setAblehnenOffen(false);
                setNotiz('');
                setErr(null);
              }}
            >
              Zurück
            </GlassButton>
            <GlassButton full size="md" disabled={busy} onClick={() => void ablehnen()}>
              {busy ? 'Lehne ab …' : 'Ablehnen bestätigen'}
            </GlassButton>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
          <GlassButton
            variant="ghost"
            full
            size="md"
            disabled={busy}
            onClick={() => {
              setAblehnenOffen(true);
              setErr(null);
            }}
          >
            Ablehnen
          </GlassButton>
          <GlassButton full size="md" disabled={busy} onClick={() => void bestaetigen()}>
            {busy ? 'Bestätige …' : 'Bestätigen'}
          </GlassButton>
        </div>
      )}
    </Glass>
  );
}
