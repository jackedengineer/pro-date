import type { MessageQuote } from '@pro-date/contracts';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../components/app-text';
import { colors } from '../../theme/tokens';

export function QuotedMessage({ quote, light = false }: { quote: MessageQuote; light?: boolean }) {
  return (
    <View style={[styles.quote, light && styles.lightBorder]}>
      <AppText variant="caption" style={light ? styles.light : styles.label}>
        Replying to a message
      </AppText>
      <AppText numberOfLines={2} style={light ? styles.light : undefined}>
        {quote.excerpt}
      </AppText>
    </View>
  );
}
const styles = StyleSheet.create({
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.plum,
    paddingLeft: 10,
    paddingVertical: 4,
    marginBottom: 8,
    gap: 2,
    flexShrink: 1,
  },
  label: { color: colors.plum },
  lightBorder: { borderLeftColor: colors.white },
  light: { color: colors.white },
});
