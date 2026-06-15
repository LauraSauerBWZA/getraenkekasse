import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState, Glass, GlassButton, Loading } from '../components/primitives';
import {
  api,
  ApiError,
  type KassenHistorieEintrag,
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

const TYP_LABEL: Record<string, string> = {
  EINZAHLUNG: 'Einzahlung',
  EINLAGE_BOX: 'Einlage Box',
  EINKAUF: 'Einkauf',
  ENTNAHME: 'Entnahme',
  SPENDE: 'Spende',
  KORREKTUR: 'Korrektur',
};

// Read-only Kassen-Einsicht für die Rolle „Leitung" (KONFIGURATION §7.3).
// Bewusst OHNE Aktions-Buttons. Mitglieder-Guthaben erscheint nur als EINE
// Summe (DSGVO §9 — keine Einzelsalden, keine Trinkjournale). Admins sehen
// dieselben Daten zusätzlich mit Aktionen unter /admin/kasse.
export default function LeitungKasse() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<KassenSummary | null>(null);
  const [historie, setHistorie] = useState<KassenHistorieEintrag[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [s, h] = await Promise.all([api.adminKasseSummary(), api.adminKasseHistorie()]);
      setSummary(s);
      setHistorie(h.buchungen);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Kassen-Einsicht konnte nicht geladen werden.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) return null;

  const deckungNegativ = (summary?.deckungCent ?? 0) < 0;

  return (
    <div className="bwza-stage" style={{ padding: '0 var(--bwza-page-x) 40px' }}>
      <div style={{ paddingTop: 30, paddingBottom: 16 }}>
        <div className="bwza-eyebrow">Phase B2j · Leitung</div>
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
          Kassen-Einsicht
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--bwza-ink-dim)' }}>
          Nur-Lesen. Finanz-Überblick ohne Einzelsalden.
        </div>
      </div>

      {loadError && (
        <Glass tone="dark" style={{ borderRadius: 18, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--bwza-rescue-soft)' }}>{loadError}</div>
        </Glass>
      )}

      {summary && (
        <>
          <Glass tone="amber" style={{ borderRadius: 22, padding: '18px 18px 20px' }}>
            <div className="bwza-eyebrow">Vereinsvermögen</div>
            <div
              style={{
                fontFamily: 'var(--bwza-font-display)',
                fontSize: 'var(--bwza-text-num)',
                fontWeight: 600,
                letterSpacing: -1,
                marginTop: 6,
                color: 'var(--bwza-ink)',
              }}
            >
              {formatEuro(summary.vereinsvermoegenCent)}
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--bwza-ink-mute)' }}>
              Summe aller Verwalter-Töpfe + Bar-Vereinskasse
            </div>
          </Glass>

          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {summary.toepfe.map((t) => (
              <StandRow
                key={t.verwalterId}
                label={`${t.firstName} ${t.lastName}`}
                sub="Verwalter-Topf"
                betragCent={t.betragCent}
              />
            ))}
            <StandRow label="Bar-Vereinskasse" sub="Box · nachzählbar" betragCent={summary.boxCent} />
          </div>

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
              Vereinsvermögen minus dem, was die Kasse den Mitgliedern schuldet.{' '}
              {deckungNegativ ? 'Negativ — die Kasse ist unterdeckt.' : 'Positiv = Puffer.'}
            </div>
          </Glass>

          {/* Mitglieder-Guthaben: EINE Summe, keine Einzelsalden (DSGVO §9) */}
          <Glass tone="dark" style={{ borderRadius: 18, padding: '14px 16px', marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div className="bwza-eyebrow">Guthaben aller Mitglieder</div>
              <div
                style={{
                  fontFamily: 'var(--bwza-font-display)',
                  fontSize: 18,
                  fontWeight: 600,
                  color: 'var(--bwza-ink)',
                }}
              >
                {formatEuro(summary.mitgliederGuthabenSummeCent)}
              </div>
            </div>
            <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--bwza-ink-mute)' }}>
              Gesamtsumme — keine Einzelbeträge je Person.
            </div>
          </Glass>
        </>
      )}

      <Glass
        tone="dark"
        onClick={() => navigate('/statistik')}
        style={{
          borderRadius: 18,
          padding: '14px 16px',
          marginTop: 22,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div className="bwza-eyebrow">📊 Statistik</div>
          <div
            style={{
              fontFamily: 'var(--bwza-font-display)',
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--bwza-ink)',
              marginTop: 2,
              letterSpacing: -0.2,
            }}
          >
            Sortenstatistik
          </div>
          <div style={{ marginTop: 2, fontSize: 11, color: 'var(--bwza-ink-mute)' }}>
            Anzahl + Umsatz je Getränk (anonym)
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

      <Historie historie={historie} />

      <div style={{ marginTop: 22 }}>
        <GlassButton variant="ghost" full onClick={() => navigate('/')}>
          Zurück
        </GlassButton>
      </div>
    </div>
  );
}

function StandRow({ label, sub, betragCent }: { label: string; sub: string; betragCent: number }) {
  const negativ = betragCent < 0;
  return (
    <Glass
      tone="dark"
      style={{ borderRadius: 16, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}
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

function Historie({ historie }: { historie: KassenHistorieEintrag[] | null }) {
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
        <EmptyState title="Noch keine Bewegungen" sub="Kassen-Buchungen erscheinen hier." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {historie.map((b) => (
            <HistorieRow key={b.id} eintrag={b} />
          ))}
        </div>
      )}
    </div>
  );
}

function HistorieRow({ eintrag }: { eintrag: KassenHistorieEintrag }) {
  const positiv = eintrag.betragCent > 0;
  const kontoText = eintrag.konto === 'BOX' ? 'Box' : eintrag.verwalterName ?? 'Verwalter-Topf';
  return (
    <Glass tone="dark" style={{ borderRadius: 16, padding: '12px 14px' }}>
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
          }}
        >
          {formatSigned(eintrag.betragCent)}
        </div>
      </div>
    </Glass>
  );
}
