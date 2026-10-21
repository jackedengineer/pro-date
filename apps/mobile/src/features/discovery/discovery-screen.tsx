import { useState, type ReactNode } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import Compass from 'lucide-react-native/icons/compass';
import GitPullRequest from 'lucide-react-native/icons/git-pull-request';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import UserRound from 'lucide-react-native/icons/user-round';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import { IconButton } from '../../components/icon-button';

import type { DiscoveryActions, DiscoveryFilters } from '../../api/discovery';
import { AppText } from '../../components/app-text';
import { Screen } from '../../components/screen';
import { colors, spacing } from '../../theme/tokens';
import { ConnectionList } from './connection-list';
import { DiscoveryFeed } from './discovery-feed';
import { DiscoveryFiltersSheet } from './discovery-filters-sheet';

const tabs = [
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'requests', label: 'Requests', icon: GitPullRequest },
  { id: 'merged', label: 'Merged', icon: MessageCircle },
] as const;
export type DiscoveryTab = (typeof tabs)[number]['id'];
export function DiscoveryScreen({
  actions,
  onOpenProfile,
  mergedInbox,
  onMerged,
  selectedTab,
  onTabChange,
}: {
  actions: DiscoveryActions;
  onOpenProfile: () => void;
  mergedInbox: ReactNode;
  onMerged?: (id: string) => void;
  selectedTab?: DiscoveryTab;
  onTabChange?: (tab: DiscoveryTab) => void;
}) {
  const [localTab, setLocalTab] = useState<DiscoveryTab>('discover');
  const tab = selectedTab ?? localTab;
  const selectTab = (value: DiscoveryTab) => {
    if (selectedTab === undefined) setLocalTab(value);
    onTabChange?.(value);
  };
  const handleMerged = (id: string) => {
    Keyboard.dismiss();
    onMerged?.(id);
    selectTab('merged');
  };
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
          {tab === 'discover' ? 'Merge' : tab === 'requests' ? 'Pull requests' : 'Merged'}
        </AppText>
        <IconButton label="My profile" icon={UserRound} onPress={onOpenProfile} />
      </View>
      {tab === 'discover' ? (
        <View style={styles.filters}>
          <AppText style={styles.filterText} variant="caption">
            Within {filters.radiusKm} km · Ages {filters.minAge}–{filters.maxAge}
          </AppText>
          <IconButton
            label="Preferences"
            icon={SlidersHorizontal}
            onPress={() => setShowFilters(true)}
          />
        </View>
      ) : null}
      <View style={styles.body}>
        {tab === 'discover' ? (
          <DiscoveryFeed
            key={`${filters.radiusKm}:${filters.minAge}:${filters.maxAge}`}
            actions={actions}
            filters={filters}
            onMerged={handleMerged}
          />
        ) : tab === 'requests' ? (
          <ConnectionList actions={actions} onMerged={handleMerged} />
        ) : (
          mergedInbox
        )}
      </View>
      <View style={styles.tabs}>
        {tabs.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: tab === item.id }}
            onPress={() => selectTab(item.id)}
            style={({ pressed }) => [
              styles.tab,
              tab === item.id && styles.activeTab,
              pressed && styles.pressed,
            ]}
          >
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <item.icon
                size={22}
                color={tab === item.id ? colors.plum : colors.muted}
                strokeWidth={tab === item.id ? 2.2 : 1.7}
              />
            </View>
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
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  activeTab: { backgroundColor: colors.plumSoft },
  pressed: { opacity: 0.65 },
  activeLabel: { color: colors.plum },
});
