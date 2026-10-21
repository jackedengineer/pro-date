import { StyleSheet } from 'react-native';

import { colors, radii, spacing, typography } from '../../theme/tokens';

export const styles = StyleSheet.create({
  autosaveText: {
    textAlign: 'center',
  },
  characterCount: {
    fontVariant: ['tabular-nums'],
  },
  content: {
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  errorMessage: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
  },
  fieldGroup: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  fieldLabel: {
    color: colors.ink,
    fontFamily: typography.family.medium,
  },
  fieldMeta: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  footer: {
    gap: spacing.md,
    marginTop: 'auto',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.fieldBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: typography.family.medium,
    fontSize: 20,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
  },
  inputFocused: {
    borderColor: colors.plum,
  },
  progress: {
    flex: 1,
  },
  screen: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  scrollContent: {
    flexGrow: 1,
  },
  supportingText: {
    color: colors.muted,
    maxWidth: 340,
  },
});
