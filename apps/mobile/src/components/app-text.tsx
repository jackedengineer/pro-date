import type { ComponentProps } from 'react';
import { StyleSheet, Text } from 'react-native';

import { colors, typography } from '../theme/tokens';

type TextProps = ComponentProps<typeof Text>;
type TextVariant = 'body' | 'button' | 'caption' | 'display' | 'eyebrow' | 'title';

interface AppTextProps extends TextProps {
  variant?: TextVariant;
}

export function AppText({ accessibilityRole, style, variant = 'body', ...props }: AppTextProps) {
  const inferredRole = variant === 'display' || variant === 'title' ? 'header' : undefined;

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
    lineHeight: 25,
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
    letterSpacing: -1.5,
    lineHeight: 49,
  },
  eyebrow: {
    color: colors.plum,
    fontFamily: typography.family.medium,
    fontSize: typography.size.eyebrow,
    letterSpacing: 1.4,
    lineHeight: 17,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: typography.family.display,
    fontSize: typography.size.title,
    letterSpacing: -0.6,
    lineHeight: 34,
  },
});
