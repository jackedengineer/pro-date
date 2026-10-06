import { StyleSheet } from 'react-native';

import { colors, radii, spacing, typography } from '../../theme/tokens';

export const styles = StyleSheet.create({
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
  content: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  dateCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  dateValue: {
    color: colors.plum,
    textAlign: 'center',
  },
  errorMessage: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
  },
  footer: {
    gap: spacing.md,
    marginTop: 'auto',
    paddingTop: spacing.xl,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  keyboardView: {
    flex: 1,
  },
  picker: {
    alignSelf: 'stretch',
  },
  pickerButton: {
    alignItems: 'center',
    backgroundColor: colors.plumSoft,
    borderRadius: radii.pill,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  pickerButtonPressed: {
    opacity: 0.72,
  },
  pickerButtonText: {
    color: colors.plum,
  },
  privacyCard: {
    backgroundColor: colors.sand,
    borderRadius: radii.md,
    gap: spacing.xs,
    padding: spacing.md,
  },
  privacyTitle: {
    color: colors.ink,
    fontFamily: typography.family.medium,
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
