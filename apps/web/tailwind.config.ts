import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 액센트
        'electric-violet': '#7270ff',
        'signal-blue': '#1560fb',
        // 텍스트
        'midnight-ink': '#1c1a2c',
        'deep-indigo': '#2f2b4a',
        'slate-text': '#4b5563',
        'silver': '#9ca3af',
        // 서피스
        'paper': '#ffffff',
        'bone': '#f9fafb',
        'pebble': '#f3f4f6',
        'mist': '#e5e7eb',
        'fog': '#d9dbda',
        // 다크 (리모컨·디스플레이 전용)
        'dark-base': '#0f0e17',
        'dark-surface': '#1c1a2c',
        'dark-border': '#2f2b4a',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
