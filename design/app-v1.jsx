// Bergwacht Zollernalb — Getränkekasse
// Interactive prototype. State machine + localStorage persistence.

const { useState, useEffect, useMemo, useRef, useCallback } = React;

// ─────────── Mock data ───────────
const PRICE = 1.5;
const PIN_CORRECT = '1234';

const SEED_MEMBERS = [
  { id: 'lukas',   name: 'Lukas Mayer',     short: 'LM', color: '#c97a3a', balance: 12.50 },
  { id: 'anna',    name: 'Anna Schober',    short: 'AS', color: '#7d9b6a', balance: 4.50 },
  { id: 'tobias',  name: 'Tobias Kraus',    short: 'TK', color: '#a85a4a', balance: 21.00 },
  { id: 'marie',   name: 'Marie Fischer',   short: 'MF', color: '#b8924a', balance: 0.00 },
  { id: 'florian', name: 'Florian Bader',   short: 'FB', color: '#6c8ba0', balance: 33.50 },
  { id: 'sabine',  name: 'Sabine Renz',     short: 'SR', color: '#9d6e8a', balance: 8.00 },
  { id: 'jonas',   name: 'Jonas Hartmann',  short: 'JH', color: '#8a7155', balance: 15.50 },
  { id: 'vroni',   name: 'Vroni Lang',      short: 'VL', color: '#a07a4f', balance: 2.00 },
];

const DRINKS = [
  { id: 'pils',   name: 'Pils',          glyph: '🍺', sub: 'vom Fass' },
  { id: 'weizen', name: 'Weizen',        glyph: '🍻', sub: '0,5 l' },
  { id: 'spezi',  name: 'Spezi',         glyph: '🥤', sub: '0,33 l' },
  { id: 'apfel',  name: 'Apfelschorle',  glyph: '🍏', sub: '0,5 l' },
  { id: 'wasser', name: 'Wasser',        glyph: '💧', sub: 'still / med.' },
  { id: 'cola',   name: 'Cola',          glyph: '🥃', sub: '0,33 l' },
  { id: 'kaffee', name: 'Kaffee',        glyph: '☕', sub: 'aus der Maschine' },
  { id: 'limo',   name: 'Limonade',      glyph: '🍋', sub: '0,33 l' },
];

const TOPUPS = [5, 10, 20, 50];

// ─────────── Helpers ───────────
const fmt = (n) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtSigned = (n) => (n >= 0 ? '+ ' : '− ') + fmt(Math.abs(n));
const nowStr = () => {
  const d = new Date();
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};
const todayStr = () => new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

