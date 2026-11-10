import { useEffect, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet } from 'react-native';

import { colors, hairline, radii, spacing } from '../theme/tokens';
import { AppText } from './app-text';
import { triggerFeedback } from '../theme/feedback';
import { useReducedMotionPreference } from '../theme/motion';

type PressableProps = ComponentProps<typeof Pressable>;

interface AppButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  feedback?: 'selection';
}

export function AppButton({
  disabled = false,
  loading = false,
  label,
  variant = 'primary',
  feedback,
  style,
  onPress,
  onPressIn,
  onPressOut,
  accessibilityState,
  ...props
}: AppButtonProps) {
  const isDisabled = disabled === true || loading;
  const reduced = useReducedMotionPreference();
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduced) {
      scale.stopAnimation();
      scale.setValue(1);
    }
    return () => scale.stopAnimation();
  }, [reduced, scale]);
  const animate = (value: number) => {
    if (!reduced)
      Animated.timing(scale, { toValue: value, duration: 130, useNativeDriver: true }).start();
  };
  const filled = variant === 'primary' || variant === 'danger';
  const labelColor = isDisabled ? colors.muted : filled ? colors.white : colors.plum;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{
        ...accessibilityState,
        disabled: isDisabled,
        busy: loading || accessibilityState?.busy,
      }}
      disabled={isDisabled}
      style={style}
      {...props}
      onPressIn={(event) => {
        animate(0.96);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animate(1);
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (isDisabled) return;
        if (feedback) triggerFeedback(feedback);
        onPress?.(event);
      }}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.base,
            variants[variant],
            pressed && !isDisabled && pressedVariants[variant],
            isDisabled && styles.disabled,
            { transform: [{ scale }] },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={labelColor} size="small" accessible={false} />
          ) : null}
          <AppText style={{ color: labelColor, textAlign: 'center' }} variant="button">
            {label}
          </AppText>
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  disabled: {
    backgroundColor: colors.plumSoft,
    borderColor: colors.plumSoft,
  },
});

// A pressed control darkens in place; fading the whole button reads as disabled.
const pressedVariants = StyleSheet.create({
  primary: { backgroundColor: colors.plumPressed },
  secondary: { backgroundColor: colors.plumSoft },
  quiet: { backgroundColor: colors.plumSoft },
  danger: { opacity: 0.86 },
});

const variants = StyleSheet.create({
  primary: { backgroundColor: colors.plum },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: hairline,
    borderColor: colors.fieldBorder,
  },
  quiet: { backgroundColor: 'transparent', minHeight: 48, paddingVertical: spacing.sm },
  danger: { backgroundColor: colors.danger },
});
