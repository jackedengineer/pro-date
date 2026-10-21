export const colors = {
  background: '#FAF8F5',
  border: '#E3DDDF',
  fieldBorder: '#95858E',
  coral: '#E65F55',
  coralPressed: '#C94C45',
  danger: '#9D2F2B',
  dangerSoft: '#F7E3E0',
  ink: '#211A1F',
  muted: '#756A72',
  plum: '#5A2E4F',
  plumPressed: '#422239',
  plumSoft: '#F0E9EE',
  sand: '#F3EBDD',
  surface: '#FFFFFF',
  white: '#FFFFFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 12,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const typography = {
  family: {
    body: 'Manrope_400Regular',
    display: 'Manrope_700Bold',
    medium: 'Manrope_600SemiBold',
  },
  size: {
    body: 16,
    button: 16,
    caption: 13,
    display: 32,
    hero: 40,
    eyebrow: 12,
    title: 24,
  },
} as const;
