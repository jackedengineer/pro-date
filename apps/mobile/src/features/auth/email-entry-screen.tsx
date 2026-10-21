import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import { FormScrollView } from '../../components/form-scroll-view';
import { IconButton } from '../../components/icon-button';
import { TextField } from '../../components/text-field';

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
      <FormScrollView>
        <IconButton
          label="Go back"
          icon={ArrowLeft}
          onPress={onBack}
          style={{ alignSelf: 'flex-start' }}
        />

        <View style={styles.content}>
          <AppText variant="eyebrow">Your account</AppText>
          <AppText variant="display">What’s your email?</AppText>
          <AppText style={styles.supportingText}>
            We’ll email you a one-time code. Your email is never shown on your profile.
          </AppText>

          <View style={styles.fieldGroup}>
            <AppText variant="button">Email address</AppText>
            <TextField
              accessibilityHint="Enter the email address you want to use for Merge"
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
            loading={isSubmitting}
            onPress={continueWithEmailAddress}
          />
        </View>
      </FormScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  footer: {
    gap: spacing.sm,
    marginTop: 'auto',
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.fieldBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: typography.family.medium,
    fontSize: 18,
    minHeight: 60,
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
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
