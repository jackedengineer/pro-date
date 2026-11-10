import { displayNameSchema } from '@pro-date/contracts';
import { useState } from 'react';
import { Keyboard, TextInput, View } from 'react-native';
import { FormScrollView } from '../../components/form-scroll-view';
import { IconButton } from '../../components/icon-button';

import { AppButton } from '../../components/app-button';
import { AppText } from '../../components/app-text';
import { Screen } from '../../components/screen';
import { colors } from '../../theme/tokens';
import { styles } from './display-name-screen.styles';
import { useStepAction, useStepBack } from './onboarding-mode';
import { OnboardingProgress } from './onboarding-progress';

interface DisplayNameScreenProps {
  initialValue?: string | undefined;
  onBack: () => void;
  onSave: (displayName: string) => Promise<void>;
}

export function DisplayNameScreen({ initialValue, onBack, onSave }: DisplayNameScreenProps) {
  const action = useStepAction('Save and continue');
  const back = useStepBack('Back to profile introduction');
  const [displayName, setDisplayName] = useState(initialValue ?? '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    if (isSaving) {
      return;
    }

    const result = displayNameSchema.safeParse(displayName);

    if (!result.success) {
      setErrorMessage('Your name must be between 2 and 40 characters.');
      return;
    }

    Keyboard.dismiss();
    setErrorMessage(null);
    setIsSaving(true);

    try {
      await onSave(result.data);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Couldn’t save your profile. Try again.',
      );
      setIsSaving(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <FormScrollView
        contentContainerStyle={styles.scrollContent}
        footer={
          <AppButton
            accessibilityLabel={isSaving ? 'Saving name' : action.accessibilityLabel}
            disabled={displayName.trim().length === 0 || isSaving}
            label={isSaving ? 'Saving…' : action.label}
            loading={isSaving}
            onPress={() => void save()}
          />
        }
      >
        <View style={styles.header}>
          <IconButton label={back.label} icon={back.icon} onPress={onBack} disabled={isSaving} />
          <View style={styles.progress}>
            <OnboardingProgress current={1} total={9} />
          </View>
        </View>

        <View style={styles.content}>
          <AppText variant="eyebrow">The basics</AppText>
          <AppText variant="display">What should we call you?</AppText>
          <AppText style={styles.supportingText}>
            First name or chosen name—whatever feels most you.
          </AppText>

          <View style={styles.fieldGroup}>
            <AppText style={styles.fieldLabel} variant="caption">
              First name or chosen name
            </AppText>
            <TextInput
              accessibilityHint="This name will be shown on your profile"
              accessibilityLabel="First name or chosen name"
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
              editable={!isSaving}
              maxLength={40}
              onBlur={() => setIsFocused(false)}
              onChangeText={(value) => {
                setDisplayName(value);
                setErrorMessage(null);
              }}
              onFocus={() => setIsFocused(true)}
              onSubmitEditing={() => void save()}
              placeholder="Ada"
              placeholderTextColor={colors.muted}
              returnKeyType="done"
              selectionColor={colors.plum}
              style={[styles.input, isFocused && styles.inputFocused]}
              submitBehavior="blurAndSubmit"
              textContentType="name"
              value={displayName}
            />
            <View style={styles.fieldMeta}>
              <AppText style={{ flex: 1 }} variant="caption">
                Shown on your profile
              </AppText>
              <AppText style={styles.characterCount} variant="caption">
                {displayName.length}/40
              </AppText>
            </View>
            {errorMessage === null ? null : (
              <View accessible accessibilityRole="alert" style={styles.errorMessage}>
                <AppText style={styles.errorText}>{errorMessage}</AppText>
              </View>
            )}
          </View>
        </View>
      </FormScrollView>
    </Screen>
  );
}
