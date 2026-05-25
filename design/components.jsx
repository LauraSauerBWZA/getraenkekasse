// components.jsx — Bergwacht Zollernalb Getränkekasse shared primitives
// All visual primitives + reusable interactions. Pure presentational.

const { useState: useStateC, useEffect: useEffectC, useRef: useRefC } = React;

// ─────────── Shared data ───────────
const PRICE = 1.5;

const DRINKS_DATA = [
  { id: 'pils',   name: 'Pils',          glyph: '🍺', sub: 'vom Fass' },
  { id: 'weizen', name: 'Weizen',        glyph: '🍻', sub: '0,5 l' },
  { id: 'spezi',  name: 'Spezi',         glyph: '🥤', sub: '0,33 l' },
  { id: 'apfel',  name: 'Apfelschorle',  glyph: '🍏', sub: '0,5 l' },
  { id: 'wasser', name: 'Wasser',        glyph: '💧', sub: 'still / med.' },
  { id: 'cola',   name: 'Cola',          glyph: '🥃', sub: '0,33 l' },
  { id: 'kaffee', name: 'Kaffee',        glyph: '☕', sub: 'aus der Maschine' },
  { id: 'limo',   name: 'Limonade',      glyph: '🍋', sub: '0,33 l' },
];

const ME = { id: 'lukas', name: 'Lukas Mayer', short: 'LM', color: '#c97a3a', email: 'lukas.mayer@bergwacht-zollernalb.de', balance: 12.50, isAdmin: true };
const ME_NEG = { ...ME, balance: -2.50 };

// Sample other members for admin views
const ALL_MEMBERS = [
  { id: 'lukas',   name: 'Lukas Mayer',     short: 'LM', color: '#c97a3a', balance: 12.50,  email: 'lukas.mayer@bw-za.de' },
  { id: 'anna',    name: 'Anna Schober',    short: 'AS', color: '#7d9b6a', balance: 4.50,   email: 'a.schober@bw-za.de' },
  { id: 'tobias',  name: 'Tobias Kraus',    short: 'TK', color: '#a85a4a', balance: 21.00,  email: 't.kraus@bw-za.de' },
  { id: 'marie',   name: 'Marie Fischer',   short: 'MF', color: '#b8924a', balance: -3.00,  email: 'm.fischer@bw-za.de' },
  { id: 'florian', name: 'Florian Bader',   short: 'FB', color: '#6c8ba0', balance: 33.50,  email: 'f.bader@bw-za.de' },
  { id: 'sabine',  name: 'Sabine Renz',     short: 'SR', color: '#9d6e8a', balance: 8.00,   email: 's.renz@bw-za.de' },
  { id: 'jonas',   name: 'Jonas Hartmann',  short: 'JH', color: '#8a7155', balance: 15.50,  email: 'j.hartmann@bw-za.de' },
  { id: 'vroni',   name: 'Vroni Lang',      short: 'VL', color: '#a07a4f', balance: -1.50,  email: 'v.lang@bw-za.de' },
  { id: 'peter',   name: 'Peter Bühler',    short: 'PB', color: '#5e7a8e', balance: 27.00,  email: 'p.buehler@bw-za.de' },
  { id: 'karin',   name: 'Karin Schmid',    short: 'KS', color: '#8e6a9a', balance: 6.50,   email: 'k.schmid@bw-za.de' },
];

