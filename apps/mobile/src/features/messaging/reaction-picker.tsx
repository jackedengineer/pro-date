import type { ReactionKind } from '@pro-date/contracts';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import X from 'lucide-react-native/icons/x';
import { AppText } from '../../components/app-text';
import { IconButton } from '../../components/icon-button';
import { colors } from '../../theme/tokens';
import type { ChatRow } from './chat-thread';
import { reactionOptions } from './reaction-options';

export function ReactionPicker({
  row,
  ownerId,
  online,
  onClose,
  onReply,
  onReact,
  onRefresh,
  bottomInset = 0,
}: {
  row: ChatRow | null;
  ownerId: string;
  online: boolean;
  onClose: () => void;
  onReply: ((id: string) => void) | null;
  onReact: (id: string, kind: ReactionKind) => void;
  onRefresh: (id: string) => void;
  bottomInset?: number;
}) {
  const own = row?.context?.reactions.find((state) => state.userId === ownerId)?.reaction ?? null;
  const disabled =
    !online || row?.reactionPending === true || row?.reactionError != null || row?.context == null;
  return (
    <Modal visible={row !== null} transparent animationType="none" onRequestClose={onClose}>
      <View style={[styles.overlay, { paddingBottom: Math.max(16, bottomInset) }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
        <View style={styles.sheet} accessibilityViewIsModal onAccessibilityEscape={onClose}>
          <View style={styles.header}>
            <AppText variant="button" accessibilityRole="header">
              Message actions
            </AppText>
            <IconButton label="Close message actions" icon={X} onPress={onClose} />
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <AppText numberOfLines={2} style={styles.preview}>
              {row?.body}
            </AppText>
            <View style={styles.choices}>
              {reactionOptions.map((option) => (
                <Pressable
                  key={option.kind}
                  accessibilityRole="button"
                  accessibilityLabel={`${own === option.kind ? 'Remove' : 'Add'} ${option.label} reaction`}
                  accessibilityState={{ selected: own === option.kind, disabled }}
                  disabled={disabled}
                  onPress={() => {
                    if (row?.messageId != null) onReact(row.messageId, option.kind);
                  }}
                  style={({ pressed }) => [
                    styles.choice,
                    own === option.kind && styles.selected,
                    disabled && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <AppText style={styles.emoji}>{option.emoji}</AppText>
                  <AppText variant="caption">
                    {option.label}
                    {own === option.kind ? ' ✓' : ''}
                  </AppText>
                </Pressable>
              ))}
            </View>
            {!online ? (
              <AppText variant="caption">
                Connect to change reactions. Replies can stay queued.
              </AppText>
            ) : row?.reactionPending ? (
              <AppText variant="caption" accessibilityLiveRegion="polite">
                Saving reaction…
              </AppText>
            ) : row?.context == null ? (
              <AppText variant="caption">
                Message details are loading. Refresh if they don’t appear.
              </AppText>
            ) : (
              <AppText variant="caption">
                Choose one. Tap your current reaction to remove it.
              </AppText>
            )}
            {row?.reactionError == null ? null : (
              <AppText variant="caption" style={styles.error} accessibilityRole="alert">
                {row.reactionError}
              </AppText>
            )}
            {row !== null && (row.reactionError !== null || row.context === null) ? (
              <Pressable
                accessibilityRole="button"
                disabled={!online || row.reactionPending}
                onPress={() => {
                  if (row.messageId !== null) onRefresh(row.messageId);
                }}
                style={styles.action}
              >
                <AppText variant="button">Refresh reaction</AppText>
              </Pressable>
            ) : null}
            {onReply === null || row?.messageId == null ? null : (
              <Pressable
                accessibilityRole="button"
                onPress={() => onReply(row.messageId!)}
                style={styles.action}
              >
                <AppText variant="button">Reply</AppText>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: `${colors.ink}66`,
    paddingHorizontal: 16,
    paddingTop: 32,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 16,
    gap: 12,
    maxHeight: '100%',
    flexShrink: 1,
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  preview: { color: colors.muted },
  choices: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  choice: {
    width: '30%',
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
    paddingVertical: 8,
  },
  selected: { borderColor: colors.plum, backgroundColor: colors.plumSoft },
  emoji: { fontSize: 26, lineHeight: 34 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
  action: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  error: { color: colors.danger },
});
