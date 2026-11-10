import { Pressable, StyleSheet, View } from 'react-native';
import Heart from 'lucide-react-native/icons/heart';
import { AppText } from '../../components/app-text';
import { colors, hairline, radii, spacing } from '../../theme/tokens';

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
      <AppText style={sharedStyles.quietText} variant="button" numberOfLines={2}>
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
      <AppText style={sharedStyles.emptyBody}>{body}</AppText>
    </View>
  );
}
export const sharedStyles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  stack: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  muted: { color: colors.muted },
  quietButton: {
    flexShrink: 1,
    borderCurve: 'continuous',
    borderRadius: radii.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quietText: { color: colors.plum, textAlign: 'center' },
  pressed: { backgroundColor: colors.plumSoft },
  disabled: { opacity: 0.45 },
  error: {
    borderCurve: 'continuous',
    borderRadius: radii.md,
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
  },
  errorText: { color: colors.danger },
  empty: { paddingVertical: spacing.xl, gap: spacing.sm },
  emptyBody: { color: colors.muted, maxWidth: 340 },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderCurve: 'continuous',
    borderRadius: radii.lg,
    borderWidth: hairline,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
});
