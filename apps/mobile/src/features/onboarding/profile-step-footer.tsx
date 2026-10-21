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
        Saved when you continue
      </AppText>
      <AppButton
        accessibilityLabel={isSaving ? 'Saving profile details' : accessibilityLabel}
        disabled={disabled || isSaving}
        label={isSaving ? 'Saving…' : 'Save & continue'}
        loading={isSaving}
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
