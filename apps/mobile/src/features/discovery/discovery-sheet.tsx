import type { PropsWithChildren } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '../../components/app-text';
import { Screen } from '../../components/screen';
import { spacing } from '../../theme/tokens';
import { QuietButton } from './discovery-shared';

export function DiscoverySheet({
  children,
  title,
  onClose,
  busy = false,
}: PropsWithChildren<{ title: string; onClose: () => void; busy?: boolean }>) {
  return (
    <Modal
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <Screen>
        <View style={styles.header}>
          <AppText style={styles.title} variant="button">
            {title}
          </AppText>
          <QuietButton label="Close" onPress={onClose} disabled={busy} />
        </View>
        <ScrollView
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          {children}
        </ScrollView>
      </Screen>
    </Modal>
  );
}
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  title: { flexShrink: 1 },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
});
