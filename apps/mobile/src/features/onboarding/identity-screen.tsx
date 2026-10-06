import type { IdentityUpdate } from '@pro-date/contracts';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { AppText } from '../../components/app-text';
import { colors, radii, spacing, typography } from '../../theme/tokens';
import { OnboardingStepLayout } from './onboarding-step-layout';
import { ProfileStepFooter } from './profile-step-footer';
import { SelectionControl } from './selection-control';

const genderOptions = ['Woman', 'Man', 'Non-binary', 'Genderfluid', 'Agender', 'Questioning'];
const pronounOptions = ['she/her', 'he/him', 'they/them', 'she/they', 'he/they', 'ask me'];

interface IdentityScreenProps {
  initialValue?: IdentityUpdate | undefined;
  onBack?: (() => void) | undefined;
  onSave: (identity: IdentityUpdate) => Promise<void>;
}

export function IdentityScreen({ initialValue, onBack, onSave }: IdentityScreenProps) {
  const [genderIdentity, setGenderIdentity] = useState(initialValue?.genderIdentity);
  const [pronouns, setPronouns] = useState(initialValue?.pronouns);
  const [isGenderVisible, setIsGenderVisible] = useState(initialValue?.isGenderVisible ?? true);
  const [arePronounsVisible, setArePronounsVisible] = useState(
    initialValue?.arePronounsVisible ?? true,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    if (genderIdentity === undefined || pronouns === undefined || isSaving) return;
    setErrorMessage(null);
    setIsSaving(true);

    try {
      await onSave({ arePronounsVisible, genderIdentity, isGenderVisible, pronouns });
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'We could not save these details.');
      setIsSaving(false);
    }
  };

  return (
    <OnboardingStepLayout
      current={3}
      footer={
        <ProfileStepFooter
          accessibilityLabel="Save identity and continue"
          disabled={genderIdentity === undefined || pronouns === undefined}
          errorMessage={errorMessage}
          isSaving={isSaving}
          onPress={() => void save()}
        />
      }
      onBack={isSaving ? undefined : onBack}
    >
      <AppText variant="eyebrow">Identity, your way</AppText>
      <AppText variant="display">How do you identify?</AppText>
      <AppText style={styles.supportingText}>
        Choose the language that feels right. These answers can be changed later.
      </AppText>

      <View style={styles.section}>
        <AppText style={styles.sectionLabel} variant="caption">
          Gender identity
        </AppText>
        {genderOptions.map((option) => (
          <SelectionControl
            disabled={isSaving}
            key={option}
            label={option}
            mode="single"
            onPress={() => setGenderIdentity(option)}
            selected={genderIdentity === option}
          />
        ))}
      </View>

      <VisibilityRow
        disabled={isSaving}
        label="Show my gender on my profile"
        onValueChange={setIsGenderVisible}
        value={isGenderVisible}
      />

      <View style={styles.section}>
        <AppText style={styles.sectionLabel} variant="caption">
          Pronouns
        </AppText>
        {pronounOptions.map((option) => (
          <SelectionControl
            disabled={isSaving}
            key={option}
            label={option}
            mode="single"
            onPress={() => setPronouns(option)}
            selected={pronouns === option}
          />
        ))}
      </View>

      <VisibilityRow
        disabled={isSaving}
        label="Show my pronouns on my profile"
        onValueChange={setArePronounsVisible}
        value={arePronounsVisible}
      />
    </OnboardingStepLayout>
  );
}

function VisibilityRow({
  disabled,
  label,
  onValueChange,
  value,
}: {
  disabled: boolean;
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <View style={styles.visibilityRow}>
      <AppText style={styles.visibilityLabel}>{label}</AppText>
      <Switch
        accessibilityLabel={label}
        disabled={disabled}
        onValueChange={onValueChange}
        thumbColor={colors.surface}
        trackColor={{ false: colors.border, true: colors.plum }}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  sectionLabel: {
    color: colors.ink,
    fontFamily: typography.family.medium,
    marginBottom: spacing.xs,
  },
  supportingText: {
    color: colors.muted,
    maxWidth: 350,
  },
  visibilityLabel: {
    flex: 1,
  },
  visibilityRow: {
    alignItems: 'center',
    backgroundColor: colors.sand,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 64,
    paddingHorizontal: spacing.md,
  },
});
