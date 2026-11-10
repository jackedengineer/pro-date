import type { DiscoveryProfile, PullRequestTarget } from '@pro-date/contracts';
import { useCallback, useRef, useState } from 'react';
import X from 'lucide-react-native/icons/x';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { DiscoveryActions, DiscoveryFilters } from '../../api/discovery';
import { AppText } from '../../components/app-text';
import { cardShadow, colors, hairline, radii, spacing } from '../../theme/tokens';
import { DiscoveryProfileCard } from './discovery-profile-card';
import { EmptyState, ErrorNotice, QuietButton, sharedStyles } from './discovery-shared';
import { ProfileSafetySheet } from './profile-safety-sheet';
import { PullRequestComposer } from './pull-request-composer';
import { usePagedCollection } from './use-paged-collection';

const identifyProfile = (profile: DiscoveryProfile) => profile.userId;
export function DiscoveryFeed({
  actions,
  filters,
  onMerged,
}: {
  actions: DiscoveryActions;
  filters: DiscoveryFilters;
  onMerged: (id: string) => void;
}) {
  const load = useCallback(
    (cursor?: string) => actions.browse(filters, cursor),
    [actions, filters],
  );
  const list = usePagedCollection(load, identifyProfile);
  const profile = list.items[0];
  const [target, setTarget] = useState<PullRequestTarget | null>(null);
  const [showSafety, setShowSafety] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const passing = useRef(false);
  const advance = async (id: string) => {
    list.remove(id);
    if (list.items.length === 1 && list.hasMore) await list.loadMore();
  };
  const pass = async () => {
    if (profile === undefined || passing.current) return;
    passing.current = true;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await actions.pass(profile.userId);
      await advance(profile.userId);
    } catch (failure: unknown) {
      setActionError(
        failure instanceof Error
          ? failure.message
          : 'Couldn’t move to the next profile. Try again.',
      );
    } finally {
      passing.current = false;
      setBusy(false);
    }
  };
  return (
    <View style={styles.feed}>
      <ScrollView
        key={profile?.userId ?? 'empty'}
        contentContainerStyle={[sharedStyles.content, profile !== undefined && styles.clearPass]}
        showsVerticalScrollIndicator={false}
      >
        {notice === null ? null : (
          <AppText accessibilityLiveRegion="polite" variant="caption">
            {notice}
          </AppText>
        )}
        <ErrorNotice message={list.error ?? actionError} />
        {list.loading ? (
          <View accessibilityRole="progressbar" style={styles.loading}>
            <ActivityIndicator color={colors.plum} />
            <AppText variant="caption">Finding your kind of people…</AppText>
          </View>
        ) : null}
        {profile === undefined ? (
          <>
            {!list.loading && list.error === null ? (
              <EmptyState
                title="You’re all caught up."
                body="No new profiles match these preferences yet. Try a wider distance, or come back when more people have joined."
              />
            ) : null}
            <QuietButton
              label={list.hasMore ? 'Load more profiles' : 'Refresh discovery'}
              disabled={list.loading}
              onPress={() => void (list.hasMore ? list.loadMore() : list.refresh())}
            />
          </>
        ) : (
          <>
            <DiscoveryProfileCard
              profile={profile}
              onLike={
                list.loading || busy
                  ? undefined
                  : (value) => {
                      setTarget(value);
                      setActionError(null);
                    }
              }
            />
            <AppText style={styles.hint} variant="caption">
              Like a photo or an answer to send a pull request. A specific like makes the best
              hello.
            </AppText>
            <QuietButton
              label="Report or block"
              onPress={() => setShowSafety(true)}
              disabled={busy}
            />
            {list.error === null && actionError === null ? null : (
              <QuietButton label="Refresh discovery" onPress={() => void list.refresh()} />
            )}
          </>
        )}
      </ScrollView>
      {profile === undefined ? null : (
        // Passing is the most-used action here, so it stays in reach instead of below the fold.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={busy ? 'Moving on…' : 'Pass · see next profile'}
          accessibilityState={{ disabled: busy || list.loading, busy }}
          disabled={busy || list.loading}
          hitSlop={8}
          onPress={() => void pass()}
          style={({ pressed }) => [
            styles.pass,
            pressed && styles.passPressed,
            (busy || list.loading) && styles.passDisabled,
          ]}
        >
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {busy ? (
              <ActivityIndicator color={colors.muted} size="small" />
            ) : (
              <X color={colors.ink} size={26} strokeWidth={1.8} />
            )}
          </View>
        </Pressable>
      )}
      {target === null || profile === undefined ? null : (
        <PullRequestComposer
          profile={profile}
          target={target}
          onClose={() => setTarget(null)}
          onSend={async (input) => {
            const receipt = await actions.send(input);
            setTarget(null);
            if (receipt.status === 'MERGED' && receipt.matchId !== null) {
              list.remove(profile.userId);
              onMerged(receipt.matchId);
              return;
            }
            setNotice('Pull request sent. The next move is theirs.');
            await advance(profile.userId);
          }}
        />
      )}
      {!showSafety || profile === undefined ? null : (
        <ProfileSafetySheet
          profile={profile}
          actions={actions}
          onClose={() => setShowSafety(false)}
          onSaved={(message) => {
            setShowSafety(false);
            setNotice(message);
            void advance(profile.userId);
          }}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  feed: { flex: 1 },
  clearPass: { paddingBottom: 112 },
  loading: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  hint: { textAlign: 'center', paddingHorizontal: spacing.md },
  pass: {
    position: 'absolute',
    left: spacing.lg,
    bottom: spacing.md,
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: hairline,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  passPressed: { backgroundColor: colors.sand, transform: [{ scale: 0.94 }] },
  passDisabled: { opacity: 0.6 },
});
