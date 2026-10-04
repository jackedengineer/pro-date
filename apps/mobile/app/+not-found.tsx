import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '../src/components/app-text';
import { Screen } from '../src/components/screen';
import { colors, spacing } from '../src/theme/tokens';

export default function NotFoundRoute() {
  return (
    <Screen style={styles.screen}>
      <View style={styles.content}>
        <AppText variant="eyebrow">404</AppText>
        <AppText variant="display">That page wandered off.</AppText>
        <Link accessibilityRole="link" href="/" style={styles.link}>
          Return home
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
  },
  link: {
    color: colors.coralPressed,
    fontSize: 16,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  screen: {
    justifyContent: 'center',
    padding: spacing.lg,
  },
});
