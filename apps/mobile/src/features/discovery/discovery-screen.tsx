import { useState, type ReactNode } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import Compass from 'lucide-react-native/icons/compass';
import GitPullRequest from 'lucide-react-native/icons/git-pull-request';
import GitMerge from 'lucide-react-native/icons/git-merge';
import UserRound from 'lucide-react-native/icons/user-round';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconButton } from '../../components/icon-button';

import type { DiscoveryActions, DiscoveryFilters } from '../../api/discovery';
import { AppText } from '../../components/app-text';
import { Screen } from '../../components/screen';
import { colors, hairline, spacing, typography } from '../../theme/tokens';
import { ConnectionList } from './connection-list';
import type { DiscoveryTab } from './discovery-tabs';
import { DiscoveryFeed } from './discovery-feed';
import { DiscoveryFiltersSheet } from './discovery-filters-sheet';

const screenEdges = ['top', 'left', 'right'] as const;
const tabBarEdges = ['bottom', 'left', 'right'] as const;
const tabs = [
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'requests', label: 'Requests', icon: GitPullRequest },
  { id: 'merged', label: 'Merged', icon: GitMerge },
  { id: 'profile', label: 'Profile', icon: UserRound },
] as const satisfies readonly { id: DiscoveryTab; label: string; icon: unknown }[];
export type { DiscoveryTab };
const titles: Record<DiscoveryTab, string> = {
  discover: 'Merge',
  requests: 'Pull requests',
  merged: 'Merged',
  profile: 'Profile',
};
export function DiscoveryScreen({
  actions,
  profile,
  mergedInbox,
  onMerged,
  selectedTab,
  onTabChange,
}: {
  actions: DiscoveryActions;
  /** The member's own profile, shown under the Profile tab. */
  profile: ReactNode;
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
    // The tab bar owns the bottom inset, so its surface runs to the edge of the screen.
    <Screen edges={screenEdges}>
      <View style={styles.header}>
        <AppText variant="largeTitle" numberOfLines={1} style={styles.headerTitle}>
          {titles[tab]}
        </AppText>
      </View>
      {tab === 'discover' ? (
        <View style={styles.filters}>
          <AppText style={styles.filterText} variant="caption" numberOfLines={1}>
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
        ) : tab === 'merged' ? (
          mergedInbox
        ) : (
          profile
        )}
      </View>
      <SafeAreaView edges={tabBarEdges} style={styles.tabBar}>
        <View style={styles.tabs} accessibilityRole="tablist">
          {tabs.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: tab === item.id }}
              onPress={() => selectTab(item.id)}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <item.icon
                  size={24}
                  color={tab === item.id ? colors.plum : colors.muted}
                  strokeWidth={tab === item.id ? 2.2 : 1.7}
                />
              </View>
              <AppText
                numberOfLines={1}
                style={[styles.tabLabel, tab === item.id && styles.activeLabel]}
                variant="caption"
              >
                {item.label}
              </AppText>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
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
    paddingBottom: spacing.xs,
    gap: spacing.md,
  },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.lg,
    paddingRight: spacing.md,
    gap: spacing.sm,
  },
  filterText: { flexShrink: 1 },
  body: { flex: 1 },
  // A platform tab bar: icon over label, no pill, no slide between peers.
  tabBar: {
    borderTopWidth: hairline,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabs: { flexDirection: 'row' },
  tab: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: 2,
  },
  tabLabel: { fontSize: 11, lineHeight: 14, fontFamily: typography.family.medium },
  pressed: { opacity: 0.6 },
  activeLabel: { color: colors.plum },
});
