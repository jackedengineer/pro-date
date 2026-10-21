import { Pressable, StyleSheet, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import { triggerFeedback } from '../../theme/feedback';

import { AppText } from '../../components/app-text';
import { colors, radii, spacing } from '../../theme/tokens';

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
      onPress={() => {
        if (disabled) return;
        if (!selected || mode === 'multiple') triggerFeedback('selection');
        onPress();
      }}
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
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.indicator,
          mode === 'multiple' && styles.square,
          selected && styles.indicatorSelected,
        ]}
      >
        {selected ? <Check size={16} color={colors.white} strokeWidth={2.5} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  square: { borderRadius: 7 },
  control: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.fieldBorder,
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
