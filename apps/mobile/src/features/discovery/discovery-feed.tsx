import type { DiscoveryProfile, PullRequestTarget } from '@pro-date/contracts';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import type { DiscoveryActions, DiscoveryFilters } from '../../api/discovery';
import { AppText } from '../../components/app-text';
import { colors } from '../../theme/tokens';
import { DiscoveryProfileCard } from './discovery-profile-card';
import { EmptyState, ErrorNotice, QuietButton, sharedStyles } from './discovery-shared';
import { ProfileSafetySheet } from './profile-safety-sheet';
import { PullRequestComposer } from './pull-request-composer';
import { usePagedCollection } from './use-paged-collection';

const identifyProfile = (profile: DiscoveryProfile) => profile.userId;
export function DiscoveryFeed({
  actions,
  filters,
}: {
  actions: DiscoveryActions;
  filters: DiscoveryFilters;
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
          : 'We could not move to the next profile. Try again.',
      );
    } finally {
      passing.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <ScrollView
        key={profile?.userId ?? 'empty'}
        contentContainerStyle={sharedStyles.content}
        showsVerticalScrollIndicator={false}
      >
        {notice === null ? null : (
          <AppText accessibilityLiveRegion="polite" variant="caption">
            {notice}
          </AppText>
        )}
        <ErrorNotice message={list.error ?? actionError} />
        {list.loading ? (
          <View accessibilityRole="progressbar">
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
            <AppText style={sharedStyles.muted} variant="caption">
              Like a photo or prompt to send a pull request. Keep it specific; that’s where a good
              hello starts.
            </AppText>
            <QuietButton
              label={busy ? 'Moving on…' : 'Pass · see next profile'}
              onPress={() => void pass()}
              disabled={busy || list.loading}
            />
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
      {target === null || profile === undefined ? null : (
        <PullRequestComposer
          profile={profile}
          target={target}
          onClose={() => setTarget(null)}
          onSend={async (input) => {
            await actions.send(input);
            setTarget(null);
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
    </>
  );
}
