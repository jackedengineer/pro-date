import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import { FormScrollView } from '../../components/form-scroll-view';
import { IconButton } from '../../components/icon-button';
import { TextField } from '../../components/text-field';

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
      <FormScrollView>
        <IconButton
          label={changeDestinationAccessibilityLabel}
          icon={ArrowLeft}
          onPress={onBack}
          style={{ alignSelf: 'flex-start' }}
        />

        <View style={styles.content}>
          <AppText variant="eyebrow">Secure verification</AppText>
          <AppText variant="display">Check your messages</AppText>
          <AppText style={styles.supportingText}>
            Enter the six-digit code sent to{' '}
            <AppText style={styles.destination}>{destination}</AppText>.
          </AppText>

          <View style={styles.fieldGroup}>
            <TextField
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
            loading={isSubmitting}
            onPress={submitCode}
          />
        </View>
      </FormScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeInput: {
    backgroundColor: colors.surface,
    borderColor: colors.fieldBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: typography.family.display,
    fontSize: 30,
    letterSpacing: 8,
    minHeight: 68,
    paddingHorizontal: spacing.lg,
    textAlign: 'center',
  },
  codeInputError: {
    borderColor: colors.danger,
  },
  content: {
    gap: spacing.md,
    marginTop: spacing.sm,
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
