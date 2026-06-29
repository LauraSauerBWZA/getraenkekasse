import { useCallback, useEffect, useMemo, useState } from 'react';
import { DrinkEtikett, EmptyState, Glass, GlassButton, Loading } from '../components/primitives';
import {
  api,
  ApiError,
  compareDrinkName,
  drinkSubzeile,
  DRINK_KATEGORIEN,
  formatGuthaben,
  type Drink,
  type DrinkKategorie,
  type Transaktion,
} from '../lib/api';
import { useAuth } from '../lib/auth';

// Spiegel der Backend-Konstante (routes/buchen.ts). Reine UI-Anzeige —
// Backend bleibt die Wahrheit (lehnt Stornos nach Ablauf serverseitig ab).
const STORNO_FENSTER_MS = 5 * 60 * 1000;
const LAST_BOOKING_KEY = 'bwza_last_booking';

function loadLastBookingFromStorage(): LastBooking | null {
  try {
    const raw = sessionStorage.getItem(LAST_BOOKING_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as LastBooking;
    const createdAtMs = new Date(saved.transaktion.createdAt).getTime();
    if (Date.now() >= createdAtMs + STORNO_FENSTER_MS) {
      sessionStorage.removeItem(LAST_BOOKING_KEY);
      return null;
    }
    return saved;
  } catch {
    return null;
  }
}

const KATEGORIE_LABEL: Record<DrinkKategorie, string> = {
  alkoholfrei: 'Alkoholfrei',
  alkoholisch: 'Alkoholisch',
  sonstiges: 'Sonstiges',
};

function formatPreis(cent: number): string {
  return (cent / 100).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' €';
}

interface LastBooking {
  transaktion: Transaktion;
  drink: Drink;
}

export default function Buchen() {
  const { user, setUser } = useAuth();
  const [drinks, setDrinks] = useState<Drink[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<Drink | null>(null);
  const [lastBooking, setLastBooking] = useState<LastBooking | null>(
    () => loadLastBookingFromStorage(),
  );

  const saveLastBooking = useCallback((booking: LastBooking) => {
    try {
      sessionStorage.setItem(LAST_BOOKING_KEY, JSON.stringify(booking));
    } catch {
      // sessionStorage nicht verfügbar (z.B. Private-Mode-Limit) — kein Problem
    }
    setLastBooking(booking);
  }, []);

  const clearLastBooking = useCallback(() => {
    sessionStorage.removeItem(LAST_BOOKING_KEY);
    setLastBooking(null);
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const r = await api.drinks();
      setDrinks(r.drinks);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Liste konnte nicht geladen werden.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    if (!drinks) return null;
    const map = new Map<DrinkKategorie, Drink[]>();
    for (const kat of DRINK_KATEGORIEN) map.set(kat, []);
    for (const d of drinks) {
      const list = map.get(d.kategorie);
      if (list) list.push(d);
    }
    // Innerhalb jeder Kategorie deutsch-alphabetisch (Umlaute, Groß/Klein egal).
    for (const list of map.values()) list.sort(compareDrinkName);
    return map;
  }, [drinks]);

  if (!user) return null;

  return (
    <div className="bwza-stage" style={{ padding: '0 var(--bwza-page-x) 40px' }}>
      <div style={{ paddingTop: 30, paddingBottom: 18 }}>
        <div className="bwza-eyebrow">Phase B2c · Buchen</div>
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
          Was darf's sein?
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

      {lastBooking && (
        <LastBookingCard
          booking={lastBooking}
          onUndone={(newGuthaben) => {
            setUser({ ...user, guthabenCent: newGuthaben });
            clearLastBooking();
          }}
          onWindowExpired={clearLastBooking}
        />
      )}

      {loadError ? (
        <Glass tone="dark" style={{ borderRadius: 18, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--bwza-rescue-soft)' }}>{loadError}</div>
        </Glass>
      ) : drinks === null ? (
        <Loading />
      ) : drinks.length === 0 ? (
        <EmptyState title="Keine Getränke" sub="Aktuell ist nichts buchbar — frag deinen Verwalter." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {DRINK_KATEGORIEN.map((kat) => {
            const list = grouped?.get(kat) ?? [];
            if (list.length === 0) return null;
            return (
              <section key={kat}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0.6,
                    color: 'var(--bwza-ink-dim)',
                    textTransform: 'uppercase',
                    marginBottom: 8,
                    paddingLeft: 2,
                  }}
                >
                  {KATEGORIE_LABEL[kat]}{' '}
                  <span style={{ color: 'var(--bwza-ink-mute)' }}>· {list.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {list.map((d) => (
                    <DrinkRow key={d.id} drink={d} onPick={() => setPending(d)} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {pending && (
        <ConfirmSheet
          drink={pending}
          guthabenCent={user.guthabenCent}
          onClose={() => setPending(null)}
          onBooked={(newGuthaben, transaktion) => {
            setUser({ ...user, guthabenCent: newGuthaben });
            saveLastBooking({ transaktion, drink: pending });
            setPending(null);
          }}
        />
      )}
    </div>
  );
}

function DrinkRow({ drink, onPick }: { drink: Drink; onPick: () => void }) {
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
      <DrinkEtikett drink={drink} size={40} />
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
          {drink.name}
        </div>
        {drinkSubzeile(drink) && (
          <div
            style={{
              marginTop: 2,
              fontSize: 12,
              color: 'var(--bwza-ink-mute)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {drinkSubzeile(drink)}
          </div>
        )}
        <div style={{ marginTop: 2, fontSize: 12, color: 'var(--bwza-ink-mute)' }}>
          {formatPreis(drink.preisCent)}
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
  );
}

function ConfirmSheet({
  drink,
  guthabenCent,
  onClose,
  onBooked,
}: {
  drink: Drink;
  guthabenCent: number;
  onClose: () => void;
  onBooked: (newGuthabenCent: number, transaktion: Transaktion) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const neuerStand = guthabenCent - drink.preisCent;
  const willNegativeWerden = neuerStand < 0;

  const confirm = async () => {
    setErr(null);
    setBusy(true);
    try {
      const r = await api.buchen(drink.id);
      onBooked(r.guthabenCent, r.transaktion);
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
        // Bündel 7: Overlay endet an der Nav-Oberkante (bottom = Nav-Gesamthöhe aus
        // den Tokens) statt inset:0 → Backdrop UND Karte liegen ÜBER der Bottom-Nav;
        // die Nav bleibt frei darunter sichtbar/bedienbar, „Bestätigen" sitzt knapp
        // darüber (kein Voll-Overlay über die Nav, kein Magie-Pixelwert).
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 'var(--bwza-nav-total)',
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
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 480 }}
      >
        <Glass
          tone="raise"
          style={{
            borderRadius: 22,
            padding: '20px 18px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div>
            <div className="bwza-eyebrow">Buchung bestätigen</div>
            {drink.bildDataUrl ? (
              // Mit Etikett: Bild groß oben, darunter Name/Subzeile/Preis (zentriert).
              <div
                style={{
                  marginTop: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                  textAlign: 'center',
                }}
              >
                <DrinkEtikett drink={drink} size={140} radius="var(--bwza-radius-md)" />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: 'var(--bwza-font-display)',
                      fontSize: 22,
                      fontWeight: 600,
                      color: 'var(--bwza-ink)',
                      letterSpacing: -0.3,
                    }}
                  >
                    {drink.name}
                  </div>
                  {drinkSubzeile(drink) && (
                    <div style={{ marginTop: 2, fontSize: 12.5, color: 'var(--bwza-ink-mute)' }}>
                      {drinkSubzeile(drink)}
                    </div>
                  )}
                  <div style={{ marginTop: 2, fontSize: 14, color: 'var(--bwza-ink-dim)' }}>
                    {formatPreis(drink.preisCent)}
                  </div>
                </div>
              </div>
            ) : (
              // Fallback ohne Bild: bisheriges horizontales Layout (Akzent-Block).
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8 }}>
                <DrinkEtikett drink={drink} size={56} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontFamily: 'var(--bwza-font-display)',
                      fontSize: 22,
                      fontWeight: 600,
                      color: 'var(--bwza-ink)',
                      letterSpacing: -0.3,
                    }}
                  >
                    {drink.name}
                  </div>
                  {drinkSubzeile(drink) && (
                    <div style={{ marginTop: 2, fontSize: 12.5, color: 'var(--bwza-ink-mute)' }}>
                      {drinkSubzeile(drink)}
                    </div>
                  )}
                  <div style={{ marginTop: 2, fontSize: 14, color: 'var(--bwza-ink-dim)' }}>
                    {formatPreis(drink.preisCent)}
                  </div>
                </div>
              </div>
            )}
          </div>

          <Glass tone="dark" style={{ borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--bwza-ink-mute)' }}>
              <span>Guthaben jetzt</span>
              <span>{formatGuthaben(guthabenCent)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 15,
                fontWeight: 600,
                marginTop: 6,
                color: willNegativeWerden ? 'var(--bwza-rescue-soft)' : 'var(--bwza-ink)',
              }}
            >
              <span>Nach Buchung</span>
              <span>{formatGuthaben(neuerStand)}</span>
            </div>
          </Glass>

          {willNegativeWerden && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--bwza-rescue-soft)',
                paddingLeft: 2,
              }}
            >
              Du gehst auf {formatGuthaben(neuerStand)} — trotzdem buchen?
            </div>
          )}

          {err && (
            <div style={{ fontSize: 12, color: 'var(--bwza-rescue-soft)', paddingLeft: 2 }}>{err}</div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <GlassButton variant="ghost" full size="md" onClick={onClose} disabled={busy}>
              Abbrechen
            </GlassButton>
            <GlassButton full size="md" onClick={() => void confirm()} disabled={busy}>
              {busy ? 'Buche …' : 'Bestätigen'}
            </GlassButton>
          </div>
        </Glass>
      </div>
    </div>
  );
}

// „Letzte Buchung"-Karte mit Rückgängig-Affordance. Übersteht Navigations-
// wechsel (sessionStorage-Persistenz), solange das 5-Min-Fenster noch läuft.
// Ein laufender Sekundentimer blendet die Karte aus, wenn das Fenster
// währenddessen abläuft. Backend bleibt die Wahrheit — zu späte Stornos
// werden serverseitig abgewiesen.
function LastBookingCard({
  booking,
  onUndone,
  onWindowExpired,
}: {
  booking: LastBooking;
  onUndone: (newGuthabenCent: number) => void;
  onWindowExpired: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const createdAtMs = useMemo(
    () => new Date(booking.transaktion.createdAt).getTime(),
    [booking.transaktion.createdAt],
  );

  useEffect(() => {
    // Sekündlicher Tick reicht — wir zeigen Minuten an, brauchen aber eine
    // saubere Live-Aktualisierung des Rest-Zählers nahe Ablauf.
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const ablaufMs = createdAtMs + STORNO_FENSTER_MS;
  const restMs = ablaufMs - now;

  useEffect(() => {
    if (restMs <= 0) onWindowExpired();
  }, [restMs, onWindowExpired]);

  if (restMs <= 0) return null;

  const restMinuten = Math.max(0, Math.ceil(restMs / 60_000));

  const undo = async () => {
    setErr(null);
    setBusy(true);
    try {
      const r = await api.storno(booking.transaktion.id);
      onUndone(r.guthabenCent);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Rückgängig fehlgeschlagen.');
      setBusy(false);
    }
  };

  return (
    <Glass
      tone="dark"
      style={{
        borderRadius: 16,
        padding: '12px 14px',
        marginBottom: 18,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <DrinkEtikett drink={booking.drink} size={40} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.6,
            color: 'var(--bwza-ink-dim)',
            textTransform: 'uppercase',
          }}
        >
          Letzte Buchung
        </div>
        <div
          style={{
            fontFamily: 'var(--bwza-font-display)',
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--bwza-ink)',
            letterSpacing: -0.1,
            marginTop: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {booking.drink.name}{' '}
          <span style={{ color: 'var(--bwza-ink-mute)', fontWeight: 500 }}>
            · {formatPreis(booking.drink.preisCent)}
          </span>
        </div>
        <div style={{ marginTop: 2, fontSize: 11, color: 'var(--bwza-ink-mute)' }}>
          Noch {restMinuten} Min rückgängig
        </div>
        {err && (
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--bwza-rescue-soft)' }}>{err}</div>
        )}
      </div>
      <GlassButton
        variant="ghost"
        size="sm"
        onClick={() => void undo()}
        disabled={busy}
      >
        {busy ? '…' : 'Rückgängig'}
      </GlassButton>
    </Glass>
  );
}
