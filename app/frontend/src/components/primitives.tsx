import { useState, type CSSProperties, type PropsWithChildren, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

// ─────────── BergMark ───────────
export function BergMark({ size = 22, color = '#2BD4BC' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path d="M16 3 L29 27 L3 27 Z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9.5 22 L13 16 L16.5 20 L20 14 L24 22 Z" fill={color} fillOpacity="0.35" />
      <path d="M14.5 11 L16 8 L17.5 11 Z" fill={color} />
      <circle cx="16" cy="15.5" r="1.3" fill={color} />
    </svg>
  );
}

// ─────────── Glass ───────────
type GlassTone = 'dark' | 'raise' | 'amber';
export function Glass({
  children,
  style = {},
  tone = 'dark',
  onClick,
}: PropsWithChildren<{ style?: CSSProperties; tone?: GlassTone; onClick?: () => void }>) {
  const tones: Record<GlassTone, { bg: string; line: string }> = {
    dark: { bg: 'var(--bwza-glass)', line: 'var(--bwza-glass-line)' },
    raise: { bg: 'var(--bwza-glass-raise)', line: 'var(--bwza-glass-line-up)' },
    amber: { bg: 'var(--bwza-glass-amber)', line: 'rgba(43,212,188,0.30)' },
  };
  const t = tones[tone];
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
    >
      {children}
    </div>
  );
}

export function ShineEdge({ radius = 28 }: { radius?: number }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: radius,
        pointerEvents: 'none',
        background: 'linear-gradient(180deg, var(--bwza-glass-shine) 0%, transparent 24%)',
      }}
    />
  );
}

// ─────────── GlassButton ───────────
type ButtonVariant = 'primary' | 'danger' | 'ghost' | 'quiet';
type ButtonSize = 'sm' | 'md' | 'lg';

export function GlassButton({
  children,
  variant = 'primary',
  onClick,
  disabled,
  full,
  size = 'md',
  type = 'button',
  style = {},
}: PropsWithChildren<{
  variant?: ButtonVariant;
  onClick?: () => void;
  disabled?: boolean;
  full?: boolean;
  size?: ButtonSize;
  type?: 'button' | 'submit';
  style?: CSSProperties;
}>) {
  const sizes: Record<ButtonSize, { pad: string; font: number; radius: number }> = {
    sm: { pad: '10px 14px', font: 13, radius: 12 },
    md: { pad: '14px 18px', font: 14, radius: 14 },
    lg: { pad: '16px 20px', font: 15, radius: 16 },
  };
  const sz = sizes[size];
  const variants: Record<ButtonVariant, CSSProperties> = {
    primary: {
      background: 'linear-gradient(180deg, var(--bwza-teal), var(--bwza-teal-deep))',
      color: 'var(--bwza-teal-ink)',
      fontWeight: 700,
      letterSpacing: 0.3,
      boxShadow: 'var(--bwza-shadow-amber)',
      border: 'none',
    },
    danger: {
      background: 'linear-gradient(180deg, var(--bwza-coral), #E04449)',
      color: '#2A0608',
      fontWeight: 700,
      letterSpacing: 0.3,
      boxShadow: 'var(--bwza-shadow-rescue)',
      border: 'none',
    },
    ghost: {
      background: 'rgba(0,0,0,0.30)',
      color: 'var(--bwza-ink)',
      fontWeight: 600,
      border: '1px solid var(--bwza-glass-line)',
    },
    quiet: {
      background: 'transparent',
      color: 'var(--bwza-ink-dim)',
      fontWeight: 600,
      border: '1px solid transparent',
    },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        all: 'unset',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: sz.pad,
        borderRadius: sz.radius,
        fontSize: sz.font,
        width: full ? '100%' : undefined,
        boxSizing: 'border-box',
        textAlign: 'center',
        opacity: disabled ? 0.45 : 1,
        transition: 'transform var(--bwza-dur-fast) var(--bwza-ease)',
        fontFamily: 'var(--bwza-font-ui)',
        ...variants[variant],
        ...style,
      }}
    >
      <span>{children}</span>
    </button>
  );
}

