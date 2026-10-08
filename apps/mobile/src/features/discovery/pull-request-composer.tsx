import type { DiscoveryProfile, PullRequestTarget, SendPullRequest } from '@pro-date/contracts';
import { useRef, useState } from 'react';
import { Keyboard, StyleSheet, TextInput } from 'react-native';

import { AppButton } from '../../components/app-button';
import { AppText } from '../../components/app-text';
import { colors, radii, spacing, typography } from '../../theme/tokens';
import { TargetPreview } from './discovery-profile-card';
import { ErrorNotice } from './discovery-shared';
import { DiscoverySheet } from './discovery-sheet';

export function PullRequestComposer({
  profile,
  target,
  onClose,
  onSend,
}: {
  profile: DiscoveryProfile;
  target: PullRequestTarget;
  onClose: () => void;
  onSend: (input: SendPullRequest) => Promise<void>;
}) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const send = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await onSend({
        recipientUserId: profile.userId,
        targetType: target.type,
        targetId: target.id,
        comment: comment.trim(),
      });
    } catch (failure: unknown) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'We could not send your pull request. Try again.',
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <DiscoverySheet title={`A hello for ${profile.displayName}`} onClose={onClose} busy={busy}>
      <AppText variant="title">Something worth a pull request.</AppText>
      <AppText style={styles.muted}>
        A pull request is a like on this {target.type === 'PHOTO' ? 'photo' : 'prompt'}. Add a
        little context, or let the like speak for itself.
      </AppText>
      <TargetPreview target={target} />
      <AppText variant="button">Opening comment · optional</AppText>
      <TextInput
        accessibilityLabel="Opening comment (optional)"
        editable={!busy}
        value={comment}
        onChangeText={setComment}
        multiline
        maxLength={280}
        placeholder="Give them something good to reply to…"
        placeholderTextColor={colors.muted}
        style={styles.input}
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        onSubmitEditing={() => Keyboard.dismiss()}
      />
      <AppText style={styles.counter} variant="caption">
        {comment.length} / 280
      </AppText>
      <ErrorNotice message={error} />
      <AppButton
        label={busy ? 'Sending…' : 'Send pull request'}
        disabled={busy}
        onPress={() => void send()}
      />
    </DiscoverySheet>
  );
}
const styles = StyleSheet.create({
  muted: { color: colors.muted },
  counter: { textAlign: 'right' },
  input: {
    minHeight: 120,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontFamily: typography.family.body,
    fontSize: 16,
    lineHeight: 25,
    padding: spacing.md,
    textAlignVertical: 'top',
  },
});
