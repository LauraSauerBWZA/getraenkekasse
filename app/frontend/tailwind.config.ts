import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        ui: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        bwza: {
          amber: 'var(--bwza-amber)',
          'amber-deep': 'var(--bwza-amber-deep)',
          'amber-glow': 'var(--bwza-amber-glow)',
          rescue: 'var(--bwza-rescue)',
          ink: 'var(--bwza-ink)',
          'ink-dim': 'var(--bwza-ink-dim)',
          'ink-mute': 'var(--bwza-ink-mute)',
          bg: 'var(--bwza-bg)',
        },
      },
    },
  },
  plugins: [],
};

export default config;
