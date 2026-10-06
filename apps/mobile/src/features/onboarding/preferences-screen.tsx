import type { InterestedInValue, PreferencesUpdate, RelationshipIntent } from '@pro-date/contracts';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '../../components/app-text';
import { colors, spacing, typography } from '../../theme/tokens';
import { OnboardingStepLayout } from './onboarding-step-layout';
import { ProfileStepFooter } from './profile-step-footer';
import { SelectionControl } from './selection-control';

const audienceOptions: readonly { label: string; value: InterestedInValue }[] = [
  { label: 'Women', value: 'WOMEN' },
  { label: 'Men', value: 'MEN' },
  { label: 'Non-binary people', value: 'NON_BINARY_PEOPLE' },
];

const intentOptions: readonly {
  description: string;
  label: string;
  value: RelationshipIntent;
}[] = [
  { description: 'A committed relationship', label: 'Long-term relationship', value: 'LONG_TERM' },
  {
    description: 'Long-term is the goal, but no forced roadmap',
    label: 'Long-term, open to short',
    value: 'LONG_TERM_OPEN_TO_SHORT',
  },
  {
    description: 'Keeping it light, open if it grows',
    label: 'Short-term, open to long',
    value: 'SHORT_TERM_OPEN_TO_LONG',
  },
  { description: 'Something casual and clear', label: 'Short-term', value: 'SHORT_TERM' },
  {
    description: 'Exploring without pretending to know yet',
    label: 'Figuring it out',
    value: 'FIGURING_IT_OUT',
  },
  { description: 'Connection without dating pressure', label: 'Friendship', value: 'FRIENDSHIP' },
];

interface PreferencesScreenProps {
  initialValue?: PreferencesUpdate | undefined;
  onBack?: (() => void) | undefined;
  onSave: (preferences: PreferencesUpdate) => Promise<void>;
}

export function PreferencesScreen({ initialValue, onBack, onSave }: PreferencesScreenProps) {
  const [interestedIn, setInterestedIn] = useState<InterestedInValue[]>(
    initialValue?.interestedIn === undefined ? [] : [...initialValue.interestedIn],
  );
  const [relationshipIntent, setRelationshipIntent] = useState(initialValue?.relationshipIntent);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const allSelected = interestedIn.length === audienceOptions.length;

  const toggleAudience = (value: InterestedInValue) => {
    setInterestedIn((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : audienceOptions
            .map((option) => option.value)
            .filter((option) => current.includes(option) || option === value),
    );
  };

  const save = async () => {
    if (interestedIn.length === 0 || relationshipIntent === undefined || isSaving) return;
    setErrorMessage(null);
    setIsSaving(true);

    try {
      await onSave({ interestedIn, relationshipIntent });
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : 'We could not save your preferences.',
      );
      setIsSaving(false);
    }
  };

  return (
    <OnboardingStepLayout
      current={4}
      footer={
        <ProfileStepFooter
          accessibilityLabel="Save preferences and continue"
          disabled={interestedIn.length === 0 || relationshipIntent === undefined}
          errorMessage={errorMessage}
          isSaving={isSaving}
          onPress={() => void save()}
        />
      }
      onBack={isSaving ? undefined : onBack}
    >
      <AppText variant="eyebrow">Discovery config</AppText>
      <AppText variant="display">Who should make your queue?</AppText>
      <AppText style={styles.supportingText}>
        Choose who you want to date and the kind of connection you want right now.
      </AppText>

      <View style={styles.section}>
        <AppText style={styles.sectionLabel} variant="caption">
          Interested in
        </AppText>
        <SelectionControl
          disabled={isSaving}
          label="Everyone"
          mode="multiple"
          onPress={() =>
            setInterestedIn(allSelected ? [] : audienceOptions.map((option) => option.value))
          }
          selected={allSelected}
        />
        {audienceOptions.map((option) => (
          <SelectionControl
            disabled={isSaving}
            key={option.value}
            label={option.label}
            mode="multiple"
            onPress={() => toggleAudience(option.value)}
            selected={interestedIn.includes(option.value)}
          />
        ))}
      </View>

      <View style={styles.section}>
        <AppText style={styles.sectionLabel} variant="caption">
          Looking for
        </AppText>
        {intentOptions.map((option) => (
          <SelectionControl
            description={option.description}
            disabled={isSaving}
            key={option.value}
            label={option.label}
            mode="single"
            onPress={() => setRelationshipIntent(option.value)}
            selected={relationshipIntent === option.value}
          />
        ))}
      </View>
    </OnboardingStepLayout>
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
});
