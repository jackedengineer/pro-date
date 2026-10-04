import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

import { AppButton } from '../../components/app-button';
import { AppText } from '../../components/app-text';
import { Screen } from '../../components/screen';
import { colors, radii, spacing, typography } from '../../theme/tokens';

interface PhoneEntryScreenProps {
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onBack: () => void;
  onContinue: (phoneNumber: string) => void;
}

function toIndianE164(value: string): string | null {
  const phoneNumber = parsePhoneNumberFromString(value, 'IN');

  if (phoneNumber?.country !== 'IN' || !phoneNumber.isValid()) {
    return null;
  }

  return phoneNumber.number;
}

export function PhoneEntryScreen({
  errorMessage = null,
  isSubmitting = false,
  onBack,
  onContinue,
}: PhoneEntryScreenProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const e164PhoneNumber = useMemo(() => toIndianE164(phoneNumber), [phoneNumber]);

  const continueWithPhoneNumber = () => {
    if (e164PhoneNumber !== null && !isSubmitting) {
      onContinue(e164PhoneNumber);
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
          <AppText variant="display">What’s your number?</AppText>
          <AppText style={styles.supportingText}>
            We’ll text you a one-time code. Your number is never shown on your profile.
          </AppText>

          <View style={styles.fieldGroup}>
            <View style={styles.phoneField}>
              <View style={styles.countryCode}>
                <AppText variant="button">+91</AppText>
              </View>
              <TextInput
                accessibilityHint="Enter a ten digit Indian mobile number"
                accessibilityLabel="Phone number"
                autoComplete="tel"
                autoFocus
                editable={!isSubmitting}
                keyboardType="phone-pad"
                maxLength={16}
                onChangeText={setPhoneNumber}
                onSubmitEditing={continueWithPhoneNumber}
                placeholder="98765 43210"
                placeholderTextColor={colors.muted}
                returnKeyType="done"
                style={styles.input}
                textContentType="telephoneNumber"
                value={phoneNumber}
              />
            </View>
            {errorMessage === null ? null : (
              <View accessible accessibilityRole="alert" style={styles.errorMessage}>
                <AppText style={styles.errorText}>{errorMessage}</AppText>
              </View>
            )}
            <AppText variant="caption">Standard messaging rates may apply.</AppText>
          </View>
        </View>

        <View style={styles.footer}>
          <AppButton
            accessibilityLabel={isSubmitting ? 'Sending code' : 'Continue'}
            disabled={e164PhoneNumber === null || isSubmitting}
            label={isSubmitting ? 'Sending code…' : 'Continue'}
            onPress={continueWithPhoneNumber}
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
  countryCode: {
    borderRightColor: colors.border,
    borderRightWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  fieldGroup: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  errorMessage: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
  },
  footer: {
    marginTop: 'auto',
  },
  input: {
    color: colors.ink,
    flex: 1,
    fontFamily: typography.family.medium,
    fontSize: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
  },
  keyboardView: {
    flex: 1,
  },
  phoneField: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 60,
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
