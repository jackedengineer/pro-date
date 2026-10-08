import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { DiscoveryActions, DiscoveryFilters } from '../../api/discovery';
import { AppText } from '../../components/app-text';
import { Screen } from '../../components/screen';
import { colors, spacing } from '../../theme/tokens';
import { ConnectionList } from './connection-list';
import { DiscoveryFeed } from './discovery-feed';
import { DiscoveryFiltersSheet } from './discovery-filters-sheet';
import { QuietButton } from './discovery-shared';

const tabs = [
  { id: 'discover', label: 'Discover', icon: '⌕' },
  { id: 'requests', label: 'Requests', icon: '⑂' },
  { id: 'matches', label: 'Merged', icon: '✓' },
] as const;
export function DiscoveryScreen({
  actions,
  onOpenProfile,
}: {
  actions: DiscoveryActions;
  onOpenProfile: () => void;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]['id']>('discover');
  const [filters, setFilters] = useState<DiscoveryFilters>({
    radiusKm: 50,
    minAge: 18,
    maxAge: 99,
  });
  const [showFilters, setShowFilters] = useState(false);
  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title" style={styles.headerTitle}>
          {tab === 'discover' ? 'ProDate' : tab === 'requests' ? 'Pull requests' : 'Merged'}
        </AppText>
        <QuietButton label="My profile" onPress={onOpenProfile} />
      </View>
      {tab === 'discover' ? (
        <View style={styles.filters}>
          <AppText style={styles.filterText} variant="caption">
            Within {filters.radiusKm} km · Ages {filters.minAge}–{filters.maxAge}
          </AppText>
          <QuietButton label="Preferences" onPress={() => setShowFilters(true)} />
        </View>
      ) : null}
      <View style={styles.body}>
        {tab === 'discover' ? (
          <DiscoveryFeed
            key={`${filters.radiusKm}:${filters.minAge}:${filters.maxAge}`}
            actions={actions}
            filters={filters}
          />
        ) : (
          <ConnectionList
            key={tab}
            actions={actions}
            kind={tab === 'requests' ? 'requests' : 'matches'}
          />
        )}
      </View>
      <View style={styles.tabs}>
        {tabs.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: tab === item.id }}
            onPress={() => setTab(item.id)}
            style={({ pressed }) => [
              styles.tab,
              tab === item.id && styles.activeTab,
              pressed && styles.pressed,
            ]}
          >
            <AppText style={styles.icon} accessibilityElementsHidden>
              {item.icon}
            </AppText>
            <AppText style={tab === item.id ? styles.activeLabel : undefined} variant="caption">
              {item.label}
            </AppText>
          </Pressable>
        ))}
      </View>
      {showFilters ? (
        <DiscoveryFiltersSheet
          filters={filters}
          onClose={() => setShowFilters(false)}
          onApply={(value) => {
            setFilters(value);
            setShowFilters(false);
          }}
        />
      ) : null}
    </Screen>
  );
}
const styles = StyleSheet.create({
  headerTitle: { flexShrink: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  filterText: { flexShrink: 1 },
  body: { flex: 1 },
  tabs: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: spacing.sm,
  },
  activeTab: { backgroundColor: colors.plumSoft },
  pressed: { opacity: 0.65 },
  icon: { fontSize: 24, lineHeight: 28, color: colors.plum },
  activeLabel: { color: colors.plum },
});
