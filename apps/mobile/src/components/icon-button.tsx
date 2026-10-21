import type { ComponentProps, ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radii } from '../theme/tokens';

interface IconButtonProps extends Omit<ComponentProps<typeof Pressable>, 'children'> {
  label: string;
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  selected?: boolean;
}

export function IconButton({
  label,
  icon: Icon,
  selected = false,
  disabled,
  style,
  ...props
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled === true, ...(selected ? { selected } : {}) }}
      disabled={disabled}
      style={(state) => [
        styles.button,
        (state.pressed || selected) && styles.selected,
        disabled && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}
    >
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Icon color={colors.plum} size={22} strokeWidth={1.8} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    minWidth: 44,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.plumSoft },
  disabled: { opacity: 0.4 },
});