// ─────────── Helpers ───────────
const fmt = (n) => Math.abs(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtSigned = (n) => (n > 0 ? '+ ' : n < 0 ? '− ' : '') + fmt(n);
const fmtBal = (n) => (n < 0 ? '− ' : '') + fmt(n);
const greeting = () => {
  const h = new Date().getHours();
  if (h < 11) return 'Guten Morgen';
  if (h < 17) return 'Servus';
  if (h < 22) return 'Schönen Abend';
  return 'Späte Stunde';
};
const todayStr = () => new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

// ─────────── BergMark (logo) ───────────
function BergMark({ size = 22, color = '#d98a4a' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M16 3 L29 27 L3 27 Z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9.5 22 L13 16 L16.5 20 L20 14 L24 22 Z" fill={color} fillOpacity="0.35" />
      <path d="M14.5 11 L16 8 L17.5 11 Z" fill={color} />
      <circle cx="16" cy="15.5" r="1.3" fill={color} />
    </svg>
  );
}

// ─────────── Glass surface ───────────
function Glass({ children, style = {}, tone = 'dark', onClick, ...rest }) {
  const tones = {
    dark:  { bg: 'var(--bwza-glass)',       line: 'var(--bwza-glass-line)' },
    raise: { bg: 'var(--bwza-glass-raise)', line: 'var(--bwza-glass-line-up)' },
    amber: { bg: 'var(--bwza-glass-amber)', line: 'rgba(255,200,140,0.30)' },
  };
  const t = tones[tone] || tones.dark;
  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        background: t.bg,
        backdropFilter: 'var(--bwza-blur-glass)',
        WebkitBackdropFilter: 'var(--bwza-blur-glass)',
        border: `1px solid ${t.line}`,
        boxShadow: 'var(--bwza-shadow-card)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

// Subtle "polished glass" shine at top edge of cards
function ShineEdge({ radius = 28 }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, borderRadius: radius, pointerEvents: 'none',
      background: 'linear-gradient(180deg, rgba(255,225,180,0.10) 0%, transparent 24%)',
    }} />
  );
}

// ─────────── Avatar ───────────
function Avatar({ member, size = 38 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 999, background: member.color, flex: `0 0 ${size}px`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontWeight: 600, fontSize: Math.round(size * 0.36),
      fontFamily: 'var(--bwza-font-ui)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 0 0 1px rgba(0,0,0,0.4)',
    }}>{member.short}</div>
  );
}

// ─────────── Buttons ───────────
function GlassButton({ children, variant = 'primary', onClick, disabled, full, size = 'md', style = {}, icon }) {
  const sizes = {
    sm: { pad: '10px 14px', font: 13, radius: 12 },
    md: { pad: '14px 18px', font: 14, radius: 14 },
    lg: { pad: '16px 20px', font: 15, radius: 16 },
  };
  const sz = sizes[size];
  const variants = {
    primary: {
      background: 'linear-gradient(180deg, #f4b56a, #d98a4a)',
      color: '#3a200a', fontWeight: 700, letterSpacing: 0.3,
      boxShadow: 'var(--bwza-shadow-amber)',
      border: 'none',
    },
    danger: {
      background: 'linear-gradient(180deg, oklch(70% 0.18 25), oklch(55% 0.18 25))',
      color: '#fef3d8', fontWeight: 700, letterSpacing: 0.3,
      boxShadow: 'var(--bwza-shadow-rescue)',
      border: 'none',
    },
    ghost: {
      background: 'rgba(0,0,0,0.30)', color: 'var(--bwza-ink)', fontWeight: 600,
      border: '1px solid var(--bwza-glass-line)',
    },
    quiet: {
      background: 'transparent', color: 'var(--bwza-ink-dim)', fontWeight: 600,
      border: '1px solid transparent',
    },
  };
  const v = variants[variant] || variants.primary;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      all: 'unset', cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: sz.pad, borderRadius: sz.radius, fontSize: sz.font,
      width: full ? '100%' : undefined,
      boxSizing: 'border-box', textAlign: 'center',
      opacity: disabled ? 0.45 : 1,
      transition: 'transform var(--bwza-dur-fast) var(--bwza-ease)',
      fontFamily: 'var(--bwza-font-ui)',
      ...v,
      ...style,
    }}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

// ─────────── Inputs ───────────
function GlassInput({ label, type = 'text', value, onChange, placeholder, suffix, error, autoFocus, hint }) {
  const [focus, setFocus] = useStateC(false);
  return (
    <label style={{ display: 'block' }}>
      {label && (
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: 0.3,
          color: error ? 'var(--bwza-rescue-soft)' : 'var(--bwza-ink-dim)',
          marginBottom: 6, paddingLeft: 2,
        }}>{label}</div>
      )}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 14px', borderRadius: 14,
        background: 'rgba(15,11,8,0.55)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid ' + (error ? 'rgba(216,90,70,0.5)' : focus ? 'rgba(244,181,106,0.45)' : 'var(--bwza-glass-line)'),
        boxShadow: focus ? '0 0 0 4px rgba(217,138,74,0.12), inset 0 1px 0 rgba(255,225,180,0.07)' : 'inset 0 1px 0 rgba(255,225,180,0.06)',
        transition: 'border-color var(--bwza-dur) var(--bwza-ease), box-shadow var(--bwza-dur) var(--bwza-ease)',
      }}>
        <input
          type={type} value={value} onChange={onChange} placeholder={placeholder} autoFocus={autoFocus}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{
            all: 'unset', flex: 1, minWidth: 0,
            color: 'var(--bwza-ink)', fontFamily: 'var(--bwza-font-ui)',
            fontSize: 15, fontWeight: 500,
          }}
        />
        {suffix}
      </div>
      {(hint || error) && (
        <div style={{
          fontSize: 11, marginTop: 6, paddingLeft: 2,
          color: error ? 'var(--bwza-rescue-soft)' : 'var(--bwza-ink-mute)',
        }}>{error || hint}</div>
      )}
    </label>
  );
}

