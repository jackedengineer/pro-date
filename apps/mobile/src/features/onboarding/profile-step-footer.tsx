import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../components/app-button';
import { AppText } from '../../components/app-text';
import { colors, radii, spacing } from '../../theme/tokens';

interface ProfileStepFooterProps {
  accessibilityLabel: string;
  disabled: boolean;
  errorMessage: string | null;
  isSaving: boolean;
  onPress: () => void;
}

export function ProfileStepFooter({
  accessibilityLabel,
  disabled,
  errorMessage,
  isSaving,
  onPress,
}: ProfileStepFooterProps) {
  return (
    <>
      {errorMessage === null ? null : (
        <View accessible accessibilityRole="alert" style={styles.errorMessage}>
          <AppText style={styles.errorText}>{errorMessage}</AppText>
        </View>
      )}
      <AppText style={styles.syncText} variant="caption">
        Draft sync is on
      </AppText>
      <AppButton
        accessibilityLabel={isSaving ? 'Saving profile details' : accessibilityLabel}
        disabled={disabled || isSaving}
        label={isSaving ? 'Committing…' : 'Commit & continue'}
        onPress={onPress}
      />
    </>
  );
}

const styles = StyleSheet.create({
  errorMessage: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
  },
  syncText: {
    textAlign: 'center',
  },
});
