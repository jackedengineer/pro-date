import type { LocationUpdate } from '@pro-date/contracts';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../components/app-button';
import { AppText } from '../../components/app-text';
import { colors, radii, spacing, typography } from '../../theme/tokens';
import { OnboardingStepLayout } from './onboarding-step-layout';

interface LocationScreenProps {
  captureLocation: () => Promise<LocationUpdate>;
  onBack?: (() => void) | undefined;
  onSave: (location: LocationUpdate) => Promise<void>;
}

export function LocationScreen({ captureLocation, onBack, onSave }: LocationScreenProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    if (isSaving) return;
    setErrorMessage(null);
    setIsSaving(true);

    try {
      const location = await captureLocation();
      await onSave(location);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : 'We could not save your discovery area.',
      );
      setIsSaving(false);
    }
  };

  return (
    <OnboardingStepLayout
      current={5}
      footer={
        <>
          {errorMessage === null ? null : (
            <View accessible accessibilityRole="alert" style={styles.errorMessage}>
              <AppText style={styles.errorText}>{errorMessage}</AppText>
            </View>
          )}
          <AppText style={styles.syncText} variant="caption">
            Foreground access only · Editable anytime
          </AppText>
          <AppButton
            accessibilityLabel={isSaving ? 'Finding your location' : 'Use my location'}
            disabled={isSaving}
            label={isSaving ? 'Locating…' : 'Use my location'}
            onPress={() => void save()}
          />
        </>
      }
      onBack={isSaving ? undefined : onBack}
    >
      <AppText variant="eyebrow">Discovery radius</AppText>
      <AppText variant="display">Set your discovery area.</AppText>
      <AppText style={styles.supportingText}>
        We use your location to queue relevant people nearby—not to broadcast where you are.
      </AppText>

      <View style={styles.privacyCard}>
        <PrivacyRow
          copy="A location point used for distance and discovery."
          label="Stored privately"
        />
        <View style={styles.divider} />
        <PrivacyRow
          copy="Your city or region—never your exact coordinates."
          label="Shown publicly"
        />
      </View>
    </OnboardingStepLayout>
  );
}

function PrivacyRow({ copy, label }: { copy: string; label: string }) {
  return (
    <View style={styles.privacyRow}>
      <AppText style={styles.privacyLabel} variant="caption">
        {label}
      </AppText>
      <AppText style={styles.privacyCopy}>{copy}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  divider: {
    backgroundColor: colors.border,
    height: 1,
  },
  errorMessage: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
  },
  privacyCard: {
    backgroundColor: colors.sand,
    borderRadius: radii.md,
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  privacyCopy: {
    color: colors.muted,
  },
  privacyLabel: {
    color: colors.ink,
    fontFamily: typography.family.medium,
  },
  privacyRow: {
    gap: spacing.xs,
  },
  supportingText: {
    color: colors.muted,
    maxWidth: 350,
  },
  syncText: {
    color: colors.muted,
    textAlign: 'center',
  },
});