function PasswordInput({ label, value, onChange, autoFocus, hint, error }) {
  const [show, setShow] = useStateC(false);
  return (
    <GlassInput
      label={label}
      type={show ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      autoFocus={autoFocus}
      hint={hint}
      error={error}
      suffix={
        <button onClick={(e) => { e.preventDefault(); setShow(s => !s); }} style={{
          all: 'unset', cursor: 'pointer', padding: 4,
          color: 'var(--bwza-ink-mute)',
        }}>
          {show ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M3 3l18 18"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
          )}
        </button>
      }
    />
  );
}

// ─────────── Top bar ───────────
function TopBar({ member, sub, onAvatar, onBack, admin, leading }) {
  return (
    <div style={{
      padding: '54px var(--bwza-page-x) 12px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      position: 'relative', zIndex: 5,
    }}>
      {leading ? leading : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onBack ? (
            <button onClick={onBack} style={{
              all: 'unset', cursor: 'pointer', padding: 6, marginLeft: -6,
              borderRadius: 999, color: 'var(--bwza-ink)',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
          ) : (
            <BergMark size={28} color="#d98a4a" />
          )}
          <div style={{ lineHeight: 1.05 }}>
            <div style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 17, fontWeight: 600, color: 'var(--bwza-ink)', letterSpacing: 0.2 }}>
              {admin ? 'Admin · BWZA' : 'Bergwacht Zollernalb'}
            </div>
            <div className="bwza-eyebrow">{sub || 'Getränkekasse'}</div>
          </div>
        </div>
      )}
      {member && (
        <button onClick={onAvatar} style={{
          all: 'unset', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 6px 4px 4px', borderRadius: 999,
          background: 'rgba(20,14,10,0.55)', border: '1px solid var(--bwza-glass-line)',
        }}>
          <Avatar member={member} size={30} />
        </button>
      )}
    </div>
  );
}

