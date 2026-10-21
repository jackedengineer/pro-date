import type { ReactionKind } from '@pro-date/contracts';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../components/app-text';
import { colors } from '../../theme/tokens';
import { useReducedMotionPreference } from '../../theme/motion';
import type { ChatRow } from './chat-thread';
import { displayedReactions, reactionOptions } from './reaction-options';

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
  const reducedMotion = useReducedMotionPreference();
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    opacity.stopAnimation();
    opacity.setValue(1);
    if (reducedMotion || row.pendingReaction === undefined) return;
    opacity.setValue(0.65);
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: 120,
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [row.key, row.pendingReaction, reducedMotion, opacity]);
  if (row.messageId === null) return null;
  const reactions = displayedReactions(row, ownerId);
  const hasReactions = reactions.some((state) => state.reaction !== null);
  if (!hasReactions && row.reactionError === null) return null;
  return (
    <View style={styles.container}>
      <View testID="message-reaction-badges" style={[styles.chips, !hasReactions && styles.empty]}>
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
              style={({ pressed }) => [styles.target, pressed && styles.pressed]}
            >
              <Animated.View
                testID={`reaction-badge-${option.kind}`}
                style={[
                  styles.chip,
                  selected && styles.selected,
                  { opacity: selected ? opacity : 1 },
                ]}
              >
                <AppText style={styles.emoji} maxFontSizeMultiplier={1.2}>
                  {option.emoji}
                </AppText>
                {members.length > 1 ? (
                  <AppText variant="caption" style={styles.count} maxFontSizeMultiplier={1.3}>
                    {members.length}
                  </AppText>
                ) : null}
              </Animated.View>
            </Pressable>
          );
        })}
      </View>
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
  container: { maxWidth: '86%' },
  // Target starts 16px above the bubble edge; its centred 26px badge overlaps by 7px.
  // Keep the full 44px row in flow so neighbouring messages never share hit areas.
  chips: { flexDirection: 'row', gap: 2, marginTop: -16, paddingHorizontal: 4 },
  empty: { marginTop: 0 },
  target: { minWidth: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: 26,
    minWidth: 32,
    paddingHorizontal: 7,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: { borderColor: colors.fieldBorder, backgroundColor: colors.plumSoft },
  emoji: { fontSize: 16, lineHeight: 20 },
  count: { fontSize: 11, lineHeight: 15, color: colors.plum, fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.7 },
  errorBox: { maxWidth: '100%' },
  error: { color: colors.danger },
  refresh: { minHeight: 44, justifyContent: 'center' },
});
