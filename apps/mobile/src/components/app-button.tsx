import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { colors, radii, spacing } from '../theme/tokens';
import { AppText } from './app-text';

type PressableProps = ComponentProps<typeof Pressable>;

interface AppButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
}

export function AppButton({ disabled = false, label, style, ...props }: AppButtonProps) {
  const isDisabled = disabled === true;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      hitSlop={4}
      style={(state) => [
        styles.base,
        state.pressed && styles.pressed,
        isDisabled && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}
    >
      <AppText style={styles.label} variant="button">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: radii.pill,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    color: colors.white,
  },
  pressed: {
    backgroundColor: colors.coralPressed,
    transform: [{ scale: 0.985 }],
  },
});
