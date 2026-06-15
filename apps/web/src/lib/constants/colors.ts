export const MEMBER_COLORS = {
  mom: {
    label: 'Мама',
    accent: 'var(--color-lavender)',
    soft: 'var(--color-lavender-soft)',
    ring: 'var(--color-lavender-ring)'
  },
  dad: {
    label: 'Папа',
    accent: 'var(--color-blue)',
    soft: 'var(--color-blue-soft)',
    ring: 'var(--color-blue-ring)'
  },
  misha: {
    label: 'Миша',
    accent: 'var(--color-green)',
    soft: 'var(--color-green-soft)',
    ring: 'var(--color-green-ring)'
  },
  anya: {
    label: 'Аня',
    accent: 'var(--color-peach)',
    soft: 'var(--color-peach-soft)',
    ring: 'var(--color-peach-ring)'
  }
} as const;

export type MemberColorKey = keyof typeof MEMBER_COLORS;

export type AccentColor = 'green' | 'lavender' | 'blue' | 'peach' | 'yellow' | 'danger' | 'gray';