// localStorage helpers
const loadState = () => {
  try {
    const raw = localStorage.getItem('bwza-kasse');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
};
const saveState = (s) => {
  try { localStorage.setItem('bwza-kasse', JSON.stringify(s)); } catch {}
};

// ─────────── Brand mark (original, not Bergwacht official) ───────────
function BergMark({ size = 22, color = '#c97a3a' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M16 3 L29 27 L3 27 Z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9.5 22 L13 16 L16.5 20 L20 14 L24 22 Z" fill={color} fillOpacity="0.35" />
      <path d="M14.5 11 L16 8 L17.5 11 Z" fill={color} />
      <circle cx="16" cy="15.5" r="1.3" fill={color} />
    </svg>
  );
}

// ─────────── Visual primitives ───────────
function Glass({ children, style = {}, tone = 'dark', interactive = false, onClick, ...rest }) {
  const tones = {
    dark: { bg: 'rgba(18,14,10,0.62)', line: 'rgba(255,210,160,0.15)' },
    raise: { bg: 'rgba(40,28,20,0.55)', line: 'rgba(255,210,160,0.20)' },
    amber: { bg: 'rgba(80,48,22,0.55)', line: 'rgba(255,200,140,0.30)' },
  };
  const t = tones[tone] || tones.dark;
  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        background: t.bg,
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        border: `1px solid ${t.line}`,
        boxShadow: 'inset 0 1px 0 rgba(255,225,180,0.08), 0 14px 30px rgba(0,0,0,0.35)',
        cursor: interactive ? 'pointer' : 'default',
        transition: 'transform .15s ease, background .15s ease',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

// Subtle textured top edge for surfaces — fake polished glass shine
const ShineEdge = ({ radius = 28 }) => (
  <div style={{
    position: 'absolute', inset: 0, borderRadius: radius, pointerEvents: 'none',
    background: 'linear-gradient(180deg, rgba(255,225,180,0.10) 0%, transparent 24%)',
  }} />
);

// ─────────── Top bar ───────────
function TopBar({ onLock, member, sub }) {
  return (
    <div style={{
      padding: '54px 18px 12px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      position: 'relative', zIndex: 5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <BergMark size={28} color="#d98a4a" />
        <div style={{ lineHeight: 1.05 }}>
          <div style={{ fontFamily: 'Fraunces', fontSize: 17, fontWeight: 600, color: '#f3e3c8', letterSpacing: 0.2 }}>
            Bergwacht Zollernalb
          </div>
          <div style={{ fontSize: 10.5, color: 'rgba(243,227,200,0.6)', letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: 500 }}>
            {sub || 'Getränkekasse'}
          </div>
        </div>
      </div>
      {member && (
        <button onClick={onLock} style={{
          all: 'unset', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 8px 6px 6px', borderRadius: 999,
          background: 'rgba(20,14,10,0.6)', border: '1px solid rgba(255,210,160,0.18)',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 999, background: member.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 600, fontSize: 11,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 0 0 1px rgba(0,0,0,0.4)',
          }}>{member.short}</div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(243,227,200,0.6)" strokeWidth="2" style={{ marginRight: 4 }}>
            <rect x="5" y="11" width="14" height="9" rx="2"/>
            <path d="M8 11V8a4 4 0 018 0v3"/>
          </svg>
        </button>
      )}
    </div>
  );
}

// ─────────── Bottom nav ───────────
function BottomNav({ active, onChange }) {
  const items = [
    { id: 'home',     label: 'Theke',     icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" width="22" height="22">
        <path d="M4 11l8-6 8 6"/><path d="M6 10v9h12v-9"/><rect x="10" y="13" width="4" height="6"/>
      </svg>
    )},
    { id: 'buchen',   label: 'Buchen',    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" width="22" height="22">
        <path d="M8 3h8l-1 5a4 4 0 11-6 0z"/><path d="M10 13v7M14 13v7M9 20h6"/>
      </svg>
    )},
    { id: 'aufladen', label: 'Aufladen',  icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" width="22" height="22">
        <rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 11h18"/><path d="M12 14v4M10 16h4"/>
      </svg>
    )},
    { id: 'verlauf',  label: 'Verlauf',   icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" width="22" height="22">
        <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
      </svg>
    )},
  ];
  return (
    <div style={{
      position: 'absolute', left: 12, right: 12, bottom: 18,
      borderRadius: 28, padding: 6,
      background: 'rgba(15,11,8,0.72)',
      backdropFilter: 'blur(24px) saturate(160%)',
      WebkitBackdropFilter: 'blur(24px) saturate(160%)',
      border: '1px solid rgba(255,210,160,0.16)',
      boxShadow: '0 18px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,225,180,0.08)',
      display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 2,
      zIndex: 30,
    }}>
      {items.map(it => {
        const on = it.id === active;
        return (
          <button key={it.id} onClick={() => onChange(it.id)} style={{
            all: 'unset', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            padding: '10px 0 9px', borderRadius: 22,
            color: on ? '#f3e3c8' : 'rgba(243,227,200,0.55)',
            background: on ? 'linear-gradient(180deg, rgba(217,138,74,0.28), rgba(217,138,74,0.08))' : 'transparent',
            boxShadow: on ? 'inset 0 1px 0 rgba(255,225,180,0.2), inset 0 0 0 1px rgba(255,200,140,0.25)' : 'none',
            transition: 'all .18s ease',
          }}>
            {it.icon}
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.3 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────── Screens ───────────
function LockScreen({ members, onPick }) {
  return (
    <div style={{ padding: '0 18px 24px', display: 'flex', flexDirection: 'column', gap: 16, minHeight: '100%' }}>
      <div style={{ marginTop: 12, marginBottom: 4 }}>
        <div style={{ fontFamily: 'Fraunces', fontSize: 34, lineHeight: 1, fontWeight: 600, color: '#f3e3c8', letterSpacing: -0.5 }}>
          Servus.
        </div>
        <div style={{ fontFamily: 'Fraunces', fontSize: 34, lineHeight: 1.05, fontStyle: 'italic', fontWeight: 400, color: 'rgba(243,227,200,0.7)', letterSpacing: -0.5 }}>
          Wer trinkt heut' Abend?
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(243,227,200,0.55)', letterSpacing: 0.3 }}>
          {todayStr()} · Hütte am Raichberg
        </div>
      </div>

      <Glass style={{ borderRadius: 22, padding: 6 }} tone="dark">
        <ShineEdge radius={22} />
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6,
        }}>
          {members.map(m => (
            <button key={m.id} onClick={() => onPick(m)} style={{
              all: 'unset', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 11,
              padding: '11px 11px', borderRadius: 16,
              background: 'rgba(255,225,180,0.04)',
              border: '1px solid rgba(255,210,160,0.08)',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 999, background: m.color, flex: '0 0 38px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 600, fontSize: 13,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 0 0 1px rgba(0,0,0,0.4)',
              }}>{m.short}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f3e3c8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.name.split(' ')[0]}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(243,227,200,0.5)', letterSpacing: 0.3 }}>
                  {m.name.split(' ').slice(1).join(' ')}
                </div>
              </div>
            </button>
          ))}
        </div>
      </Glass>

      <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(243,227,200,0.45)', marginTop: 'auto', paddingBottom: 96 }}>
        Nicht in der Liste? <span style={{ color: '#d98a4a', fontWeight: 500 }}>Mitglied hinzufügen</span>
      </div>
    </div>
  );
}

function PinScreen({ member, pin, onPin, onBack, error }) {
  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
  return (
    <div style={{ padding: '0 18px 24px', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <button onClick={onBack} style={{
        all: 'unset', cursor: 'pointer', fontSize: 13, color: 'rgba(243,227,200,0.7)',
        display: 'flex', alignItems: 'center', gap: 6, marginTop: 4,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        Zurück
      </button>

      <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          width: 72, height: 72, borderRadius: 999, background: member.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 600, fontSize: 26, fontFamily: 'Fraunces',
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.3), 0 0 0 1px rgba(0,0,0,0.5), 0 0 40px rgba(217,138,74,0.35)',
        }}>{member.short}</div>
        <div style={{ marginTop: 14, fontFamily: 'Fraunces', fontSize: 22, fontWeight: 600, color: '#f3e3c8' }}>
          {member.name.split(' ')[0]}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(243,227,200,0.55)', marginTop: 2 }}>
          {error ? <span style={{ color: '#e87a5a' }}>Falscher PIN · noch einmal</span> : 'PIN eingeben'}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 22 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width: 14, height: 14, borderRadius: 999,
            background: pin.length > i ? '#d98a4a' : 'transparent',
            border: '1.5px solid rgba(255,210,160,0.35)',
            boxShadow: pin.length > i ? '0 0 12px rgba(217,138,74,0.5)' : 'none',
            transition: 'all .15s ease',
          }} />
        ))}
      </div>

      <div style={{ marginTop: 'auto', paddingBottom: 100 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {keys.map((k, i) => (
            k === '' ? <div key={i} /> :
            <button key={i} onClick={() => onPin(k)} style={{
              all: 'unset', cursor: 'pointer', textAlign: 'center',
              padding: '16px 0', borderRadius: 18,
              fontFamily: 'Fraunces', fontSize: 26, fontWeight: 500, color: '#f3e3c8',
              background: 'rgba(20,14,10,0.55)',
              border: '1px solid rgba(255,210,160,0.12)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              boxShadow: 'inset 0 1px 0 rgba(255,225,180,0.06), 0 6px 14px rgba(0,0,0,0.25)',
            }}>{k}</button>
          ))}
        </div>
        <div style={{ marginTop: 14, textAlign: 'center', fontSize: 11, color: 'rgba(243,227,200,0.4)' }}>
          Demo-PIN: 1234
        </div>
      </div>
    </div>
  );
}

function HomeScreen({ member, todayCount, monthCount, onQuick, onNav }) {
  const low = member.balance < 3;
  return (
    <div style={{ padding: '0 18px 110px' }}>
      <div style={{ marginTop: 6, marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: 'rgba(243,227,200,0.55)', letterSpacing: 0.3 }}>
          {greeting()},
        </div>
        <div style={{ fontFamily: 'Fraunces', fontSize: 30, fontWeight: 600, color: '#f3e3c8', lineHeight: 1.05, letterSpacing: -0.4 }}>
          {member.name.split(' ')[0]}.
        </div>
      </div>

      {/* Balance card */}
      <Glass tone={low ? 'dark' : 'amber'} style={{ borderRadius: 26, padding: '20px 22px 18px', position: 'relative', overflow: 'hidden' }}>
        <ShineEdge radius={26} />
        {/* warm light wash */}
        <div style={{
          position: 'absolute', right: -50, top: -50, width: 180, height: 180, borderRadius: 999,
          background: low ? 'radial-gradient(circle, rgba(232,122,90,0.25), transparent 65%)' : 'radial-gradient(circle, rgba(255,180,90,0.45), transparent 65%)',
          filter: 'blur(8px)', pointerEvents: 'none',
        }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(243,227,200,0.6)', letterSpacing: 1.6, textTransform: 'uppercase', fontWeight: 600 }}>
              Dein Guthaben
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
              <span style={{ fontFamily: 'Fraunces', fontSize: 52, fontWeight: 600, color: '#fef3d8', lineHeight: 1, letterSpacing: -1.5 }}>
                {fmt(member.balance).split(',')[0]}
              </span>
              <span style={{ fontFamily: 'Fraunces', fontSize: 28, fontWeight: 500, color: 'rgba(254,243,216,0.85)', lineHeight: 1 }}>
                ,{fmt(member.balance).split(',')[1]}
              </span>
              <span style={{ fontFamily: 'Fraunces', fontSize: 22, fontWeight: 500, color: 'rgba(254,243,216,0.7)', marginLeft: 4 }}>€</span>
            </div>
          </div>
          <div style={{
            padding: '5px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4,
            background: low ? 'rgba(232,122,90,0.18)' : 'rgba(0,0,0,0.25)',
            color: low ? '#ffb89e' : 'rgba(254,243,216,0.75)',
            border: low ? '1px solid rgba(232,122,90,0.4)' : '1px solid rgba(255,210,160,0.18)',
          }}>
            {low ? 'Niedrig' : 'Aktiv'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 18, position: 'relative' }}>
          <button onClick={() => onNav('aufladen')} style={{
            all: 'unset', cursor: 'pointer', flex: 1, textAlign: 'center',
            padding: '11px 0', borderRadius: 14,
            background: 'linear-gradient(180deg, #f4b56a, #d98a4a)',
            color: '#3a200a', fontWeight: 700, fontSize: 13, letterSpacing: 0.2,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 6px 16px rgba(217,138,74,0.35)',
          }}>Guthaben aufladen</button>
          <button onClick={() => onNav('verlauf')} style={{
            all: 'unset', cursor: 'pointer', flex: 0.7, textAlign: 'center',
            padding: '11px 0', borderRadius: 14,
            background: 'rgba(0,0,0,0.3)', color: '#f3e3c8', fontWeight: 600, fontSize: 13,
            border: '1px solid rgba(255,210,160,0.18)',
          }}>Verlauf</button>
        </div>
      </Glass>

      {/* Stats strip */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Glass style={{ borderRadius: 18, padding: '10px 12px', flex: 1 }}>
          <div style={{ fontSize: 10, color: 'rgba(243,227,200,0.55)', letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 600 }}>Heute</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 3 }}>
            <span style={{ fontFamily: 'Fraunces', fontSize: 22, fontWeight: 600, color: '#f3e3c8' }}>{todayCount}</span>
            <span style={{ fontSize: 11, color: 'rgba(243,227,200,0.5)' }}>{todayCount === 1 ? 'Getränk' : 'Getränke'}</span>
          </div>
        </Glass>
        <Glass style={{ borderRadius: 18, padding: '10px 12px', flex: 1 }}>
          <div style={{ fontSize: 10, color: 'rgba(243,227,200,0.55)', letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 600 }}>Diesen Monat</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 3 }}>
            <span style={{ fontFamily: 'Fraunces', fontSize: 22, fontWeight: 600, color: '#f3e3c8' }}>{monthCount}</span>
            <span style={{ fontSize: 11, color: 'rgba(243,227,200,0.5)' }}>×</span>
          </div>
        </Glass>
        <Glass style={{ borderRadius: 18, padding: '10px 12px', flex: 1 }}>
          <div style={{ fontSize: 10, color: 'rgba(243,227,200,0.55)', letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 600 }}>Pro Stk.</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 3 }}>
            <span style={{ fontFamily: 'Fraunces', fontSize: 22, fontWeight: 600, color: '#f3e3c8' }}>1,50</span>
            <span style={{ fontSize: 11, color: 'rgba(243,227,200,0.5)' }}>€</span>
          </div>
        </Glass>
      </div>

      {/* Quick book section */}
      <div style={{ marginTop: 22, marginBottom: 10, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: 'Fraunces', fontSize: 18, fontWeight: 600, color: '#f3e3c8' }}>
          Was darf's sein?
        </div>
        <button onClick={() => onNav('buchen')} style={{
          all: 'unset', cursor: 'pointer', fontSize: 12, color: '#d98a4a', fontWeight: 600,
        }}>alle anzeigen ›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        {DRINKS.slice(0, 6).map(d => (
          <DrinkTile key={d.id} drink={d} disabled={member.balance < PRICE} onTap={() => onQuick(d)} />
        ))}
      </div>

      {member.balance < PRICE && (
        <div style={{
          marginTop: 14, padding: '11px 14px', borderRadius: 14,
          background: 'rgba(232,122,90,0.12)', border: '1px solid rgba(232,122,90,0.3)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ fontSize: 18 }}>⛰️</div>
          <div style={{ fontSize: 12, color: '#ffd2bf', lineHeight: 1.35 }}>
            Dein Guthaben reicht grad nicht für eine Runde — <strong style={{ color: '#fff' }}>kurz aufladen</strong>, dann geht's weiter.
          </div>
        </div>
      )}
    </div>
  );
}

