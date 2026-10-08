import { discoveryQuerySchema } from '@pro-date/contracts';
import { useState } from 'react';
import { Keyboard, StyleSheet, TextInput, View } from 'react-native';

import type { DiscoveryFilters } from '../../api/discovery';
import { AppButton } from '../../components/app-button';
import { AppText } from '../../components/app-text';
import { colors, radii, spacing, typography } from '../../theme/tokens';
import { DiscoverySheet } from './discovery-sheet';
import { ErrorNotice, QuietButton } from './discovery-shared';

export function DiscoveryFiltersSheet({
  filters,
  onClose,
  onApply,
}: {
  filters: DiscoveryFilters;
  onClose: () => void;
  onApply: (filters: DiscoveryFilters) => void;
}) {
  const [radiusKm, setRadiusKm] = useState(filters.radiusKm);
  const [minAge, setMinAge] = useState(filters.minAge.toString());
  const [maxAge, setMaxAge] = useState(filters.maxAge.toString());
  const [error, setError] = useState<string | null>(null);
  return (
    <DiscoverySheet title="Your discovery preferences" onClose={onClose}>
      <AppText variant="title">Find your kind of people.</AppText>
      <AppText>
        Your dating preferences apply in both directions. Your exact location stays private.
      </AppText>
      <AppText variant="button">Maximum distance</AppText>
      <View style={styles.radii}>
        {[25, 50, 100, 200].map((value) => (
          <View style={radiusKm === value ? styles.selected : undefined} key={value}>
            <QuietButton label={`${value} km`} onPress={() => setRadiusKm(value)} />
          </View>
        ))}
      </View>
      <AppText variant="button">Age range</AppText>
      <View style={styles.ageRow}>
        <View style={styles.ageField}>
          <AppText variant="caption">From</AppText>
          <TextInput
            accessibilityLabel="Minimum age"
            keyboardType="number-pad"
            maxLength={2}
            value={minAge}
            onChangeText={setMinAge}
            style={styles.input}
          />
        </View>
        <View style={styles.ageField}>
          <AppText variant="caption">To</AppText>
          <TextInput
            accessibilityLabel="Maximum age"
            keyboardType="number-pad"
            maxLength={2}
            value={maxAge}
            onChangeText={setMaxAge}
            style={styles.input}
          />
        </View>
      </View>
      <QuietButton label="Done with age range" onPress={() => Keyboard.dismiss()} />
      <ErrorNotice message={error} />
      <AppButton
        label="Apply preferences"
        onPress={() => {
          const input = discoveryQuerySchema.safeParse({ radiusKm, minAge, maxAge });
          if (!input.success) {
            setError('Choose an age range between 18 and 99, with the lower age first.');
            return;
          }
          Keyboard.dismiss();
          onApply({
            radiusKm: input.data.radiusKm,
            minAge: input.data.minAge,
            maxAge: input.data.maxAge,
          });
        }}
      />
    </DiscoverySheet>
  );
}
const styles = StyleSheet.create({
  radii: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  selected: { backgroundColor: colors.plumSoft, borderRadius: radii.pill },
  ageRow: { flexDirection: 'row', gap: spacing.md },
  ageField: { flex: 1, gap: spacing.sm },
  input: {
    minHeight: 56,
    padding: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontFamily: typography.family.body,
    fontSize: 18,
  },
});
