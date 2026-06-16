import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState, Glass, GlassButton, GlassInput, Loading } from '../components/primitives';
import {
  api,
  ApiError,
  DRINK_KATEGORIEN,
  type Drink,
  type DrinkInput,
  type DrinkKategorie,
} from '../lib/api';
import { useAuth } from '../lib/auth';

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

// "1,50" / "1.50" / "2" → 150/150/200 Cent. Liefert null bei ungültig/leer/negativ.
function parsePreisToCent(input: string): number | null {
  const trimmed = input.trim().replace(',', '.');
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const euro = Number(trimmed);
  if (!Number.isFinite(euro) || euro < 0) return null;
  return Math.round(euro * 100);
}

type FormMode = { mode: 'create' } | { mode: 'edit'; drink: Drink };

export default function AdminDrinks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [drinks, setDrinks] = useState<Drink[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const r = await api.adminDrinks();
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
    return map;
  }, [drinks]);

  const toggleActive = async (drink: Drink) => {
    setRowError(null);
    setBusyId(drink.id);
    try {
      const r = await api.adminDrinkSetActive(drink.id, !drink.isActive);
      setDrinks((prev) =>
        prev ? prev.map((d) => (d.id === r.drink.id ? r.drink : d)) : prev,
      );
    } catch (e) {
      setRowError(e instanceof ApiError ? e.message : 'Umschalten fehlgeschlagen.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSaved = (saved: Drink, wasCreate: boolean) => {
    setDrinks((prev) => {
      if (!prev) return [saved];
      if (wasCreate) return [...prev, saved];
      return prev.map((d) => (d.id === saved.id ? saved : d));
    });
    setFormMode(null);
  };

  if (!user) return null;

  return (
    <div className="bwza-stage" style={{ padding: '0 var(--bwza-page-x) 40px' }}>
      <div style={{ paddingTop: 30, paddingBottom: 18 }}>
        <div className="bwza-eyebrow">Phase B2b · Verwaltung</div>
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
          Drink-Katalog
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--bwza-ink-dim)' }}>
          Aktive Drinks erscheinen im Buchen-Tab der Mitglieder. Inaktive bleiben für die Buchhaltung erhalten, werden aber nicht mehr angeboten.
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <GlassButton full size="lg" onClick={() => setFormMode({ mode: 'create' })}>
          + Neuer Drink
        </GlassButton>
      </div>

      {rowError && (
        <Glass tone="dark" style={{ borderRadius: 14, padding: '10px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--bwza-rescue-soft)' }}>{rowError}</div>
        </Glass>
      )}

      {loadError ? (
        <Glass tone="dark" style={{ borderRadius: 18, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--bwza-rescue-soft)' }}>{loadError}</div>
        </Glass>
      ) : drinks === null ? (
        <Loading />
      ) : drinks.length === 0 ? (
        <EmptyState title="Katalog ist leer" sub="Lege oben den ersten Drink an." />
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
                  {KATEGORIE_LABEL[kat]} <span style={{ color: 'var(--bwza-ink-mute)' }}>· {list.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {list.map((d) => (
                    <DrinkCatalogRow
                      key={d.id}
                      drink={d}
                      busy={busyId === d.id}
                      onToggle={() => void toggleActive(d)}
                      onEdit={() => setFormMode({ mode: 'edit', drink: d })}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 22 }}>
        <GlassButton variant="ghost" full onClick={() => navigate('/admin')}>
          Zurück
        </GlassButton>
      </div>

      {formMode && (
        <DrinkForm
          mode={formMode}
          onSaved={handleSaved}
          onCancel={() => setFormMode(null)}
        />
      )}
    </div>
  );
}

function DrinkCatalogRow({
  drink,
  busy,
  onToggle,
  onEdit,
}: {
  drink: Drink;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const dimmed = !drink.isActive;
  return (
    <Glass
      tone="dark"
      style={{
        borderRadius: 16,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        opacity: dimmed ? 0.55 : 1,
        transition: 'opacity var(--bwza-dur) var(--bwza-ease)',
      }}
    >
      <button
        type="button"
        onClick={onEdit}
        aria-label={`${drink.name} bearbeiten`}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          aria-hidden
          style={{
            width: 36,
            height: 36,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            background: 'rgba(0,0,0,0.30)',
            borderRadius: 10,
            border: '1px solid var(--bwza-glass-line)',
          }}
        >
          {drink.icon ?? '·'}
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
            {drink.name}
            {dimmed && (
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
                inaktiv
              </span>
            )}
          </div>
          <div style={{ marginTop: 2, fontSize: 12, color: 'var(--bwza-ink-mute)' }}>
            {formatPreis(drink.preisCent)}
          </div>
        </div>
      </button>
      <ActiveToggle isActive={drink.isActive} busy={busy} onClick={onToggle} />
    </Glass>
  );
}

function DrinkForm({
  mode,
  onSaved,
  onCancel,
}: {
  mode: FormMode;
  onSaved: (drink: Drink, wasCreate: boolean) => void;
  onCancel: () => void;
}) {
  const initial = mode.mode === 'edit' ? mode.drink : null;
  const [name, setName] = useState(initial?.name ?? '');
  const [preisEuro, setPreisEuro] = useState(
    initial ? (initial.preisCent / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
  );
  const [icon, setIcon] = useState(initial?.icon ?? '');
  const [kategorie, setKategorie] = useState<DrinkKategorie>(initial?.kategorie ?? 'alkoholfrei');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErr('Name darf nicht leer sein.');
      return;
    }
    const preisCent = parsePreisToCent(preisEuro);
    if (preisCent === null) {
      setErr('Preis bitte als z.B. "1,50" oder "2" angeben.');
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      if (mode.mode === 'create') {
        const payload: DrinkInput = {
          name: name.trim(),
          preisCent,
          kategorie,
        };
        if (icon.trim()) payload.icon = icon.trim();
        const r = await api.adminDrinkCreate(payload);
        onSaved(r.drink, true);
      } else {
        // Edit: nur tatsächlich geänderte Felder schicken
        const patch: Partial<DrinkInput> = {};
        if (name.trim() !== mode.drink.name) patch.name = name.trim();
        if (preisCent !== mode.drink.preisCent) patch.preisCent = preisCent;
        if (kategorie !== mode.drink.kategorie) patch.kategorie = kategorie;
        const iconTrim = icon.trim();
        const currentIcon = mode.drink.icon ?? '';
        if (iconTrim !== currentIcon) patch.icon = iconTrim;
        if (Object.keys(patch).length === 0) {
          // Nichts geändert — einfach schließen
          onSaved(mode.drink, false);
          return;
        }
        const r = await api.adminDrinkUpdate(mode.drink.id, patch);
        onSaved(r.drink, false);
      }
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Speichern fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const isEdit = mode.mode === 'edit';

  return (
    <div
      role="dialog"
      aria-modal="true"
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
      onClick={onCancel}
    >
      <form
        onSubmit={submit}
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
            gap: 14,
          }}
        >
          <div>
            <div className="bwza-eyebrow">{isEdit ? 'Drink bearbeiten' : 'Neuer Drink'}</div>
            <div
              style={{
                fontFamily: 'var(--bwza-font-display)',
                fontSize: 22,
                fontWeight: 600,
                color: 'var(--bwza-ink)',
                letterSpacing: -0.3,
                marginTop: 2,
              }}
            >
              {isEdit ? mode.drink.name : 'Sorte anlegen'}
            </div>
          </div>

          <GlassInput
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Cola"
            autoFocus
          />

          <GlassInput
            label="Preis (€)"
            value={preisEuro}
            onChange={(e) => setPreisEuro(e.target.value)}
            placeholder="1,50"
            hint="Eingabe in Euro mit Komma oder Punkt, z.B. 1,50 oder 2"
          />

          <GlassInput
            label="Icon (Emoji, optional)"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="🥤"
          />

          <KategorieSelect value={kategorie} onChange={setKategorie} />

          {err && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--bwza-rescue-soft)',
                paddingLeft: 2,
              }}
            >
              {err}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <GlassButton variant="ghost" full size="md" onClick={onCancel}>
              Abbrechen
            </GlassButton>
            <GlassButton type="submit" full size="md" disabled={busy}>
              {busy ? 'Speichere …' : isEdit ? 'Speichern' : 'Anlegen'}
            </GlassButton>
          </div>
        </Glass>
      </form>
    </div>
  );
}

function KategorieSelect({
  value,
  onChange,
}: {
  value: DrinkKategorie;
  onChange: (k: DrinkKategorie) => void;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.3,
          color: 'var(--bwza-ink-dim)',
          marginBottom: 6,
          paddingLeft: 2,
        }}
      >
        Kategorie
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {DRINK_KATEGORIEN.map((kat) => {
          const active = kat === value;
          return (
            <button
              key={kat}
              type="button"
              onClick={() => onChange(kat)}
              style={{
                all: 'unset',
                cursor: 'pointer',
                flex: 1,
                textAlign: 'center',
                padding: '10px 8px',
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: 0.2,
                color: active ? 'var(--bwza-teal-ink)' : 'var(--bwza-ink)',
                background: active
                  ? 'linear-gradient(180deg, var(--bwza-teal), var(--bwza-teal-deep))'
                  : 'rgba(0,0,0,0.30)',
                border: `1px solid ${active ? 'transparent' : 'var(--bwza-glass-line)'}`,
                boxShadow: active ? 'var(--bwza-shadow-amber)' : 'none',
                transition: 'background var(--bwza-dur) var(--bwza-ease)',
              }}
            >
              {KATEGORIE_LABEL[kat]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ActiveToggle({
  isActive,
  busy,
  onClick,
}: {
  isActive: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  const style: CSSProperties = {
    all: 'unset',
    cursor: busy ? 'wait' : 'pointer',
    flexShrink: 0,
    width: 44,
    height: 26,
    borderRadius: 999,
    position: 'relative',
    background: isActive
      ? 'linear-gradient(180deg, var(--bwza-teal), var(--bwza-teal-deep))'
      : 'rgba(0,0,0,0.40)',
    border: '1px solid var(--bwza-glass-line)',
    transition: 'background var(--bwza-dur) var(--bwza-ease)',
    opacity: busy ? 0.5 : 1,
  };
  const knob: CSSProperties = {
    position: 'absolute',
    top: 2,
    left: isActive ? 20 : 2,
    width: 20,
    height: 20,
    borderRadius: 999,
    background: isActive ? 'var(--bwza-teal-ink)' : 'rgba(255,255,255,0.55)',
    transition: 'left var(--bwza-dur) var(--bwza-ease), background var(--bwza-dur) var(--bwza-ease)',
  };
  return (
    <button
      type="button"
      aria-pressed={isActive}
      aria-label={isActive ? 'Aktiv — klicken zum Deaktivieren' : 'Inaktiv — klicken zum Aktivieren'}
      onClick={busy ? undefined : onClick}
      style={style}
    >
      <span style={knob} />
    </button>
  );
}
