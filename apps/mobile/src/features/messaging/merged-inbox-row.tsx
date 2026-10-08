import type { Conversation } from '@pro-date/contracts';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../components/app-text';
import { colors, radii, spacing } from '../../theme/tokens';
import type { ConversationTurn } from './merged-inbox-model';

export const MergedConversationRow = memo(function MergedConversationRow({
  conversation,
  turn,
  onOpen,
}: {
  conversation: Conversation;
  turn: ConversationTurn;
  onOpen: (id: string) => void;
}) {
  const { member, lastMessage } = conversation;
  const turnLabel = turn === 'YOUR_TURN' ? 'Your turn' : 'Their turn';
  const preview =
    lastMessage === null
      ? 'Start the conversation'
      : `${turn === 'THEIR_TURN' ? 'You: ' : ''}${lastMessage.body}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Chat with ${member.displayName}. ${turnLabel}. ${preview}`}
      accessibilityHint="Opens your private conversation"
      onPress={() => onOpen(conversation.id)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {member.photoUrl === null ? (
        <View style={[styles.avatar, styles.initial]} accessible={false}>
          <AppText variant="title" style={styles.initialText}>
            {member.displayName.slice(0, 1)}
          </AppText>
        </View>
      ) : (
        <Image
          source={member.photoUrl}
          contentFit="cover"
          style={[styles.avatar, styles.photoOutline]}
          recyclingKey={member.userId}
          testID={`merged-avatar-${conversation.id}`}
        />
      )}
      <View style={styles.summary}>
        <View style={styles.heading}>
          <AppText variant="button" numberOfLines={1} style={styles.name}>
            {member.displayName}
          </AppText>
          <AppText variant="caption" style={styles.date}>
            {new Date(conversation.activityAt).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
            })}
          </AppText>
        </View>
        <AppText
          numberOfLines={2}
          variant="caption"
          style={lastMessage === null ? styles.invitation : styles.preview}
        >
          {preview}
        </AppText>
        {lastMessage === null ? (
          <AppText variant="caption" style={styles.newMatch}>
            New merge · no messages yet
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
});
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    minHeight: 96,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  summary: { flex: 1, gap: spacing.xs },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flex: 1 },
  date: { color: colors.muted, fontVariant: ['tabular-nums'] },
  preview: { color: colors.muted },
  invitation: { color: colors.plum },
  newMatch: { color: colors.muted },
  avatar: { width: 56, height: 64, borderRadius: radii.md, backgroundColor: colors.plumSoft },
  photoOutline: { borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.1)' },
  initial: { alignItems: 'center', justifyContent: 'center' },
  initialText: { color: colors.plum },
  pressed: { backgroundColor: colors.plumSoft },
});
