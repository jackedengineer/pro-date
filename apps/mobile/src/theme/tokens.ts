export const colors = {
  background: '#F7F2EB',
  border: '#DDD2D7',
  coral: '#E65F55',
  coralPressed: '#C94C45',
  ink: '#211A1F',
  muted: '#756A72',
  plum: '#5A2E4F',
  plumSoft: '#EADDE7',
  sand: '#EEDFCB',
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
  md: 18,
  lg: 28,
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
    display: 44,
    eyebrow: 12,
    title: 28,
  },
} as const;
