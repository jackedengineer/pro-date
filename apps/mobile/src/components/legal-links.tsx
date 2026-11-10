import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { legalLinks } from '../config/legal';
import { colors, hairline, spacing, touchTarget, typography } from '../theme/tokens';
import { AppText } from './app-text';

function open(url: string) {
  // A missing browser must not crash a settings screen.
  void Linking.openURL(url).catch(() => {});
}

const rows = [
  { label: 'Privacy policy', url: legalLinks.privacy },
  { label: 'Terms of use', url: legalLinks.terms },
  { label: 'Safety standards', url: legalLinks.safety },
  { label: 'Help and contact', url: legalLinks.support },
] as const;

/** The public pages, as a short list for a settings area. */
export function LegalLinkList() {
  return (
    <View style={styles.list}>
      {rows.map((row, index) => (
        <Pressable
          key={row.url}
          accessibilityRole="link"
          accessibilityLabel={row.label}
          accessibilityHint="Opens in your browser"
          onPress={() => open(row.url)}
          style={({ pressed }) => [
            styles.row,
            index > 0 && styles.divider,
            pressed && styles.pressed,
          ]}
        >
          <AppText>{row.label}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

/** The sentence shown before an account exists: age, terms and privacy in one line. */
export function LegalNotice() {
  return (
    <AppText style={styles.notice} variant="caption">
      By continuing, you confirm you’re 18 or older and agree to the{' '}
      <AppText
        accessibilityRole="link"
        onPress={() => open(legalLinks.terms)}
        style={styles.link}
        variant="caption"
      >
        Terms
      </AppText>{' '}
      and{' '}
      <AppText
        accessibilityRole="link"
        onPress={() => open(legalLinks.privacy)}
        style={styles.link}
        variant="caption"
      >
        Privacy Policy
      </AppText>
      .
    </AppText>
  );
}

const styles = StyleSheet.create({
  divider: { borderTopColor: colors.border, borderTopWidth: hairline },
  link: { color: colors.plum, fontFamily: typography.family.medium },
  list: {},
  notice: { textAlign: 'center' },
  pressed: { backgroundColor: colors.sand },
  row: { justifyContent: 'center', minHeight: touchTarget + 4, paddingVertical: spacing.sm },
});
