import { Pressable, StyleSheet, View } from 'react-native';

import { colors, hairline, radii, typography } from '../theme/tokens';
import { AppText } from './app-text';

/** Two or three views of the same thing, switched in place. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <View accessibilityLabel={label} accessibilityRole="tablist" style={styles.track}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityLabel={option.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.selected]}
          >
            <AppText
              numberOfLines={1}
              style={[styles.text, selected && styles.selectedText]}
              variant="caption"
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.sand,
    borderCurve: 'continuous',
    borderRadius: radii.sm,
    flexDirection: 'row',
    padding: 3,
  },
  segment: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radii.sm - 3,
    flex: 1,
    justifyContent: 'center',
    minHeight: 38,
  },
  selected: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: hairline,
  },
  text: { fontFamily: typography.family.medium, fontSize: 14 },
  selectedText: { color: colors.ink },
});
