import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState, Glass, Loading, StatCard } from '../components/primitives';
import { ScrollList } from '../components/ScrollList';
import {
  api,
  ApiError,
  type Journal,
  type JournalAchievement,
  type MeineHistorie,
  type MeineTransaktion,
  type TransaktionTyp,
  type VerlaufTag,
} from '../lib/api';
import { useAuth } from '../lib/auth';

const TYP_LABEL: Record<TransaktionTyp, string> = {
  KAUF: 'Buchung',
  AUFLADUNG_PAYPAL: 'PayPal-Aufladung',
  AUFLADUNG_BARGELD: 'Bargeld-Aufladung',
  KORREKTUR: 'Korrektur',
  STORNO: 'Storno',
};

function formatEuro(cent: number): string {
  return (cent / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
function formatSigned(cent: number): string {
  const vz = cent > 0 ? '+ ' : cent < 0 ? '− ' : '';
  return vz + formatEuro(Math.abs(cent));
}
function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}
function formatTag(datum: string): string {
  return new Date(datum + 'T12:00:00Z').toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}
function formatZeit(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function Verlauf() {
  const { user } = useAuth();
  const [journal, setJournal] = useState<Journal | null>(null);
  const [historie, setHistorie] = useState<MeineHistorie | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [j, h] = await Promise.all([api.journal(), api.meineTransaktionen()]);
      setJournal(j);
      setHistorie(h);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Verlauf konnte nicht geladen werden.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) return null;

  return (
    <div className="bwza-stage" style={{ padding: '0 var(--bwza-page-x) 40px' }}>
      <div style={{ paddingTop: 30, paddingBottom: 16 }}>
        <div className="bwza-eyebrow">🕒 Verlauf</div>
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
          Dein Trinkjournal
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--bwza-ink-dim)' }}>
          Privat — nur du siehst das. Sortenagnostisch, ganz entspannt.
        </div>
      </div>

      {loadError && (
        <Glass tone="dark" style={{ borderRadius: 18, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--bwza-rescue-soft)' }}>{loadError}</div>
        </Glass>
      )}

      {journal && (
        <>
          <HeroCard heroMonat={journal.heroMonat} />
          <StatStrip journal={journal} />
          <Verlauf30 verlauf={journal.verlauf30} historie={historie} />
          <Achievements achievements={journal.achievements} />
        </>
      )}

      <Historie historie={historie} />
    </div>
  );
}

function HeroCard({ heroMonat }: { heroMonat: number }) {
  return (
    <Glass
      tone="amber"
      style={{ borderRadius: 22, padding: '20px 18px 22px', boxShadow: 'var(--bwza-glow-amber)' }}
    >
      <div className="bwza-eyebrow">Diesen Monat</div>
      <div
        style={{
          fontFamily: 'var(--bwza-font-ui)',
          fontSize: 'var(--bwza-text-num)',
          fontWeight: 300,
          letterSpacing: -1.5,
          marginTop: 4,
          color: 'var(--bwza-ink)',
        }}
      >
        {heroMonat}
      </div>
      <div style={{ marginTop: 2, fontSize: 13, color: 'var(--bwza-ink-dim)' }}>
        {heroMonat === 1 ? 'Getränk gebucht' : 'Getränke gebucht'}
      </div>
    </Glass>
  );
}

function StatStrip({ journal }: { journal: Journal }) {
  const items = [
    { label: 'Diese Woche', wert: String(journal.dieseWoche) },
    { label: 'Streak', wert: `${journal.streak} ${journal.streak === 1 ? 'Tag' : 'Tage'}` },
    { label: 'Längste Pause', wert: `${journal.laengstePause} ${journal.laengstePause === 1 ? 'Tag' : 'Tage'}` },
  ];
  return (
    <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
      {items.map((it) => (
        <StatCard key={it.label} eyebrow={it.label} value={it.wert} />
      ))}
    </div>
  );
}

function Verlauf30({ verlauf, historie }: { verlauf: VerlaufTag[]; historie: MeineHistorie | null }) {
  const [sel, setSel] = useState<string | null>(null);
  const maxAnzahl = Math.max(1, ...verlauf.map((v) => v.anzahl));

  const tagBuchungen = useMemo(() => {
    if (!sel || !historie) return [];
    return historie.transaktionen.filter(
      (t) => t.typ === 'KAUF' && !t.storniert && dayKey(t.createdAt) === sel,
    );
  }, [sel, historie]);

  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          fontFamily: 'var(--bwza-font-display)',
          fontSize: 18,
          fontWeight: 600,
          color: 'var(--bwza-ink)',
          marginBottom: 8,
        }}
      >
        Letzte 30 Tage
      </div>
      <Glass tone="dark" style={{ borderRadius: 18, padding: '14px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 64 }}>
          {verlauf.map((v) => {
            const h = v.anzahl === 0 ? 3 : Math.max(6, Math.round((v.anzahl / maxAnzahl) * 60));
            const farbe = v.istWochenende ? 'var(--bwza-amber-deep)' : 'var(--bwza-amber)';
            const aktiv = sel === v.datum;
            return (
              <button
                key={v.datum}
                onClick={() => setSel(aktiv ? null : v.datum)}
                title={`${formatTag(v.datum)}: ${v.anzahl}`}
                aria-label={`${formatTag(v.datum)}, ${v.anzahl} Buchungen`}
                style={{
                  flex: 1,
                  height: h,
                  minWidth: 0,
                  padding: 0,
                  border: 'none',
                  borderRadius: 3,
                  cursor: 'pointer',
                  background: v.anzahl === 0 ? 'rgba(255,255,255,0.08)' : farbe,
                  outline: aktiv ? '1px solid var(--bwza-amber-glow)' : 'none',
                  outlineOffset: 1,
                  opacity: v.anzahl === 0 ? 0.5 : 1,
                }}
              />
            );
          })}
        </div>
        <div style={{ marginTop: 8, fontSize: 10.5, color: 'var(--bwza-ink-mute)', textAlign: 'center' }}>
          {sel ? `${formatTag(sel)} · tippe erneut zum Schließen` : 'Tippe einen Balken für den Tag · Wochenende dunkler'}
        </div>

        {sel && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {tagBuchungen.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--bwza-ink-mute)' }}>
                Keine Buchung an diesem Tag.
              </div>
            ) : (
              tagBuchungen.map((t) => (
                <div
                  key={t.id}
                  style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--bwza-ink-dim)' }}
                >
                  <span>{t.drinkName ?? 'Getränk'}</span>
                  <span>{formatEuro(Math.abs(t.betragCent))}</span>
                </div>
              ))
            )}
          </div>
        )}
      </Glass>
    </div>
  );
}

