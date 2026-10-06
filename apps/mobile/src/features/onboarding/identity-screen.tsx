import type { IdentityUpdate } from '@pro-date/contracts';
import { useState } from 'react';
import { StyleSheet, Switch, TextInput, View } from 'react-native';

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
  const [isCustomGender, setIsCustomGender] = useState(
    initialValue?.genderIdentity !== undefined &&
      !genderOptions.includes(initialValue.genderIdentity),
  );
  const [areCustomPronouns, setAreCustomPronouns] = useState(
    initialValue?.pronouns !== undefined && !pronounOptions.includes(initialValue.pronouns),
  );
  const [isGenderVisible, setIsGenderVisible] = useState(initialValue?.isGenderVisible ?? true);
  const [arePronounsVisible, setArePronounsVisible] = useState(
    initialValue?.arePronounsVisible ?? true,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    if (
      genderIdentity === undefined ||
      genderIdentity.trim().length < 2 ||
      pronouns === undefined ||
      pronouns.trim().length < 2 ||
      isSaving
    ) {
      return;
    }
    setErrorMessage(null);
    setIsSaving(true);

    try {
      await onSave({
        arePronounsVisible,
        genderIdentity: genderIdentity.trim(),
        isGenderVisible,
        pronouns: pronouns.trim(),
      });
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
          disabled={
            genderIdentity === undefined ||
            genderIdentity.trim().length < 2 ||
            pronouns === undefined ||
            pronouns.trim().length < 2
          }
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
            onPress={() => {
              setGenderIdentity(option);
              setIsCustomGender(false);
            }}
            selected={!isCustomGender && genderIdentity === option}
          />
        ))}
        <SelectionControl
          disabled={isSaving}
          label="Self-describe"
          mode="single"
          onPress={() => {
            setGenderIdentity(isCustomGender ? genderIdentity : '');
            setIsCustomGender(true);
          }}
          selected={isCustomGender}
        />
        {isCustomGender ? (
          <TextInput
            accessibilityLabel="Describe your gender identity"
            autoCapitalize="sentences"
            editable={!isSaving}
            maxLength={40}
            onChangeText={setGenderIdentity}
            placeholder="Use your own words"
            placeholderTextColor={colors.muted}
            selectionColor={colors.coral}
            style={styles.customInput}
            value={genderIdentity}
          />
        ) : null}
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
            onPress={() => {
              setPronouns(option);
              setAreCustomPronouns(false);
            }}
            selected={!areCustomPronouns && pronouns === option}
          />
        ))}
        <SelectionControl
          disabled={isSaving}
          label="Self-describe pronouns"
          mode="single"
          onPress={() => {
            setPronouns(areCustomPronouns ? pronouns : '');
            setAreCustomPronouns(true);
          }}
          selected={areCustomPronouns}
        />
        {areCustomPronouns ? (
          <TextInput
            accessibilityLabel="Describe your pronouns"
            autoCapitalize="none"
            editable={!isSaving}
            maxLength={30}
            onChangeText={setPronouns}
            placeholder="e.g. xe/xem"
            placeholderTextColor={colors.muted}
            selectionColor={colors.coral}
            style={styles.customInput}
            value={pronouns}
          />
        ) : null}
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
        style={styles.switch}
        thumbColor={colors.surface}
        trackColor={{ false: colors.border, true: colors.plum }}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  customInput: {
    backgroundColor: colors.surface,
    borderColor: colors.plum,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: typography.family.body,
    fontSize: 16,
    minHeight: 56,
    paddingHorizontal: spacing.md,
  },
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
  switch: {
    alignSelf: 'center',
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
