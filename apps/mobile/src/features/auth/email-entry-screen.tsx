import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '../../components/app-button';
import { AppText } from '../../components/app-text';
import { Screen } from '../../components/screen';
import { colors, radii, spacing, typography } from '../../theme/tokens';
import { isValidEmailAddress, normalizeEmailAddress } from './auth-identifiers';
import { AuthMethodSwitch } from './auth-method-switch';

interface EmailEntryScreenProps {
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onBack: () => void;
  onContinue: (emailAddress: string) => void;
  onUsePhone: () => void;
}

export function EmailEntryScreen({
  errorMessage = null,
  isSubmitting = false,
  onBack,
  onContinue,
  onUsePhone,
}: EmailEntryScreenProps) {
  const [emailAddress, setEmailAddress] = useState('');
  const normalizedEmailAddress = useMemo(() => normalizeEmailAddress(emailAddress), [emailAddress]);
  const canContinue = isValidEmailAddress(normalizedEmailAddress) && !isSubmitting;

  const continueWithEmailAddress = () => {
    if (canContinue) {
      onContinue(normalizedEmailAddress);
    }
  };

  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={12}
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
        >
          <AppText style={styles.backIcon} variant="title">
            ←
          </AppText>
        </Pressable>

        <View style={styles.content}>
          <AppText variant="eyebrow">Your account</AppText>
          <AppText variant="display">What’s your email?</AppText>
          <AppText style={styles.supportingText}>
            We’ll email you a one-time code. Your email is never shown on your profile.
          </AppText>

          <View style={styles.fieldGroup}>
            <TextInput
              accessibilityHint="Enter the email address you want to use for ProDate"
              accessibilityLabel="Email address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              autoFocus
              editable={!isSubmitting}
              keyboardType="email-address"
              onChangeText={setEmailAddress}
              onSubmitEditing={continueWithEmailAddress}
              placeholder="you@example.com"
              placeholderTextColor={colors.muted}
              returnKeyType="done"
              style={styles.input}
              textContentType="emailAddress"
              value={emailAddress}
            />
            {errorMessage === null ? null : (
              <View accessible accessibilityRole="alert" style={styles.errorMessage}>
                <AppText style={styles.errorText}>{errorMessage}</AppText>
              </View>
            )}
            <AppText variant="caption">No password needed.</AppText>
          </View>
        </View>

        <View style={styles.footer}>
          <AuthMethodSwitch
            disabled={isSubmitting}
            label="Use phone instead"
            onPress={onUsePhone}
          />
          <AppButton
            accessibilityLabel={isSubmitting ? 'Sending code' : 'Continue'}
            disabled={!canContinue}
            label={isSubmitting ? 'Sending code…' : 'Continue'}
            onPress={continueWithEmailAddress}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  backButtonPressed: {
    backgroundColor: colors.plumSoft,
  },
  backIcon: {
    fontFamily: typography.family.body,
    fontSize: 25,
    lineHeight: 29,
  },
  content: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  errorMessage: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
  },
  fieldGroup: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  footer: {
    gap: spacing.sm,
    marginTop: 'auto',
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: typography.family.medium,
    fontSize: 18,
    minHeight: 60,
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
  },
  keyboardView: {
    flex: 1,
  },
  screen: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  supportingText: {
    color: colors.muted,
    maxWidth: 330,
  },
});
