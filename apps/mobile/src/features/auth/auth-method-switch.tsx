import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '../../components/app-text';
import { colors, radii, spacing, typography } from '../../theme/tokens';

interface AuthMethodSwitchProps {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}

export function AuthMethodSwitch({ disabled = false, label, onPress }: AuthMethodSwitchProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <AppText style={styles.label}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: radii.pill,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    backgroundColor: colors.plumSoft,
  },
  label: {
    color: colors.plum,
    fontFamily: typography.family.medium,
  },
});
