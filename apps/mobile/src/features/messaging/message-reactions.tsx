import type { ReactionKind } from '@pro-date/contracts';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../components/app-text';
import { colors } from '../../theme/tokens';
import type { ChatRow } from './chat-thread';
import { reactionOptions } from './reaction-options';

export function MessageReactions({
  row,
  ownerId,
  online,
  react,
  refresh,
}: {
  row: ChatRow;
  ownerId: string;
  online: boolean;
  react: ((id: string, kind: ReactionKind) => void) | null;
  refresh: (id: string) => void;
}) {
  if (row.messageId === null) return null;
  const reactions = row.context?.reactions ?? [];
  return (
    <View style={styles.container}>
      <View style={styles.chips}>
        {reactionOptions.map((option) => {
          const members = reactions.filter((state) => state.reaction === option.kind);
          if (members.length === 0) return null;
          const selected = members.some((state) => state.userId === ownerId);
          const disabled =
            !online || react === null || row.reactionPending || row.reactionError !== null;
          return (
            <Pressable
              key={option.kind}
              accessibilityRole="button"
              accessibilityLabel={`${selected ? 'Remove' : 'Add'} ${option.label} reaction, ${members.length} ${members.length === 1 ? 'person' : 'people'}`}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => react?.(row.messageId!, option.kind)}
              style={[styles.chip, selected && styles.selected]}
            >
              <AppText>{option.emoji}</AppText>
              <AppText variant="caption" style={styles.count}>
                {members.length}
                {selected ? ' ✓' : ''}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {row.reactionPending ? (
        <AppText variant="caption" accessibilityLiveRegion="polite">
          Saving reaction…
        </AppText>
      ) : null}
      {row.reactionError === null ? null : (
        <View style={styles.errorBox}>
          <AppText variant="caption" accessibilityRole="alert" style={styles.error}>
            {row.reactionError}
          </AppText>
          <Pressable
            accessibilityRole="button"
            disabled={!online || row.reactionPending}
            onPress={() => refresh(row.messageId!)}
            style={styles.refresh}
          >
            <AppText variant="caption">Refresh reaction</AppText>
          </Pressable>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { maxWidth: '86%', gap: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 56,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: { borderColor: colors.plum, backgroundColor: colors.plumSoft },
  count: { fontVariant: ['tabular-nums'] },
  errorBox: { maxWidth: '100%' },
  error: { color: colors.danger },
  refresh: { minHeight: 44, justifyContent: 'center' },
});
