import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../components/app-button';
import { AppText } from '../../components/app-text';
import { colors, radii, spacing } from '../../theme/tokens';
import { useStepAction } from './onboarding-mode';

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
  const action = useStepAction(accessibilityLabel);
  return (
    <>
      {errorMessage === null ? null : (
        <View accessible accessibilityRole="alert" style={styles.errorMessage}>
          <AppText style={styles.errorText}>{errorMessage}</AppText>
        </View>
      )}
      <AppButton
        accessibilityLabel={isSaving ? 'Saving profile details' : action.accessibilityLabel}
        disabled={disabled || isSaving}
        label={isSaving ? 'Saving…' : action.label}
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
});
