import { StyleSheet } from 'react-native';

import { colors, radii, spacing, typography } from '../../theme/tokens';

export const styles = StyleSheet.create({
  autosaveText: {
    textAlign: 'center',
  },
  backButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  backButtonPressed: {
    backgroundColor: colors.plumSoft,
  },
  backIcon: {
    fontFamily: typography.family.body,
    fontSize: 25,
    lineHeight: 29,
  },
  characterCount: {
    fontVariant: ['tabular-nums'],
  },
  content: {
    gap: spacing.md,
    marginTop: spacing.xl,
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
    borderColor: colors.border,
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
    borderWidth: 2,
  },
  keyboardView: {
    flex: 1,
  },
  progress: {
    flex: 1,
  },
  screen: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  supportingText: {
    color: colors.muted,
    maxWidth: 340,
  },
});
