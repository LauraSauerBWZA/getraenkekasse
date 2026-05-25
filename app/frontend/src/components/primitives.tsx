import { useState, type CSSProperties, type PropsWithChildren, type ReactNode } from 'react';

// ─────────── BergMark ───────────
export function BergMark({ size = 22, color = '#d98a4a' }: { size?: number; color?: string }) {
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
    amber: { bg: 'var(--bwza-glass-amber)', line: 'rgba(255,200,140,0.30)' },
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
        background: 'linear-gradient(180deg, rgba(255,225,180,0.10) 0%, transparent 24%)',
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
      background: 'linear-gradient(180deg, #f4b56a, #d98a4a)',
      color: '#3a200a',
      fontWeight: 700,
      letterSpacing: 0.3,
      boxShadow: 'var(--bwza-shadow-amber)',
      border: 'none',
    },
    danger: {
      background: 'linear-gradient(180deg, oklch(70% 0.18 25), oklch(55% 0.18 25))',
      color: '#fef3d8',
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
          background: 'rgba(15,11,8,0.55)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border:
            '1px solid ' +
            (error
              ? 'rgba(216,90,70,0.5)'
              : focus
                ? 'rgba(244,181,106,0.45)'
                : 'var(--bwza-glass-line)'),
          boxShadow: focus
            ? '0 0 0 4px rgba(217,138,74,0.12), inset 0 1px 0 rgba(255,225,180,0.07)'
            : 'inset 0 1px 0 rgba(255,225,180,0.06)',
          transition:
            'border-color var(--bwza-dur) var(--bwza-ease), box-shadow var(--bwza-dur) var(--bwza-ease)',
        }}
      >
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoFocus={autoFocus}
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
}: {
  label?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
  hint?: string;
  error?: string | null;
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
