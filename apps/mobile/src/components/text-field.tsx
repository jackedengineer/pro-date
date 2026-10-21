import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { colors, radii, spacing, typography } from '../theme/tokens';

/** A controlled native input: validation and values stay with its caller. */
export const TextField = forwardRef<TextInput, TextInputProps>(function TextField(
  { style, onFocus, onBlur, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.muted}
      selectionColor={colors.plum}
      {...props}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[styles.input, style, focused && styles.focused]}
    />
  );
});

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.fieldBorder,
    borderWidth: 1,
    borderRadius: radii.md,
    color: colors.ink,
    fontFamily: typography.family.body,
    fontSize: 17,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  focused: { borderColor: colors.plum },
});
