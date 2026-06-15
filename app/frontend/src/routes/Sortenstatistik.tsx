import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Glass, GlassButton } from '../components/primitives';
import { api, ApiError, type SortenStat, type SortenStatistik, type StatistikZeitraum } from '../lib/api';
import { useAuth } from '../lib/auth';

const ZEITRAEUME: { key: StatistikZeitraum; label: string }[] = [
  { key: 'woche', label: 'Woche' },
  { key: 'monat', label: 'Monat' },
  { key: 'quartal', label: 'Quartal' },
];

const KATEGORIE_LABEL: Record<string, string> = {
  alkoholfrei: 'Alkoholfrei',
  alkoholisch: 'Alkoholisch',
  sonstiges: 'Sonstiges',
};

function formatEuro(cent: number): string {
  return (cent / 100).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' €';
}

// App-weite, anonyme Sortenstatistik (KONFIGURATION §7.5). Gleicher Screen für
// Admin und Leitung. Kein User-Bezug — rein Drink-Totale.
export default function Sortenstatistik() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [zeitraum, setZeitraum] = useState<StatistikZeitraum>('monat');
  const [data, setData] = useState<SortenStatistik | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (z: StatistikZeitraum) => {
    setLoading(true);
    setLoadError(null);
    try {
      setData(await api.sortenStatistik(z));
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Statistik konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(zeitraum);
  }, [load, zeitraum]);

  if (!user) return null;

  const maxAnzahl = data && data.sorten.length > 0 ? data.sorten[0].anzahl : 0;

  return (
    <div className="bwza-stage" style={{ padding: '0 var(--bwza-page-x) 40px' }}>
      <div style={{ paddingTop: 30, paddingBottom: 16 }}>
        <div className="bwza-eyebrow">Phase B3 · Statistik</div>
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
          Sortenstatistik
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--bwza-ink-dim)' }}>
          App-weit aggregiert — wie oft welches Getränk gebucht wurde. Anonym, ohne Personenbezug.
        </div>
      </div>

      {/* Zeitfilter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {ZEITRAEUME.map((z) => (
          <GlassButton
            key={z.key}
            variant={zeitraum === z.key ? 'primary' : 'ghost'}
            size="sm"
            full
            onClick={() => setZeitraum(z.key)}
          >
            {z.label}
          </GlassButton>
        ))}
      </div>

      {loadError ? (
        <Glass tone="dark" style={{ borderRadius: 18, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--bwza-rescue-soft)' }}>{loadError}</div>
        </Glass>
      ) : loading && !data ? (
        <Glass tone="dark" style={{ borderRadius: 18, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--bwza-ink-mute)' }}>Lädt …</div>
        </Glass>
      ) : data && data.sorten.length === 0 ? (
        <Glass tone="dark" style={{ borderRadius: 18, padding: '18px 16px' }}>
          <div style={{ fontSize: 13, color: 'var(--bwza-ink-mute)' }}>
            In diesem Zeitraum wurden keine Getränke gebucht.
          </div>
        </Glass>
      ) : data ? (
        <>
          <Glass tone="amber" style={{ borderRadius: 18, padding: '14px 16px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div className="bwza-eyebrow">Gesamt</div>
              <div style={{ fontSize: 13, color: 'var(--bwza-ink-dim)' }}>
                <span style={{ color: 'var(--bwza-ink)', fontWeight: 600 }}>{data.gesamtAnzahl}</span>{' '}
                Buchungen ·{' '}
                <span style={{ color: 'var(--bwza-ink)', fontWeight: 600 }}>
                  {formatEuro(data.gesamtUmsatzCent)}
                </span>
              </div>
            </div>
          </Glass>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.sorten.map((s) => (
              <SorteRow key={s.drinkId} sorte={s} maxAnzahl={maxAnzahl} />
            ))}
          </div>
        </>
      ) : null}

      <div style={{ marginTop: 22 }}>
        <GlassButton variant="ghost" full onClick={() => navigate(user.isAdmin ? '/admin' : '/leitung')}>
          Zurück
        </GlassButton>
      </div>
    </div>
  );
}

function SorteRow({ sorte, maxAnzahl }: { sorte: SortenStat; maxAnzahl: number }) {
  const anteil = maxAnzahl > 0 ? Math.max(4, Math.round((sorte.anzahl / maxAnzahl) * 100)) : 0;
  return (
    <Glass tone="dark" style={{ borderRadius: 16, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          aria-hidden
          style={{
            width: 38,
            height: 38,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            background: 'rgba(0,0,0,0.30)',
            borderRadius: 12,
            border: '1px solid var(--bwza-glass-line)',
          }}
        >
          {sorte.icon ?? '·'}
        </div>
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
            {sorte.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--bwza-ink-mute)' }}>
            {sorte.kategorie ? KATEGORIE_LABEL[sorte.kategorie] ?? sorte.kategorie : '—'}
          </div>
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--bwza-ink)' }}>
            {sorte.anzahl}×
          </div>
          <div style={{ fontSize: 11, color: 'var(--bwza-ink-mute)' }}>{formatEuro(sorte.umsatzCent)}</div>
        </div>
      </div>
      {/* schlichte relative Balkenlänge (kein Chart — Politur ist B5) */}
      <div
        style={{
          marginTop: 8,
          height: 4,
          borderRadius: 999,
          background: 'rgba(0,0,0,0.30)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${anteil}%`,
            height: '100%',
            background: 'var(--bwza-accent, #d98a4a)',
            borderRadius: 999,
          }}
        />
      </div>
    </Glass>
  );
}