// ─────────── GlassInput ───────────
export function GlassInput({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  suffix,
  error,
  autoFocus,
  hint,
  id,
  name,
  autoComplete,
}: {
  label?: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  suffix?: ReactNode;
  error?: string | null;
  autoFocus?: boolean;
  hint?: string;
  id?: string;
  name?: string;
  autoComplete?: string;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <label style={{ display: 'block' }}>
      {label && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.3,
            color: error ? 'var(--bwza-rescue-soft)' : 'var(--bwza-ink-dim)',
            marginBottom: 6,
            paddingLeft: 2,
          }}
        >
          {label}
        </div>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 14px',
          borderRadius: 14,
          // Kontrast: Feld klar vom dunklen Seitengrund (--bwza-bg) abgesetzt —
          // deutlich hellerer Füll-Ton + kräftigerer Rest-Rahmen (glass-line-up).
          background: 'rgba(255,255,255,0.09)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border:
            '1px solid ' +
            (error
              ? 'rgba(255,92,97,0.55)'
              : focus
                ? 'rgba(43,212,188,0.55)'
                : 'var(--bwza-glass-line-up)'),
          boxShadow: focus
            ? '0 0 0 4px rgba(43,212,188,0.15), inset 0 1px 0 rgba(255,255,255,0.08)'
            : 'inset 0 1px 0 rgba(255,255,255,0.06)',
          transition:
            'border-color var(--bwza-dur) var(--bwza-ease), box-shadow var(--bwza-dur) var(--bwza-ease)',
        }}
      >
        <input
          className="bwza-input"
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoFocus={autoFocus}
          id={id}
          name={name}
          autoComplete={autoComplete}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            all: 'unset',
            flex: 1,
            minWidth: 0,
            color: 'var(--bwza-ink)',
            fontFamily: 'var(--bwza-font-ui)',
            fontSize: 15,
            fontWeight: 500,
          }}
        />
        {suffix}
      </div>
      {(hint || error) && (
        <div
          style={{
            fontSize: 11,
            marginTop: 6,
            paddingLeft: 2,
            color: error ? 'var(--bwza-rescue-soft)' : 'var(--bwza-ink-mute)',
          }}
        >
          {error || hint}
        </div>
      )}
    </label>
  );
}

// ─────────── PasswordInput ───────────
export function PasswordInput({
  label,
  value,
  onChange,
  autoFocus,
  hint,
  error,
  id,
  name,
  autoComplete,
}: {
  label?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
  hint?: string;
  error?: string | null;
  id?: string;
  name?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <GlassInput
      label={label}
      type={show ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      autoFocus={autoFocus}
      hint={hint}
      error={error}
      id={id}
      name={name}
      autoComplete={autoComplete}
      suffix={
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setShow((s) => !s);
          }}
          style={{
            all: 'unset',
            cursor: 'pointer',
            padding: 4,
            color: 'var(--bwza-ink-mute)',
          }}
          aria-label={show ? 'Passwort verbergen' : 'Passwort zeigen'}
        >
          {show ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
              <path d="M3 3l18 18" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      }
    />
  );
}

// ─────────── Avatar (Initialen, Teal-Gradient) ───────────
// Eine Quelle für den Avatar. Teal-Gradient = der Primär-Akzent (B5c).
export function Avatar({
  firstName,
  lastName,
  size = 38,
  onClick,
  ariaLabel,
}: {
  firstName: string;
  lastName: string;
  size?: number;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const initialen = ((firstName[0] ?? '') + (lastName[0] ?? '')).toUpperCase() || '·';
  const style: CSSProperties = {
    width: size,
    height: size,
    flex: `0 0 ${size}px`,
    borderRadius: 'var(--bwza-radius-pill)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(180deg, var(--bwza-teal), var(--bwza-teal-deep))',
    color: 'var(--bwza-teal-ink)',
    fontFamily: 'var(--bwza-font-ui)',
    fontWeight: 700,
    fontSize: Math.round(size * 0.38),
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.30)',
  };
  if (onClick) {
    return (
      <button type="button" aria-label={ariaLabel ?? 'Profil'} onClick={onClick} style={{ all: 'unset', cursor: 'pointer', ...style }}>
        {initialen}
      </button>
    );
  }
  return (
    <div aria-hidden style={style}>
      {initialen}
    </div>
  );
}

// ─────────── StatCard (Eyebrow + leichte Großzahl) ───────────
export function StatCard({
  eyebrow,
  value,
  sub,
  tone = 'dark',
}: {
  eyebrow: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: GlassTone;
}) {
  return (
    <Glass tone={tone} style={{ borderRadius: 'var(--bwza-radius-md)', padding: '12px 12px', flex: 1, textAlign: 'center' }}>
      <div className="bwza-eyebrow">{eyebrow}</div>
      <div
        style={{
          fontFamily: 'var(--bwza-font-ui)',
          fontSize: 20,
          fontWeight: 300,
          color: 'var(--bwza-ink)',
          letterSpacing: -0.4,
          marginTop: 4,
        }}
      >
        {value}
      </div>
      {sub && <div style={{ marginTop: 2, fontSize: 10.5, color: 'var(--bwza-ink-mute)' }}>{sub}</div>}
    </Glass>
  );
}

// ─────────── StatusChip (semantische Token-Farben, B5c) ───────────
type ChipTone = 'gold' | 'green' | 'coral' | 'teal' | 'blue' | 'neutral';
const CHIP_COLOR: Record<ChipTone, string> = {
  gold: 'var(--bwza-gold)',   // offen / Warnung
  green: 'var(--bwza-green)', // bestätigt / positiv
  coral: 'var(--bwza-coral)', // abgelehnt / negativ
  teal: 'var(--bwza-teal)',   // aktiv / primär
  blue: 'var(--bwza-blue)',   // Info
  neutral: 'var(--bwza-ink-mute)',
};
export function StatusChip({ label, tone = 'neutral' }: { label: string; tone?: ChipTone }) {
  const color = CHIP_COLOR[tone];
  return (
    <span
      style={{
        flexShrink: 0,
        padding: '4px 10px',
        borderRadius: 'var(--bwza-radius-pill)',
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
        color,
        border: `1px solid ${color}`,
        background: 'rgba(0,0,0,0.30)',
      }}
    >
      {label}
    </span>
  );
}

