import type { ComponentProps } from 'react';
import { StyleSheet, Text } from 'react-native';

import { colors, typography } from '../theme/tokens';

type TextProps = ComponentProps<typeof Text>;
type TextVariant =
  | 'body'
  | 'button'
  | 'caption'
  | 'display'
  | 'eyebrow'
  | 'headline'
  | 'hero'
  | 'largeTitle'
  | 'quote'
  | 'title';

interface AppTextProps extends TextProps {
  variant?: TextVariant;
}

export function AppText({ accessibilityRole, style, variant = 'body', ...props }: AppTextProps) {
  const inferredRole =
    variant === 'display' || variant === 'title' || variant === 'hero' || variant === 'largeTitle'
      ? 'header'
      : undefined;

  return (
    <Text
      accessibilityRole={accessibilityRole ?? inferredRole}
      style={[styles.base, variantStyles[variant], style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    color: colors.ink,
    fontFamily: typography.family.body,
  },
});

const variantStyles = StyleSheet.create({
  body: {
    fontSize: typography.size.body,
    lineHeight: 24,
  },
  button: {
    fontFamily: typography.family.medium,
    fontSize: typography.size.button,
    lineHeight: 22,
  },
  caption: {
    color: colors.muted,
    fontSize: typography.size.caption,
    lineHeight: 19,
  },
  display: {
    fontFamily: typography.family.display,
    fontSize: typography.size.display,
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  hero: {
    fontFamily: typography.family.display,
    fontSize: typography.size.hero,
    letterSpacing: -0.8,
    lineHeight: 46,
  },
  eyebrow: {
    color: colors.muted,
    fontFamily: typography.family.medium,
    fontSize: typography.size.eyebrow,
    letterSpacing: 0.4,
    lineHeight: 17,
  },
  headline: {
    fontFamily: typography.family.medium,
    fontSize: typography.size.headline,
    lineHeight: 23,
  },
  largeTitle: {
    fontFamily: typography.family.display,
    fontSize: typography.size.largeTitle,
    letterSpacing: -0.6,
    lineHeight: 40,
  },
  // A member's own words are set in the serif so they read as speech, not interface.
  quote: {
    fontFamily: typography.family.serif,
    fontSize: typography.size.quote,
    letterSpacing: -0.2,
    lineHeight: 28,
  },
  title: {
    fontFamily: typography.family.display,
    fontSize: typography.size.title,
    letterSpacing: -0.3,
    lineHeight: 30,
  },
});
