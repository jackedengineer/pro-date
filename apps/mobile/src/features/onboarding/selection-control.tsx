import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../../components/app-text';
import { colors, radii, spacing, typography } from '../../theme/tokens';

interface SelectionControlProps {
  description?: string | undefined;
  disabled?: boolean | undefined;
  label: string;
  mode: 'multiple' | 'single';
  onPress: () => void;
  selected: boolean;
}

export function SelectionControl({
  description,
  disabled = false,
  label,
  mode,
  onPress,
  selected,
}: SelectionControlProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole={mode === 'multiple' ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.control,
        selected && styles.selected,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.copy}>
        <AppText style={selected && styles.selectedText} variant="button">
          {label}
        </AppText>
        {description === undefined ? null : (
          <AppText style={styles.description} variant="caption">
            {description}
          </AppText>
        )}
      </View>
      <View style={[styles.indicator, selected && styles.indicatorSelected]}>
        {selected ? (
          <AppText style={styles.check} variant="caption">
            ✓
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  check: {
    color: colors.white,
    fontFamily: typography.family.medium,
  },
  control: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 58,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  description: {
    color: colors.muted,
  },
  disabled: {
    opacity: 0.5,
  },
  indicator: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  indicatorSelected: {
    backgroundColor: colors.plum,
    borderColor: colors.plum,
  },
  pressed: {
    opacity: 0.72,
  },
  selected: {
    backgroundColor: colors.plumSoft,
    borderColor: colors.plum,
  },
  selectedText: {
    color: colors.plum,
  },
});