function Achievements({ achievements }: { achievements: JournalAchievement[] }) {
  return (
    <div style={{ marginTop: 22 }}>
      <div
        style={{
          fontFamily: 'var(--bwza-font-display)',
          fontSize: 18,
          fontWeight: 600,
          color: 'var(--bwza-ink)',
          marginBottom: 8,
        }}
      >
        Abzeichen
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {achievements.map((a) => {
          const aktiv = a.freigeschaltet;
          return (
            <Glass
              key={a.key}
              tone={aktiv ? 'amber' : 'dark'}
              style={{ borderRadius: 16, padding: '12px 12px', opacity: aktiv ? 1 : 0.55 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22, filter: aktiv ? 'none' : 'grayscale(1)' }} aria-hidden>
                  {a.emoji}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontFamily: 'var(--bwza-font-display)',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--bwza-ink)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {a.titel}
                  </div>
                  {a.gesperrt && (
                    <div style={{ fontSize: 9.5, color: 'var(--bwza-ink-mute)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      bald
                    </div>
                  )}
                </div>
              </div>
              <div style={{ marginTop: 6, fontSize: 10.5, color: 'var(--bwza-ink-mute)', lineHeight: 1.35 }}>
                {a.beschreibung}
              </div>
              {a.fortschritt && !aktiv && (
                <div style={{ marginTop: 4, fontSize: 10, color: 'var(--bwza-ink-mute)' }}>
                  {a.fortschritt.ist}/{a.fortschritt.ziel}
                </div>
              )}
            </Glass>
          );
        })}
      </div>
    </div>
  );
}

function Historie({ historie }: { historie: MeineHistorie | null }) {
  return (
    <div style={{ marginTop: 24 }}>
      <div
        style={{
          fontFamily: 'var(--bwza-font-display)',
          fontSize: 18,
          fontWeight: 600,
          color: 'var(--bwza-ink)',
          marginBottom: 8,
        }}
      >
        Verlauf
      </div>

      {historie === null ? (
        <Loading />
      ) : historie.transaktionen.length === 0 ? (
        <EmptyState title="Noch nichts gebucht" sub="Geht doch los an der Theke 🍺" />
      ) : (
        <>
          <ScrollList>
            {historie.transaktionen.map((t) => (
              <HistorieRow key={t.id} tx={t} />
            ))}
          </ScrollList>
          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--bwza-ink-mute)', textAlign: 'center' }}>
            Du bist seit <strong style={{ color: 'var(--bwza-ink-dim)' }}>{historie.dabeiSeitTage}</strong>{' '}
            {historie.dabeiSeitTage === 1 ? 'Tag' : 'Tagen'} dabei.
          </div>
        </>
      )}
    </div>
  );
}

function HistorieRow({ tx }: { tx: MeineTransaktion }) {
  const positiv = tx.betragCent > 0;
  const titel = TYP_LABEL[tx.typ] + (tx.drinkName ? ` · ${tx.drinkName}` : '');
  return (
    <Glass tone="dark" style={{ borderRadius: 16, padding: '12px 14px', opacity: tx.storniert ? 0.55 : 1 }}>
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
        </div>
        <div
          style={{
            flexShrink: 0,
            fontSize: 14,
            fontWeight: 600,
            color: positiv ? 'var(--bwza-success)' : 'var(--bwza-ink-dim)',
          }}
        >
          {formatSigned(tx.betragCent)}
        </div>
      </div>
    </Glass>
  );
}