// ─────────── Admin banner ───────────
function AdminBanner() {
  return (
    <div style={{
      margin: '0 var(--bwza-page-x) 12px',
      padding: '7px 12px', borderRadius: 999,
      background: 'rgba(216,90,70,0.12)',
      border: '1px solid rgba(216,90,70,0.35)',
      display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 11, color: '#ffb89e', fontWeight: 600, letterSpacing: 0.3,
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>
      </svg>
      Admin-Bereich · Getränkeverwaltung
    </div>
  );
}

// ─────────── Bottom nav ───────────
function BottomNav({ active, onChange, mode = 'user' }) {
  const userItems = [
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
    { id: 'statistik', label: 'Statistik', icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" width="22" height="22">
        <path d="M4 19V5M4 19h16"/><rect x="7" y="13" width="3" height="6"/><rect x="12" y="9" width="3" height="10"/><rect x="17" y="6" width="3" height="13"/>
      </svg>
    )},
  ];
  const adminItems = [
    { id: 'a-members', label: 'Mitglieder', icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" width="22" height="22">
        <circle cx="9" cy="9" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="8" r="2.5"/><path d="M15 14h.5c2.5 0 5 1.5 5 5"/>
      </svg>
    )},
    { id: 'a-requests', label: 'Anfragen', icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" width="22" height="22">
        <rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M8 14h4"/>
      </svg>
    )},
    { id: 'a-log', label: 'Log', icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" width="22" height="22">
        <path d="M5 4h11l4 4v12a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z"/><path d="M16 4v4h4M8 13h8M8 17h8M8 9h3"/>
      </svg>
    )},
    { id: 'home', label: 'Zurück', icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" width="22" height="22">
        <path d="M4 11l8-6 8 6"/><path d="M6 10v9h12v-9"/>
      </svg>
    )},
  ];
  const items = mode === 'admin' ? adminItems : userItems;
  return (
    <div style={{
      position: 'absolute', left: 12, right: 12, bottom: 18,
      borderRadius: 28, padding: 6,
      background: 'rgba(15,11,8,0.72)',
      backdropFilter: 'var(--bwza-blur-nav)',
      WebkitBackdropFilter: 'var(--bwza-blur-nav)',
      border: '1px solid var(--bwza-glass-line)',
      boxShadow: 'var(--bwza-shadow-nav)',
      display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 2,
      zIndex: 30,
    }}>
      {items.map(it => {
        const on = it.id === active;
        const isAdminTab = mode === 'admin' && it.id !== 'home';
        return (
          <button key={it.id} onClick={() => onChange(it.id)} style={{
            all: 'unset', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            padding: '10px 0 9px', borderRadius: 22,
            color: on ? 'var(--bwza-ink)' : 'var(--bwza-ink-mute)',
            background: on
              ? (isAdminTab
                  ? 'linear-gradient(180deg, rgba(216,90,70,0.30), rgba(216,90,70,0.08))'
                  : 'linear-gradient(180deg, rgba(217,138,74,0.28), rgba(217,138,74,0.08))')
              : 'transparent',
            boxShadow: on
              ? (isAdminTab
                  ? 'inset 0 1px 0 rgba(255,225,180,0.2), inset 0 0 0 1px rgba(216,90,70,0.35)'
                  : 'inset 0 1px 0 rgba(255,225,180,0.2), inset 0 0 0 1px rgba(255,200,140,0.25)')
              : 'none',
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

// ─────────── Stat card (small) ───────────
function StatCard({ eyebrow, value, sub, big }) {
  return (
    <Glass style={{ borderRadius: 18, padding: big ? '14px 14px 12px' : '10px 12px', flex: 1, position: 'relative' }}>
      <div className="bwza-eyebrow">{eyebrow}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
        <span style={{ fontFamily: 'var(--bwza-font-display)', fontSize: big ? 28 : 22, fontWeight: 600, color: 'var(--bwza-ink)', letterSpacing: -0.5 }}>{value}</span>
        {sub && <span style={{ fontSize: 11, color: 'var(--bwza-ink-mute)' }}>{sub}</span>}
      </div>
    </Glass>
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
        backdropFilter: 'var(--bwza-blur-glass)',
        WebkitBackdropFilter: 'var(--bwza-blur-glass)',
        border: flash.tone === 'danger' ? '1px solid rgba(216,90,70,0.5)' : '1px solid rgba(255,210,160,0.25)',
        boxShadow: '0 14px 40px rgba(0,0,0,0.5), 0 0 30px ' + (flash.tone === 'danger' ? 'rgba(216,90,70,0.25)' : 'rgba(217,138,74,0.2)'),
        animation: 'flashIn .25s ease',
        display: 'flex', alignItems: 'center', gap: 10, maxWidth: 320,
      }}>
        <span style={{ fontSize: 20 }}>{flash.glyph || '✓'}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--bwza-ink)' }}>{flash.title}</div>
          {flash.sub && <div style={{ fontSize: 11, color: 'var(--bwza-ink-dim)' }}>{flash.sub}</div>}
        </div>
      </div>
    </div>
  );
}

// ─────────── Empty state (Berg silhouette) ───────────
function EmptyState({ title, sub, glyph = '⛰️' }) {
  return (
    <div style={{
      padding: '40px 30px', textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <div style={{ marginBottom: 14, opacity: 0.6 }}>
        <svg width="120" height="60" viewBox="0 0 120 60" fill="none">
          <path d="M0 58 L20 30 L35 42 L55 18 L75 35 L92 22 L120 58 Z" fill="rgba(217,138,74,0.18)" stroke="rgba(217,138,74,0.4)" strokeWidth="1" strokeLinejoin="round"/>
          <path d="M50 24 L55 18 L60 24 L57 22 L55 23 L53 22 Z" fill="rgba(255,255,255,0.4)"/>
        </svg>
      </div>
      <div style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 18, color: 'var(--bwza-ink)', fontWeight: 600 }}>{title}</div>
      {sub && <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--bwza-ink-mute)', maxWidth: 240, lineHeight: 1.45 }}>{sub}</div>}
    </div>
  );
}

// ─────────── Skeleton loader ───────────
function Skeleton({ w = '100%', h = 16, radius = 8, style = {} }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: 'linear-gradient(90deg, rgba(255,225,180,0.05), rgba(255,225,180,0.12), rgba(255,225,180,0.05))',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s ease infinite',
      ...style,
    }} />
  );
}

// ─────────── DrinkConfirm — regular + negative variants ───────────
function DrinkConfirm({ drink, balance, onConfirm, onCancel }) {
  const [closing, setClosing] = useStateC(false);
  const close = (fn) => { setClosing(true); setTimeout(fn, 180); };
  const after = balance - PRICE;
  const goesNegative = after < 0;

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
        background: goesNegative
          ? 'linear-gradient(180deg, rgba(60,28,22,0.92), rgba(28,16,14,0.96))'
          : 'linear-gradient(180deg, rgba(50,32,20,0.92), rgba(25,18,12,0.96))',
        border: goesNegative ? '1px solid rgba(216,90,70,0.35)' : '1px solid rgba(255,210,160,0.2)',
        backdropFilter: 'var(--bwza-blur-sheet)',
        WebkitBackdropFilter: 'var(--bwza-blur-sheet)',
        boxShadow: 'inset 0 1px 0 rgba(255,225,180,0.15), 0 -20px 60px rgba(0,0,0,0.5)',
        transform: closing ? 'translateY(20px)' : 'translateY(0)',
        transition: 'transform .18s ease',
      }}>
        <div style={{ width: 36, height: 4, background: 'rgba(255,225,180,0.3)', borderRadius: 999, margin: '0 auto 14px' }} />

        {goesNegative ? (
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 999,
              background: 'rgba(216,90,70,0.18)', border: '1px solid rgba(216,90,70,0.4)',
              fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: '#ffb89e',
              textTransform: 'uppercase',
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg>
              Im Minus
            </div>
          </div>
        ) : null}

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 52, lineHeight: 1 }}>{drink.glyph}</div>
          <div style={{ marginTop: 6, fontFamily: 'var(--bwza-font-display)', fontSize: 24, fontWeight: 600, color: '#fef3d8' }}>
            {goesNegative ? 'Trotzdem buchen?' : drink.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--bwza-ink-dim)' }}>
            {goesNegative ? drink.name + ' · ' + drink.sub : drink.sub}
          </div>

          <div style={{
            margin: '18px auto 12px', padding: '12px 18px',
            display: 'inline-flex', alignItems: 'baseline', gap: 4,
            background: 'rgba(0,0,0,0.4)', borderRadius: 14,
            border: '1px solid var(--bwza-glass-line)',
          }}>
            <span style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 30, fontWeight: 600, color: '#fef3d8' }}>1,50</span>
            <span style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 18, color: 'var(--bwza-ink-dim)' }}>€</span>
          </div>

          {goesNegative ? (
            <div style={{
              padding: '12px 14px', margin: '0 4px 14px', borderRadius: 14,
              background: 'rgba(216,90,70,0.10)', border: '1px solid rgba(216,90,70,0.25)',
              fontSize: 12, color: '#ffd2bf', lineHeight: 1.4,
            }}>
              Dein Guthaben geht auf <strong style={{ color: '#ff8b6e' }}>{fmtBal(after)} €</strong>.<br/>
              Beim nächsten Hüttenabend bar oder per PayPal nachladen.
            </div>
          ) : (
            <div style={{ fontSize: 11.5, color: 'var(--bwza-ink-dim)', marginBottom: 14 }}>
              Guthaben danach: <strong style={{ color: 'var(--bwza-ink)' }}>{fmt(after)} €</strong>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <GlassButton full variant="ghost" onClick={() => close(onCancel)}>Abbrechen</GlassButton>
          <GlassButton
            full
            variant={goesNegative ? 'danger' : 'primary'}
            onClick={() => close(onConfirm)}
            style={{ flex: 1.4 }}
          >
            {goesNegative ? 'Trotzdem buchen' : 'Anschreiben lassen'}
          </GlassButton>
        </div>
      </div>
    </div>
  );
}

