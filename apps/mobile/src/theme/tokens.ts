import { Platform, StyleSheet } from 'react-native';

/**
 * Paper: warm paper grounds, plum ink for actions, coral for the one affectionate accent
 * (a like, a send). Photos and prompt answers carry the colour; chrome stays quiet.
 */
export const colors = {
  background: '#FAF8F5',
  border: '#E3DDDF',
  fieldBorder: '#95858E',
  coral: '#E65F55',
  coralPressed: '#C94C45',
  coralSoft: '#FBE9E6',
  danger: '#9D2F2B',
  dangerSoft: '#F7E3E0',
  ink: '#211A1F',
  muted: '#756A72',
  overlay: 'rgba(33, 26, 31, 0.42)',
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
  xl: 28,
  pill: 999,
} as const;

/** One device pixel: dividers and card edges, never a full point. */
export const hairline = StyleSheet.hairlineWidth;

export const typography = {
  family: {
    body: 'Manrope_400Regular',
    medium: 'Manrope_600SemiBold',
    bold: 'Manrope_700Bold',
    /** Names, screen titles and headlines. */
    display: 'Fraunces_500Medium',
    /** A member's own words: prompt answers and quotes. */
    serif: 'Fraunces_400Regular',
  },
  size: {
    body: 16,
    button: 16,
    caption: 13,
    display: 32,
    hero: 40,
    eyebrow: 12,
    headline: 17,
    largeTitle: 34,
    quote: 20,
    title: 24,
  },
} as const;

/** Cubic-bezier control points; use with `Easing.bezier(...curve)`. */
export const easing = {
  /** Entering and exiting. */
  out: [0.23, 1, 0.32, 1],
  /** Moving on screen. */
  inOut: [0.77, 0, 0.175, 1],
} as const;

export const duration = {
  press: 120,
  quick: 180,
  standard: 240,
} as const;

/** Reanimated spring configs for anything a finger released. */
export const springs = {
  settle: { duration: 400, dampingRatio: 1 },
  snap: { duration: 400, dampingRatio: 0.8 },
} as const;

/** The only elevation in the app: a card lifted a little off the paper. */
export const cardShadow = Platform.select({
  android: { elevation: 2 },
  default: {
    shadowColor: '#3A2A33',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
  },
});

/** Minimum touch target: 44pt on iOS, 48dp on Android. */
export const touchTarget = Platform.OS === 'android' ? 48 : 44;
