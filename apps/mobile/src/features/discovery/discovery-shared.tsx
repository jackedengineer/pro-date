import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../components/app-text';
import { colors, radii, spacing } from '../../theme/tokens';

export function QuietButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        sharedStyles.quietButton,
        pressed && sharedStyles.pressed,
        disabled && sharedStyles.disabled,
      ]}
    >
      <AppText style={sharedStyles.quietText} variant="button">
        {label}
      </AppText>
    </Pressable>
  );
}
export function ErrorNotice({ message }: { message: string | null }) {
  return message === null ? null : (
    <View accessibilityRole="alert" style={sharedStyles.error}>
      <AppText style={sharedStyles.errorText}>{message}</AppText>
    </View>
  );
}
export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={sharedStyles.empty}>
      <AppText style={sharedStyles.emptyIcon} accessibilityElementsHidden>
        ⑂
      </AppText>
      <AppText variant="title">{title}</AppText>
      <AppText style={sharedStyles.muted}>{body}</AppText>
    </View>
  );
}
export const sharedStyles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  stack: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  muted: { color: colors.muted },
  quietButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quietText: { color: colors.plum },
  pressed: { backgroundColor: colors.plumSoft },
  disabled: { opacity: 0.45 },
  error: { borderRadius: radii.sm, backgroundColor: colors.dangerSoft, padding: spacing.md },
  errorText: { color: colors.danger },
  empty: { paddingVertical: spacing.xl, gap: spacing.md },
  emptyIcon: { color: colors.plum, fontSize: 40, lineHeight: 48 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
});
