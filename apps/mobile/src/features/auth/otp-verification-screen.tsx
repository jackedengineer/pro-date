import { useState } from 'react';
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

interface OtpVerificationScreenProps {
  changeDestinationAccessibilityLabel: string;
  destination: string;
  errorMessage: string | null;
  isResending?: boolean;
  isSubmitting: boolean;
  onBack: () => void;
  onResend: () => void;
  onSubmit: (code: string) => void;
  resendSecondsRemaining: number;
}

export function OtpVerificationScreen({
  changeDestinationAccessibilityLabel,
  destination,
  errorMessage,
  isResending = false,
  isSubmitting,
  onBack,
  onResend,
  onSubmit,
  resendSecondsRemaining,
}: OtpVerificationScreenProps) {
  const [code, setCode] = useState('');
  const isBusy = isSubmitting || isResending;
  const canSubmit = code.length === 6 && !isBusy;
  const canResend = resendSecondsRemaining === 0 && !isBusy;
  const resendLabel = isResending
    ? 'Sending a new code'
    : canResend
      ? 'Send a new code'
      : `Resend in ${resendSecondsRemaining} seconds`;

  const submitCode = () => {
    if (canSubmit) {
      onSubmit(code);
    }
  };

  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <Pressable
          accessibilityLabel={changeDestinationAccessibilityLabel}
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
          <AppText variant="eyebrow">Secure verification</AppText>
          <AppText variant="display">Check your messages</AppText>
          <AppText style={styles.supportingText}>
            Enter the six-digit code sent to{' '}
            <AppText style={styles.destination}>{destination}</AppText>.
          </AppText>

          <View style={styles.fieldGroup}>
            <TextInput
              accessibilityHint="Enter the six-digit verification code"
              accessibilityLabel="Verification code"
              autoComplete="one-time-code"
              autoFocus
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
              onSubmitEditing={submitCode}
              placeholder="000000"
              placeholderTextColor={colors.muted}
              returnKeyType="done"
              style={[styles.codeInput, errorMessage !== null && styles.codeInputError]}
              textContentType="oneTimeCode"
              value={code}
            />

            {errorMessage === null ? null : (
              <View accessible accessibilityRole="alert" style={styles.errorMessage}>
                <AppText style={styles.errorText}>{errorMessage}</AppText>
              </View>
            )}

            <Pressable
              accessibilityLabel={resendLabel}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canResend }}
              disabled={!canResend}
              hitSlop={8}
              onPress={onResend}
              style={({ pressed }) => [
                styles.resendButton,
                pressed && canResend && styles.resendButtonPressed,
              ]}
            >
              <AppText style={[styles.resendText, !canResend && styles.resendTextDisabled]}>
                {isResending
                  ? 'Sending…'
                  : canResend
                    ? 'Send a new code'
                    : `Resend in ${resendSecondsRemaining}s`}
              </AppText>
            </Pressable>
          </View>
        </View>

        <View style={styles.footer}>
          <AppButton
            accessibilityLabel={isSubmitting ? 'Verifying code' : 'Verify code'}
            disabled={!canSubmit}
            label={isSubmitting ? 'Verifying…' : 'Verify code'}
            onPress={submitCode}
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
  codeInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: typography.family.display,
    fontSize: 30,
    letterSpacing: spacing.md,
    minHeight: 68,
    paddingHorizontal: spacing.lg,
    textAlign: 'center',
  },
  codeInputError: {
    borderColor: colors.danger,
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
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  footer: {
    marginTop: 'auto',
  },
  keyboardView: {
    flex: 1,
  },
  destination: {
    fontFamily: typography.family.medium,
  },
  resendButton: {
    alignSelf: 'center',
    borderRadius: radii.pill,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  resendButtonPressed: {
    backgroundColor: colors.plumSoft,
  },
  resendText: {
    color: colors.plum,
    fontFamily: typography.family.medium,
  },
  resendTextDisabled: {
    color: colors.muted,
  },
  screen: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  supportingText: {
    color: colors.muted,
    maxWidth: 340,
  },
});
