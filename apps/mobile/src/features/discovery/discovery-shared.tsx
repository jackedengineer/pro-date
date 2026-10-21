import { Pressable, StyleSheet, View } from 'react-native';
import Heart from 'lucide-react-native/icons/heart';
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
      <View
        style={sharedStyles.emptyIcon}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Heart size={24} color={colors.plum} strokeWidth={1.6} />
      </View>
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
    borderRadius: radii.sm,
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
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.plumSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
});
