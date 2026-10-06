import { Host, Picker } from '@expo/ui';
import type { HeightUpdate } from '@pro-date/contracts';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { AppText } from '../../components/app-text';
import { colors, radii, spacing, typography } from '../../theme/tokens';
import { OnboardingStepLayout } from './onboarding-step-layout';
import { ProfileStepFooter } from './profile-step-footer';

const minimumHeightCm = 120;
const maximumHeightCm = 230;
const heightOptions = Array.from(
  { length: maximumHeightCm - minimumHeightCm + 1 },
  (_, index) => minimumHeightCm + index,
);

interface HeightScreenProps {
  initialValue?: HeightUpdate | undefined;
  onBack?: (() => void) | undefined;
  onSave: (height: HeightUpdate) => Promise<void>;
}

export function formatHeight(centimeters: number): string {
  const totalInches = Math.round(centimeters / 2.54);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;

  return `${centimeters} cm · ${feet}′ ${inches}″`;
}

export function HeightScreen({ initialValue, onBack, onSave }: HeightScreenProps) {
  const [centimeters, setCentimeters] = useState(initialValue?.centimeters ?? 170);
  const [isVisible, setIsVisible] = useState(initialValue?.isVisible ?? true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    if (isSaving) return;
    setErrorMessage(null);
    setIsSaving(true);

    try {
      await onSave({ centimeters, isVisible });
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'We could not save your height.');
      setIsSaving(false);
    }
  };

  return (
    <OnboardingStepLayout
      current={6}
      footer={
        <ProfileStepFooter
          accessibilityLabel="Save height and continue"
          disabled={false}
          errorMessage={errorMessage}
          isSaving={isSaving}
          onPress={() => void save()}
        />
      }
      onBack={isSaving ? undefined : onBack}
    >
      <AppText variant="eyebrow">Profile metadata</AppText>
      <AppText variant="display">Add your height.</AppText>
      <AppText style={styles.supportingText}>
        No weird commentary, no ranking algorithm—just an optional profile detail.
      </AppText>

      <View style={styles.pickerCard}>
        <AppText style={styles.heightValue} variant="title">
          {formatHeight(centimeters)}
        </AppText>
        <Host style={styles.pickerHost}>
          <Picker
            appearance="wheel"
            enabled={!isSaving}
            onValueChange={setCentimeters}
            selectedValue={centimeters}
            testID="height-picker"
          >
            {heightOptions.map((height) => (
              <Picker.Item key={height} label={formatHeight(height)} value={height} />
            ))}
          </Picker>
        </Host>
      </View>

      <View style={styles.visibilityRow}>
        <View style={styles.visibilityCopy}>
          <AppText style={styles.visibilityLabel}>Show height on my profile</AppText>
          <AppText style={styles.visibilityDescription} variant="caption">
            You can keep it private and still continue.
          </AppText>
        </View>
        <Switch
          accessibilityLabel="Show my height on my profile"
          disabled={isSaving}
          onValueChange={setIsVisible}
          thumbColor={colors.surface}
          trackColor={{ false: colors.border, true: colors.plum }}
          value={isVisible}
        />
      </View>
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  heightValue: {
    textAlign: 'center',
  },
  pickerCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.md,
    overflow: 'hidden',
    paddingTop: spacing.md,
  },
  pickerHost: {
    height: 184,
    width: '100%',
  },
  supportingText: {
    color: colors.muted,
    maxWidth: 350,
  },
  visibilityCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  visibilityDescription: {
    color: colors.muted,
  },
  visibilityLabel: {
    fontFamily: typography.family.medium,
  },
  visibilityRow: {
    alignItems: 'center',
    backgroundColor: colors.sand,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    padding: spacing.md,
  },
});
