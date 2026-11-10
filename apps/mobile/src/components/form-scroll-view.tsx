import type { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

/**
 * A scrolling form that stays usable with the keyboard up.
 *
 * Without a footer, iOS uses native scroll insets and Android resizes the form. With a `footer`,
 * the footer is pinned under the scroll area and the whole form lifts with the keyboard, so the
 * form's actions are never hidden behind it. Never apply both iOS strategies at once.
 */
export function FormScrollView({
  children,
  contentContainerStyle,
  footer,
}: PropsWithChildren<{
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Actions that must stay in view while typing, such as Continue. */
  footer?: ReactNode;
}>) {
  const pinned = footer !== undefined;
  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'android' ? 'height' : pinned ? 'padding' : undefined}
    >
      <ScrollView
        automaticallyAdjustKeyboardInsets={!pinned}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, contentContainerStyle]}
      >
        {children}
      </ScrollView>
      {pinned ? <View style={styles.footer}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: 24, gap: 24 },
  footer: { gap: 8, paddingTop: 8 },
});
