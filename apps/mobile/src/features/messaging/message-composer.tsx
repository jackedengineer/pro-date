import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText } from '../../components/app-text';
import { colors, typography } from '../../theme/tokens';

export function MessageComposer({
  onSend,
  disabled,
  bottomInset,
}: {
  onSend: (body: string) => Promise<void>;
  disabled: boolean;
  bottomInset: number;
}) {
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef('');
  const guard = useRef(false);
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
      setError(failure instanceof Error ? failure.message : 'We couldn’t save this message.');
    } finally {
      guard.current = false;
      setSaving(false);
    }
  };
  return (
    <View style={[styles.container, { paddingBottom: Math.max(10, bottomInset) }]}>
      {error === null ? null : (
        <AppText accessibilityRole="alert" style={styles.error} variant="caption">
          {error}
        </AppText>
      )}
      <View style={styles.row}>
        <TextInput
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
          placeholder="A good hello goes a long way."
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: disabled || saving || draft.trim().length === 0 }}
          disabled={disabled || saving || draft.trim().length === 0}
          onPress={() => void send()}
          style={({ pressed }) => [
            styles.send,
            (disabled || saving || draft.trim().length === 0) && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <AppText style={styles.arrow} accessibilityElementsHidden>
            ↑
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 144,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: typography.family.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  send: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: colors.plum,
  },
  arrow: { color: colors.white, fontSize: 28, lineHeight: 34 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  error: { color: colors.danger, marginBottom: 8 },
});