function DrinkTile({ drink, disabled, onTap }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      disabled={disabled}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={onTap}
      style={{
        all: 'unset', cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative', overflow: 'hidden',
        padding: '14px 8px 12px', borderRadius: 18,
        background: 'rgba(20,14,10,0.55)',
        border: '1px solid rgba(255,210,160,0.12)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: 'inset 0 1px 0 rgba(255,225,180,0.07), 0 8px 18px rgba(0,0,0,0.3)',
        textAlign: 'center',
        opacity: disabled ? 0.45 : 1,
        transform: pressed ? 'scale(0.96)' : 'scale(1)',
        transition: 'transform .12s ease, background .15s ease',
      }}
    >
      <div style={{ fontSize: 28, lineHeight: 1, filter: 'saturate(1.1)' }}>{drink.glyph}</div>
      <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 600, color: '#f3e3c8', letterSpacing: 0.1 }}>{drink.name}</div>
      <div style={{ fontSize: 9.5, color: 'rgba(243,227,200,0.5)', marginTop: 1 }}>1,50 €</div>
    </button>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Guten Morgen';
  if (h < 17) return 'Servus';
  if (h < 22) return 'Schönen Abend';
  return 'Späte Stunde';
}

function BuchenScreen({ member, onTap }) {
  return (
    <div style={{ padding: '0 18px 110px' }}>
      <div style={{ marginTop: 6, marginBottom: 14 }}>
        <div style={{ fontFamily: 'Fraunces', fontSize: 28, fontWeight: 600, color: '#f3e3c8', lineHeight: 1.05, letterSpacing: -0.4 }}>
          An der Theke.
        </div>
        <div style={{ fontSize: 12, color: 'rgba(243,227,200,0.55)', marginTop: 4 }}>
          Tippe dein Getränk — wird sofort von deinem Guthaben abgezogen.
        </div>
      </div>

      <Glass tone="raise" style={{ borderRadius: 18, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: 'rgba(243,227,200,0.6)', letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 600 }}>
          Guthaben
        </div>
        <div style={{ fontFamily: 'Fraunces', fontSize: 20, fontWeight: 600, color: '#f3e3c8' }}>
          {fmt(member.balance)} €
        </div>
      </Glass>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
        {DRINKS.map(d => (
          <button key={d.id} disabled={member.balance < PRICE} onClick={() => onTap(d)} style={{
            all: 'unset', cursor: member.balance < PRICE ? 'not-allowed' : 'pointer',
            position: 'relative', overflow: 'hidden',
            padding: '16px 14px 14px', borderRadius: 20,
            background: 'rgba(20,14,10,0.6)',
            border: '1px solid rgba(255,210,160,0.14)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: 'inset 0 1px 0 rgba(255,225,180,0.07), 0 10px 22px rgba(0,0,0,0.35)',
            opacity: member.balance < PRICE ? 0.4 : 1,
            transition: 'transform .12s ease',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: 32, lineHeight: 1 }}>{d.glyph}</div>
              <div style={{
                padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
                background: 'rgba(217,138,74,0.18)', color: '#f4b56a',
                border: '1px solid rgba(217,138,74,0.3)',
              }}>1,50 €</div>
            </div>
            <div style={{ marginTop: 12, fontFamily: 'Fraunces', fontSize: 17, fontWeight: 600, color: '#f3e3c8' }}>{d.name}</div>
            <div style={{ fontSize: 11, color: 'rgba(243,227,200,0.5)', marginTop: 2 }}>{d.sub}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function AufladenScreen({ member, onTopUp }) {
  const [amount, setAmount] = useState(10);
  return (
    <div style={{ padding: '0 18px 110px' }}>
      <div style={{ marginTop: 6, marginBottom: 14 }}>
        <div style={{ fontFamily: 'Fraunces', fontSize: 28, fontWeight: 600, color: '#f3e3c8', lineHeight: 1.05, letterSpacing: -0.4 }}>
          Aufladen.
        </div>
        <div style={{ fontSize: 12, color: 'rgba(243,227,200,0.55)', marginTop: 4 }}>
          Bar bei der Hüttenwartin · Überweisung auf das Kassenkonto.
        </div>
      </div>

      <Glass tone="amber" style={{ borderRadius: 24, padding: '18px 20px', position: 'relative', overflow: 'hidden', marginBottom: 16 }}>
        <ShineEdge radius={24} />
        <div style={{ fontSize: 10.5, color: 'rgba(243,227,200,0.7)', letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: 600 }}>
          Aktuell · {fmt(member.balance)} €
        </div>
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontFamily: 'Fraunces', fontSize: 18, color: 'rgba(254,243,216,0.75)' }}>Nach Aufladen</span>
          <span style={{ fontFamily: 'Fraunces', fontSize: 36, fontWeight: 600, color: '#fef3d8', letterSpacing: -0.8 }}>
            {fmt(member.balance + amount)} €
          </span>
        </div>
      </Glass>

      <div style={{ fontSize: 12, color: 'rgba(243,227,200,0.6)', marginBottom: 10, letterSpacing: 0.3, textTransform: 'uppercase', fontWeight: 600 }}>
        Betrag wählen
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
        {TOPUPS.map(a => {
          const on = a === amount;
          return (
            <button key={a} onClick={() => setAmount(a)} style={{
              all: 'unset', cursor: 'pointer', textAlign: 'center',
              padding: '18px 0', borderRadius: 18, position: 'relative', overflow: 'hidden',
              background: on
                ? 'linear-gradient(180deg, rgba(217,138,74,0.4), rgba(217,138,74,0.12))'
                : 'rgba(20,14,10,0.55)',
              border: on ? '1px solid rgba(244,181,106,0.55)' : '1px solid rgba(255,210,160,0.12)',
              boxShadow: on
                ? 'inset 0 1px 0 rgba(255,225,180,0.25), 0 0 30px rgba(217,138,74,0.25)'
                : 'inset 0 1px 0 rgba(255,225,180,0.06)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              transition: 'all .15s ease',
            }}>
              <span style={{ fontFamily: 'Fraunces', fontSize: 30, fontWeight: 600, color: on ? '#fef3d8' : '#f3e3c8' }}>{a}</span>
              <span style={{ fontFamily: 'Fraunces', fontSize: 16, color: 'rgba(243,227,200,0.6)', marginLeft: 2 }}>€</span>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, color: 'rgba(243,227,200,0.5)', textAlign: 'center', marginBottom: 10 }}>
          Mit Bestätigen wird der Betrag auf dein Konto gebucht.
        </div>
        <button onClick={() => onTopUp(amount)} style={{
          all: 'unset', cursor: 'pointer', display: 'block', textAlign: 'center', width: '100%', boxSizing: 'border-box',
          padding: '15px 0', borderRadius: 16,
          background: 'linear-gradient(180deg, #f4b56a, #d98a4a)',
          color: '#3a200a', fontWeight: 700, fontSize: 15, letterSpacing: 0.3,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 8px 24px rgba(217,138,74,0.4)',
        }}>
          {fmt(amount)} € aufladen
        </button>
      </div>

      <Glass style={{ borderRadius: 16, padding: '12px 14px', marginTop: 16 }}>
        <div style={{ fontSize: 10.5, color: 'rgba(243,227,200,0.5)', letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>
          Bankverbindung Kassenkonto
        </div>
        <div style={{ fontSize: 12, color: '#f3e3c8', fontFamily: 'JetBrains Mono', lineHeight: 1.6 }}>
          DE12 6535 1050 0000 1234 56<br />
          <span style={{ color: 'rgba(243,227,200,0.6)' }}>Verwendungszweck:</span> {member.name}
        </div>
      </Glass>
    </div>
  );
}

function VerlaufScreen({ member, history }) {
  const myHistory = history.filter(h => h.memberId === member.id).slice(0, 40);
  return (
    <div style={{ padding: '0 18px 110px' }}>
      <div style={{ marginTop: 6, marginBottom: 14 }}>
        <div style={{ fontFamily: 'Fraunces', fontSize: 28, fontWeight: 600, color: '#f3e3c8', lineHeight: 1.05, letterSpacing: -0.4 }}>
          Verlauf.
        </div>
        <div style={{ fontSize: 12, color: 'rgba(243,227,200,0.55)', marginTop: 4 }}>
          Alle Buchungen auf deinem Konto.
        </div>
      </div>

      {myHistory.length === 0 ? (
        <Glass style={{ borderRadius: 20, padding: '30px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, opacity: 0.5 }}>🪵</div>
          <div style={{ marginTop: 8, fontFamily: 'Fraunces', fontSize: 16, color: '#f3e3c8' }}>Noch nichts gebucht.</div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(243,227,200,0.55)' }}>Wenn du was trinkst, taucht's hier auf.</div>
        </Glass>
      ) : (
        <Glass style={{ borderRadius: 22, padding: 6, overflow: 'hidden' }}>
          {myHistory.map((h, i) => (
            <div key={h.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 12px',
              borderBottom: i < myHistory.length - 1 ? '1px solid rgba(255,210,160,0.08)' : 'none',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 12, flex: '0 0 36px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: h.type === 'topup' ? 'rgba(120,160,90,0.18)' : 'rgba(217,138,74,0.16)',
                border: h.type === 'topup' ? '1px solid rgba(120,160,90,0.35)' : '1px solid rgba(217,138,74,0.3)',
                fontSize: 18,
              }}>
                {h.type === 'topup' ? '＋' : h.glyph}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f3e3c8' }}>{h.label}</div>
                <div style={{ fontSize: 10.5, color: 'rgba(243,227,200,0.5)' }}>{h.when}</div>
              </div>
              <div style={{
                fontFamily: 'Fraunces', fontSize: 15, fontWeight: 600,
                color: h.amount > 0 ? '#a8c98a' : '#f3e3c8',
              }}>
                {fmtSigned(h.amount)} €
              </div>
            </div>
          ))}
        </Glass>
      )}
    </div>
  );
}

// ─────────── Drink confirm overlay ───────────
function DrinkConfirm({ drink, member, onConfirm, onCancel }) {
  const [closing, setClosing] = useState(false);
  const close = (fn) => { setClosing(true); setTimeout(fn, 180); };
  const after = member.balance - PRICE;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 80,
      background: 'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-end',
      animation: 'fadein .2s ease',
      opacity: closing ? 0 : 1, transition: 'opacity .18s ease',
    }} onClick={() => close(onCancel)}>
      <div onClick={(e) => e.stopPropagation()} style={{
        margin: 12, marginBottom: 14, width: 'calc(100% - 24px)',
        borderRadius: 28, padding: '22px 22px 18px',
        background: 'linear-gradient(180deg, rgba(50,32,20,0.92), rgba(25,18,12,0.96))',
        border: '1px solid rgba(255,210,160,0.2)',
        backdropFilter: 'blur(30px) saturate(160%)',
        WebkitBackdropFilter: 'blur(30px) saturate(160%)',
        boxShadow: 'inset 0 1px 0 rgba(255,225,180,0.15), 0 -20px 60px rgba(0,0,0,0.5)',
        transform: closing ? 'translateY(20px)' : 'translateY(0)',
        transition: 'transform .18s ease',
      }}>
        <div style={{ width: 36, height: 4, background: 'rgba(255,225,180,0.3)', borderRadius: 999, margin: '0 auto 14px' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 52, lineHeight: 1 }}>{drink.glyph}</div>
          <div style={{ marginTop: 6, fontFamily: 'Fraunces', fontSize: 24, fontWeight: 600, color: '#fef3d8' }}>
            {drink.name}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(243,227,200,0.6)' }}>{drink.sub}</div>

          <div style={{
            margin: '18px auto 14px', padding: '12px 18px',
            display: 'inline-flex', alignItems: 'baseline', gap: 4,
            background: 'rgba(0,0,0,0.4)', borderRadius: 14,
            border: '1px solid rgba(255,210,160,0.15)',
          }}>
            <span style={{ fontFamily: 'Fraunces', fontSize: 30, fontWeight: 600, color: '#fef3d8' }}>1,50</span>
            <span style={{ fontFamily: 'Fraunces', fontSize: 18, color: 'rgba(243,227,200,0.7)' }}>€</span>
          </div>

          <div style={{ fontSize: 11.5, color: 'rgba(243,227,200,0.6)', marginBottom: 14 }}>
            Guthaben danach: <strong style={{ color: '#f3e3c8' }}>{fmt(after)} €</strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => close(onCancel)} style={{
            all: 'unset', cursor: 'pointer', flex: 1, textAlign: 'center',
            padding: '14px 0', borderRadius: 14,
            background: 'rgba(0,0,0,0.35)', color: '#f3e3c8', fontWeight: 600, fontSize: 14,
            border: '1px solid rgba(255,210,160,0.15)',
          }}>Abbrechen</button>
          <button onClick={() => close(onConfirm)} style={{
            all: 'unset', cursor: 'pointer', flex: 1.4, textAlign: 'center',
            padding: '14px 0', borderRadius: 14,
            background: 'linear-gradient(180deg, #f4b56a, #d98a4a)',
            color: '#3a200a', fontWeight: 700, fontSize: 14, letterSpacing: 0.3,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 8px 18px rgba(217,138,74,0.4)',
          }}>Anschreiben lassen</button>
        </div>
      </div>
    </div>
  );
}

// ─────────── Flash toast ───────────
function Flash({ flash }) {
  if (!flash) return null;
  return (
    <div style={{
      position: 'absolute', top: 100, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 90,
      pointerEvents: 'none',
    }}>
      <div style={{
        padding: '12px 18px', borderRadius: 16,
        background: 'rgba(15,11,8,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,210,160,0.25)',
        boxShadow: '0 14px 40px rgba(0,0,0,0.5), 0 0 30px rgba(217,138,74,0.2)',
        animation: 'flashIn .25s ease',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 20 }}>{flash.glyph || '✓'}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f3e3c8' }}>{flash.title}</div>
          {flash.sub && <div style={{ fontSize: 11, color: 'rgba(243,227,200,0.6)' }}>{flash.sub}</div>}
        </div>
      </div>
    </div>
  );
}

// ─────────── App root ───────────
function App() {
  const t = window.useTweaks ? window.useTweaks(/*EDITMODE-BEGIN*/{
    "accent": "amber",
    "ambience": "evening",
    "drinkLayout": "tiles"
  }/*EDITMODE-END*/) : { t: {}, setTweak: () => {} };
  const tweaks = t.t || {};
  const setTweak = t.setTweak || (() => {});

  // Hydrate state
  const [members, setMembers] = useState(() => {
    const s = loadState();
    return s?.members || SEED_MEMBERS;
  });
  const [history, setHistory] = useState(() => {
    const s = loadState();
    return s?.history || seedHistory();
  });

  const [screen, setScreen] = useState('lock'); // lock | pin | home | buchen | aufladen | verlauf
  const [selectedId, setSelectedId] = useState(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pendingDrink, setPendingDrink] = useState(null);
  const [flash, setFlash] = useState(null);

  // Persist
  useEffect(() => { saveState({ members, history }); }, [members, history]);

  // Flash timer
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 2200);
    return () => clearTimeout(id);
  }, [flash]);

  const member = members.find(m => m.id === selectedId);

  const todayCount = useMemo(() => {
    if (!member) return 0;
    const today = new Date(); today.setHours(0,0,0,0);
    return history.filter(h => h.memberId === member.id && h.type === 'drink' && new Date(h.ts) >= today).length;
  }, [history, member]);
  const monthCount = useMemo(() => {
    if (!member) return 0;
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    return history.filter(h => h.memberId === member.id && h.type === 'drink' && new Date(h.ts) >= monthStart).length;
  }, [history, member]);

  const lock = () => { setSelectedId(null); setPin(''); setPinError(false); setScreen('lock'); };
  const pickMember = (m) => { setSelectedId(m.id); setPin(''); setPinError(false); setScreen('pin'); };
  const onPin = (k) => {
    if (k === '⌫') { setPin(p => p.slice(0,-1)); setPinError(false); return; }
    setPin(p => {
      const next = (p + k).slice(0,4);
      if (next.length === 4) {
        if (next === PIN_CORRECT) {
          setTimeout(() => { setScreen('home'); setPin(''); }, 150);
        } else {
          setTimeout(() => { setPinError(true); setPin(''); }, 200);
        }
      }
      return next;
    });
  };

  const bookDrink = (drink) => {
    if (!member || member.balance < PRICE) return;
    setMembers(ms => ms.map(m => m.id === member.id ? { ...m, balance: +(m.balance - PRICE).toFixed(2) } : m));
    setHistory(h => [{
      id: 't_' + Date.now() + Math.random().toString(36).slice(2,6),
      memberId: member.id, type: 'drink', glyph: drink.glyph, label: drink.name,
      amount: -PRICE, when: nowStr(), ts: Date.now(),
    }, ...h]);
    setFlash({ title: drink.name + ' angeschrieben', sub: 'Wohl bekomm\'s.', glyph: drink.glyph });
  };

  const topUp = (amount) => {
    if (!member) return;
    setMembers(ms => ms.map(m => m.id === member.id ? { ...m, balance: +(m.balance + amount).toFixed(2) } : m));
    setHistory(h => [{
      id: 't_' + Date.now() + Math.random().toString(36).slice(2,6),
      memberId: member.id, type: 'topup', label: 'Aufladung', amount: +amount,
      when: nowStr(), ts: Date.now(),
    }, ...h]);
    setFlash({ title: fmt(amount) + ' € aufgeladen', sub: 'Neues Guthaben: ' + fmt(member.balance + amount) + ' €', glyph: '＋' });
    setScreen('home');
  };

  const showNav = ['home', 'buchen', 'aufladen', 'verlauf'].includes(screen);
  const TweaksPanel = window.TweaksPanel;

  return (
    <>
      <IOSDevice width={390} height={844} dark={true}>
        <div style={{
          height: '100%', width: '100%',
          background: 'url(assets/bar-bg.png) center / cover no-repeat, #0c0a08',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* warm/dark wash over the bar photo */}
          <div style={{
            position: 'absolute', inset: 0,
            background: tweaks.ambience === 'morning'
              ? 'linear-gradient(180deg, rgba(20,16,12,0.55) 0%, rgba(20,16,12,0.35) 50%, rgba(45,30,20,0.4) 100%)'
              : 'linear-gradient(180deg, rgba(15,11,8,0.85) 0%, rgba(15,11,8,0.55) 30%, rgba(35,22,15,0.6) 70%, rgba(50,30,18,0.55) 100%)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(120% 60% at 50% 100%, transparent 30%, rgba(0,0,0,0.55) 90%)',
            pointerEvents: 'none',
          }} />
          {/* amber lamp glow top-left, mimicking bar lamp */}
          <div style={{
            position: 'absolute', top: -30, left: -40, width: 220, height: 220, borderRadius: 999,
            background: 'radial-gradient(circle, rgba(255,180,90,0.28), transparent 60%)',
            pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <TopBar member={member} onLock={lock} sub={screenSub(screen)} />

            <div className="screen-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
              {screen === 'lock'    && <LockScreen members={members} onPick={pickMember} />}
              {screen === 'pin' && member && <PinScreen member={member} pin={pin} error={pinError} onPin={onPin} onBack={lock} />}
              {screen === 'home' && member && <HomeScreen member={member} todayCount={todayCount} monthCount={monthCount} onQuick={setPendingDrink} onNav={setScreen} />}
              {screen === 'buchen' && member && <BuchenScreen member={member} onTap={setPendingDrink} />}
              {screen === 'aufladen' && member && <AufladenScreen member={member} onTopUp={topUp} />}
              {screen === 'verlauf' && member && <VerlaufScreen member={member} history={history} />}
            </div>

            {showNav && <BottomNav active={screen} onChange={setScreen} />}
          </div>

          <Flash flash={flash} />

          {pendingDrink && member && (
            <DrinkConfirm
              drink={pendingDrink}
              member={member}
              onConfirm={() => { bookDrink(pendingDrink); setPendingDrink(null); }}
              onCancel={() => setPendingDrink(null)}
            />
          )}
        </div>
      </IOSDevice>

      {TweaksPanel && (
        <TweaksPanel title="Tweaks">
          <window.TweakSection label="Stimmung">
            <window.TweakRadio
              label="Lichtstimmung"
              value={tweaks.ambience}
              options={['evening', 'morning']}
              onChange={(v) => setTweak('ambience', v)}
            />
          </window.TweakSection>
          <window.TweakSection label="Daten" />
          <window.TweakButton
            label="Demo-Daten zurücksetzen"
            onClick={() => {
              if (confirm('Alle Konten und Verlauf zurücksetzen?')) {
                localStorage.removeItem('bwza-kasse');
                setMembers(SEED_MEMBERS);
                setHistory(seedHistory());
                lock();
              }
            }}
          />
        </TweaksPanel>
      )}

      <style>{`
        @keyframes flashIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadein {
          from { opacity: 0; } to { opacity: 1; }
        }
      `}</style>
    </>
  );
}

function screenSub(s) {
  return {
    lock: 'Anmelden',
    pin: 'PIN',
    home: 'Theke',
    buchen: 'Buchen',
    aufladen: 'Aufladen',
    verlauf: 'Verlauf',
  }[s] || 'Getränkekasse';
}

function seedHistory() {
  const now = Date.now();
  const mk = (memberId, type, label, amount, glyph, hoursAgo) => ({
    id: 't_' + Math.random().toString(36).slice(2,9),
    memberId, type, label, amount, glyph,
    when: new Date(now - hoursAgo * 3600 * 1000).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
    ts: now - hoursAgo * 3600 * 1000,
  });
  return [
    mk('lukas','drink','Pils',-1.5,'🍺', 2),
    mk('lukas','drink','Spezi',-1.5,'🥤', 4),
    mk('lukas','topup','Aufladung',10,null, 26),
    mk('lukas','drink','Weizen',-1.5,'🍻', 50),
    mk('lukas','drink','Pils',-1.5,'🍺', 74),
    mk('lukas','drink','Apfelschorle',-1.5,'🍏', 98),
    mk('lukas','topup','Aufladung',20,null, 200),
    mk('anna','drink','Kaffee',-1.5,'☕', 5),
    mk('anna','drink','Wasser',-1.5,'💧', 30),
    mk('florian','topup','Aufladung',50,null, 120),
    mk('florian','drink','Pils',-1.5,'🍺', 6),
    mk('florian','drink','Pils',-1.5,'🍺', 7),
    mk('florian','drink','Pils',-1.5,'🍺', 8),
  ];
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
