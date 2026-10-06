import { displayNameSchema } from '@pro-date/contracts';
import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '../../components/app-button';
import { AppText } from '../../components/app-text';
import { Screen } from '../../components/screen';
import { colors } from '../../theme/tokens';
import { styles } from './display-name-screen.styles';
import { OnboardingProgress } from './onboarding-progress';

interface DisplayNameScreenProps {
  onBack: () => void;
  onSave: (displayName: string) => Promise<void>;
}

export function DisplayNameScreen({ onBack, onSave }: DisplayNameScreenProps) {
  const [displayName, setDisplayName] = useState('');
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
        error instanceof Error
          ? error.message
          : 'We could not save your profile. Please try again.',
      );
      setIsSaving(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="Back to profile introduction"
              accessibilityRole="button"
              disabled={isSaving}
              hitSlop={8}
              onPress={onBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
            >
              <AppText style={styles.backIcon} variant="title">
                ←
              </AppText>
            </Pressable>
            <View style={styles.progress}>
              <OnboardingProgress current={1} total={8} />
            </View>
          </View>

          <View style={styles.content}>
            <AppText variant="eyebrow">The basics</AppText>
            <AppText variant="display">What should we call you?</AppText>
            <AppText style={styles.supportingText}>
              Use the first name or chosen name you’d introduce yourself with.
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
                placeholder="Your name"
                placeholderTextColor={colors.muted}
                returnKeyType="done"
                selectionColor={colors.coral}
                style={[styles.input, isFocused && styles.inputFocused]}
                submitBehavior="blurAndSubmit"
                textContentType="name"
                value={displayName}
              />
              <View style={styles.fieldMeta}>
                <AppText variant="caption">Shown on your profile · Editable later</AppText>
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

          <View style={styles.footer}>
            <AppText style={styles.autosaveText} variant="caption">
              Saved automatically after each step
            </AppText>
            <AppButton
              accessibilityLabel={isSaving ? 'Saving name' : 'Save and continue'}
              disabled={displayName.trim().length === 0 || isSaving}
              label={isSaving ? 'Saving…' : 'Save & continue'}
              onPress={() => void save()}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
