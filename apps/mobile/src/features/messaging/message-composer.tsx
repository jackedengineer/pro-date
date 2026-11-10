import { useEffect, useRef, useState } from 'react';
import type { MessageQuote } from '@pro-date/contracts';
import X from 'lucide-react-native/icons/x';
import { IconButton } from '../../components/icon-button';
import { QuotedMessage } from './message-quote';
import { StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import { PressableScale } from '../../components/pressable-scale';
import ArrowUp from 'lucide-react-native/icons/arrow-up';
import { AppText } from '../../components/app-text';
import { colors, hairline, touchTarget, typography } from '../../theme/tokens';

export function MessageComposer({
  onSend,
  disabled,
  bottomInset,
  replyTo = null,
  onCancelReply,
}: {
  onSend: (body: string) => Promise<void>;
  disabled: boolean;
  bottomInset: number;
  replyTo?: MessageQuote | null;
  onCancelReply?: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef('');
  const guard = useRef(false);
  const input = useRef<TextInputInstance>(null);
  useEffect(() => {
    if (replyTo !== null) input.current?.focus();
  }, [replyTo]);
  const send = async () => {
    const text = current.current.trim();
    if (text.length === 0 || disabled || guard.current) return;
    guard.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSend(text);
      // New text typed while SQLite saves belongs to the next message, never discard it.
      if (current.current.trim() === text) {
        current.current = '';
        setDraft('');
      }
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : 'Couldn’t save this message.');
    } finally {
      guard.current = false;
      setSaving(false);
    }
  };
  return (
    <View style={[styles.container, { paddingBottom: Math.max(10, bottomInset) }]}>
      {replyTo === null ? null : (
        <View style={styles.reply}>
          <View style={styles.quote}>
            <QuotedMessage quote={replyTo} />
          </View>
          <IconButton label="Cancel reply" icon={X} onPress={onCancelReply} />
        </View>
      )}
      {error === null ? null : (
        <AppText accessibilityRole="alert" style={styles.error} variant="caption">
          {error}
        </AppText>
      )}
      <View style={styles.row}>
        <TextInput
          ref={input}
          accessibilityLabel="Message"
          value={draft}
          onChangeText={(text) => {
            current.current = text;
            setDraft(text);
          }}
          editable={!disabled}
          multiline
          maxLength={2000}
          submitBehavior="newline"
          placeholder="Message"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: disabled || saving || draft.trim().length === 0 }}
          disabled={disabled || saving || draft.trim().length === 0}
          onPress={() => void send()}
          style={[
            styles.send,
            (disabled || saving || draft.trim().length === 0) && styles.disabled,
          ]}
          pressedStyle={styles.pressed}
        >
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <ArrowUp size={24} color={colors.white} strokeWidth={2} />
          </View>
        </PressableScale>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderTopWidth: hairline,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  reply: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quote: { flex: 1 },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 144,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderCurve: 'continuous',
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    fontFamily: typography.family.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  send: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: colors.plum,
  },
  disabled: { backgroundColor: colors.border },
  pressed: { backgroundColor: colors.plumPressed },
  error: { color: colors.danger, marginBottom: 8 },
});
