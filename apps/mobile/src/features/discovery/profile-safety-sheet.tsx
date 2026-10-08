import type { DiscoveryProfile, ReportProfile } from '@pro-date/contracts';
import { useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';

import type { DiscoveryActions } from '../../api/discovery';
import { AppButton } from '../../components/app-button';
import { AppText } from '../../components/app-text';
import { colors, radii, spacing, typography } from '../../theme/tokens';
import { ErrorNotice, QuietButton } from './discovery-shared';
import { DiscoverySheet } from './discovery-sheet';

const reasons: { value: ReportProfile['reason']; label: string }[] = [
  { value: 'HARASSMENT', label: 'Harassment or threatening behavior' },
  { value: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate photos or content' },
  { value: 'SPAM', label: 'Spam or scam' },
  { value: 'UNDERAGE', label: 'They may be under 18' },
  { value: 'OTHER', label: 'Something else' },
];
export function ProfileSafetySheet({
  profile,
  actions,
  onClose,
  onSaved,
}: {
  profile: Pick<DiscoveryProfile, 'userId' | 'displayName'>;
  actions: DiscoveryActions;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [reason, setReason] = useState<ReportProfile['reason'] | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const save = async (report: boolean) => {
    if (submitting.current || (report && reason === null)) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      if (report && reason !== null)
        await actions.report({ userId: profile.userId, reason, details: details.trim() });
      else await actions.block(profile.userId);
      onSaved(
        report
          ? 'Report saved. This member is now blocked.'
          : 'Member blocked. You will no longer see each other.',
      );
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : 'We could not save this. Try again.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <DiscoverySheet title="Your safety comes first" onClose={onClose} busy={busy}>
      <AppText variant="title">Block or report {profile.displayName}</AppText>
      <AppText>
        Blocking removes your profiles, requests, and match from each other’s view. Reporting also
        blocks this member.
      </AppText>
      <QuietButton label="Block this member" disabled={busy} onPress={() => void save(false)} />
      <AppText variant="button">What would you like to report?</AppText>
      <View style={styles.stack}>
        {reasons.map((item) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: reason === item.value, disabled: busy }}
            disabled={busy}
            key={item.value}
            onPress={() => setReason(item.value)}
            style={[styles.reason, reason === item.value && styles.selected]}
          >
            <AppText>{item.label}</AppText>
          </Pressable>
        ))}
      </View>
      <TextInput
        accessibilityLabel="Report details (optional)"
        editable={!busy}
        value={details}
        onChangeText={setDetails}
        multiline
        maxLength={1000}
        placeholder="Anything else we should know? (optional)"
        placeholderTextColor={colors.muted}
        style={styles.input}
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        onSubmitEditing={() => Keyboard.dismiss()}
      />
      <ErrorNotice message={error} />
      <AppButton
        label={busy ? 'Saving…' : 'Report and block'}
        disabled={busy || reason === null}
        onPress={() => void save(true)}
      />
    </DiscoverySheet>
  );
}
const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  reason: {
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: radii.sm,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  selected: { borderColor: colors.plum, backgroundColor: colors.plumSoft },
  input: {
    minHeight: 120,
    padding: spacing.md,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: typography.family.body,
    fontSize: 16,
    lineHeight: 25,
    textAlignVertical: 'top',
  },
});