// ─────────── Profile drawer (slide-up sheet) ───────────
function ProfileDrawer({ member, open, onClose, onAction, isAdmin }) {
  if (!open) return null;
  const item = (icon, label, action, tone) => (
    <button onClick={() => onAction(action)} style={{
      all: 'unset', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 16px', borderRadius: 14,
      color: tone === 'danger' ? '#ff8b6e' : 'var(--bwza-ink)',
      background: 'transparent',
      fontSize: 14, fontWeight: 500,
    }}>
      <span style={{ width: 22, display: 'flex', justifyContent: 'center', color: tone === 'danger' ? '#ff8b6e' : 'var(--bwza-ink-dim)' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.4 }}><path d="M9 18l6-6-6-6"/></svg>
    </button>
  );
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 85,
      background: 'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-end',
      animation: 'fadein .2s ease',
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        margin: 12, width: 'calc(100% - 24px)',
        borderRadius: 28, padding: '14px 12px 12px',
        background: 'linear-gradient(180deg, rgba(40,28,20,0.95), rgba(20,14,10,0.97))',
        border: '1px solid var(--bwza-glass-line-up)',
        backdropFilter: 'var(--bwza-blur-sheet)',
        WebkitBackdropFilter: 'var(--bwza-blur-sheet)',
        boxShadow: '0 -20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ width: 36, height: 4, background: 'rgba(255,225,180,0.3)', borderRadius: 999, margin: '0 auto 14px' }} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '6px 12px 14px',
          borderBottom: '1px solid var(--bwza-glass-line)',
        }}>
          <Avatar member={member} size={52} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 18, fontWeight: 600, color: 'var(--bwza-ink)' }}>{member.name}</div>
            <div style={{ fontSize: 12, color: 'var(--bwza-ink-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.email}</div>
          </div>
        </div>

        <div style={{ padding: '8px 0 4px' }}>
          {item(svgIcon('user'), 'Mein Profil bearbeiten', 'edit')}
          {item(svgIcon('shield'), 'Datenschutz', 'privacy')}
          {item(svgIcon('download'), 'Meine Daten exportieren', 'export')}
        </div>

        {isAdmin && (
          <>
            <div style={{
              margin: '6px 16px', padding: '8px 0',
              borderTop: '1px solid var(--bwza-glass-line)',
              fontSize: 10, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase',
              color: '#ffb89e',
            }}>Admin-Bereich</div>
            <div style={{ padding: '0 0 4px' }}>
              {item(svgIcon('crown'), 'Verwaltung öffnen', 'admin')}
            </div>
          </>
        )}

        <div style={{ padding: '6px 0 6px', borderTop: '1px solid var(--bwza-glass-line)', marginTop: 6 }}>
          {item(svgIcon('trash'), 'Account löschen', 'delete', 'danger')}
          {item(svgIcon('logout'), 'Abmelden', 'logout')}
        </div>
      </div>
    </div>
  );
}

function svgIcon(name) {
  const p = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7 };
  switch (name) {
    case 'user':     return <svg {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>;
    case 'shield':   return <svg {...p}><path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4z"/></svg>;
    case 'download': return <svg {...p}><path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"/></svg>;
    case 'logout':   return <svg {...p}><path d="M9 4H5a2 2 0 00-2 2v12a2 2 0 002 2h4M16 17l5-5-5-5M21 12H10"/></svg>;
    case 'trash':    return <svg {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13"/></svg>;
    case 'crown':    return <svg {...p}><path d="M3 18h18M3 18l2-9 4 4 3-7 3 7 4-4 2 9"/></svg>;
    default: return null;
  }
}

// Export everything
Object.assign(window, {
  PRICE, DRINKS_DATA, ME, ME_NEG, ALL_MEMBERS,
  fmt, fmtSigned, fmtBal, greeting, todayStr,
  BergMark, Glass, ShineEdge, Avatar,
  GlassButton, GlassInput, PasswordInput,
  TopBar, AdminBanner, BottomNav,
  StatCard, Flash, EmptyState, Skeleton,
  DrinkConfirm, ProfileDrawer, svgIcon,
});
