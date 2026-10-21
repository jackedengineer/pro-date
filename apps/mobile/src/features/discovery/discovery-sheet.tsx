import type { PropsWithChildren } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import X from 'lucide-react-native/icons/x';
import { IconButton } from '../../components/icon-button';
import { FormScrollView } from '../../components/form-scroll-view';
import { useReducedMotionPreference } from '../../theme/motion';

import { AppText } from '../../components/app-text';
import { Screen } from '../../components/screen';
import { spacing } from '../../theme/tokens';

export function DiscoverySheet({
  children,
  title,
  onClose,
  busy = false,
}: PropsWithChildren<{ title: string; onClose: () => void; busy?: boolean }>) {
  const reducedMotion = useReducedMotionPreference();
  return (
    <Modal
      animationType={reducedMotion ? 'none' : 'slide'}
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
          <IconButton label="Close" icon={X} onPress={onClose} disabled={busy} />
        </View>
        <FormScrollView contentContainerStyle={styles.content}>{children}</FormScrollView>
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