// ─────────── EmptyState (Berg-Silhouette, teal) ───────────
export function EmptyState({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ padding: '34px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ marginBottom: 12, opacity: 0.7 }} aria-hidden>
        <svg width="110" height="56" viewBox="0 0 120 60" fill="none">
          <path d="M0 58 L20 30 L35 42 L55 18 L75 35 L92 22 L120 58 Z" fill="rgba(43,212,188,0.14)" stroke="rgba(43,212,188,0.45)" strokeWidth="1" strokeLinejoin="round" />
          <path d="M50 24 L55 18 L60 24 L57 22 L55 23 L53 22 Z" fill="rgba(255,255,255,0.5)" />
        </svg>
      </div>
      <div style={{ fontFamily: 'var(--bwza-font-ui)', fontSize: 18, color: 'var(--bwza-ink)', fontWeight: 600 }}>{title}</div>
      {sub && <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--bwza-ink-mute)', maxWidth: 240, lineHeight: 1.45 }}>{sub}</div>}
    </div>
  );
}

// ─────────── Skeleton / Loading ───────────
export function Skeleton({ w = '100%', h = 14, radius = 8, style = {} }: { w?: number | string; h?: number; radius?: number; style?: CSSProperties }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: radius,
        background:
          'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.10), rgba(255,255,255,0.04))',
        backgroundSize: '200% 100%',
        animation: 'bwza-shimmer 1.5s ease infinite',
        ...style,
      }}
    />
  );
}

// ─────────── KategorieMarker (B5c-Feinschliff) ───────────
// Kategorie-farbiger Marker statt Emoji: getönter Glass-Container + Farbpunkt.
// Zuordnung (Vorschlag der Spec): alkoholfrei=Blau, alkoholisch=Gold, sonstiges=
// Teal. Konsistent in Buchen, Drink-Katalog und Sortenstatistik.
const KATEGORIE_MARKER: Record<string, { solid: string; tint: string; line: string }> = {
  alkoholfrei: { solid: '#4D8EF7', tint: 'rgba(77,142,247,0.16)', line: 'rgba(77,142,247,0.45)' },
  alkoholisch: { solid: '#F4B740', tint: 'rgba(244,183,64,0.16)', line: 'rgba(244,183,64,0.45)' },
  sonstiges: { solid: '#2BD4BC', tint: 'rgba(43,212,188,0.16)', line: 'rgba(43,212,188,0.45)' },
};
export function KategorieMarker({ kategorie, size = 40 }: { kategorie: string; size?: number }) {
  const m = KATEGORIE_MARKER[kategorie] ?? {
    solid: 'var(--bwza-ink-mute)',
    tint: 'rgba(255,255,255,0.06)',
    line: 'var(--bwza-glass-line)',
  };
  const dot = Math.max(8, Math.round(size * 0.3));
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: m.tint,
        borderRadius: 'var(--bwza-radius-sm)',
        border: `1px solid ${m.line}`,
      }}
    >
      <span style={{ width: dot, height: dot, borderRadius: 'var(--bwza-radius-pill)', background: m.solid }} />
    </div>
  );
}

// ─────────── Eyebrow (B5-Icons) ───────────
// Kicker-Label mit konsistentem lucide-Line-Icon statt Emoji-Glyph. Icon im
// Teal-Akzent, Text in der bestehenden `.bwza-eyebrow`-Optik. Einheitliche
// Größe/Stroke über alle Sektions-Labels (Admin-Cards, Aufladen, Verlauf …).
export function Eyebrow({
  icon: Icon,
  children,
  color = 'var(--bwza-teal)',
}: {
  icon: LucideIcon;
  children: ReactNode;
  color?: string;
}) {
  return (
    <div className="bwza-eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Icon size={13} strokeWidth={2} style={{ color, flexShrink: 0 }} aria-hidden />
      <span>{children}</span>
    </div>
  );
}

// Einheitlicher Lade-Platzhalter (ersetzt das nackte „Lädt …") — ein paar
// Skeleton-Zeilen in einer Glass-Card, gegen Layout-Sprünge.
export function Loading({ zeilen = 3 }: { zeilen?: number }) {
  return (
    <Glass tone="dark" style={{ borderRadius: 'var(--bwza-radius-md)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: zeilen }).map((_, i) => (
        <Skeleton key={i} w={i === zeilen - 1 ? '55%' : '100%'} />
      ))}
    </Glass>
  );
}
