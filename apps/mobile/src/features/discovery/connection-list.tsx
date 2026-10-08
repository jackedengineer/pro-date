import type { DiscoveryProfile, IncomingPullRequest, Match } from '@pro-date/contracts';
import { Image } from 'expo-image';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import type { DiscoveryActions } from '../../api/discovery';
import { AppButton } from '../../components/app-button';
import { AppText } from '../../components/app-text';
import { colors, radii } from '../../theme/tokens';
import { DiscoveryProfileCard, TargetPreview } from './discovery-profile-card';
import { EmptyState, ErrorNotice, QuietButton, sharedStyles } from './discovery-shared';
import { DiscoverySheet } from './discovery-sheet';
import { ProfileSafetySheet } from './profile-safety-sheet';
import { usePagedCollection } from './use-paged-collection';

const identifyConnection = (item: IncomingPullRequest | Match) => item.id;

export function ConnectionList({
  actions,
  kind,
  onOpenConversation,
}: {
  actions: DiscoveryActions;
  kind: 'requests' | 'matches';
  onOpenConversation?: (id: string) => void;
}) {
  const load = useCallback(
    (cursor?: string) =>
      kind === 'requests' ? actions.inbox(cursor) : actions.listMatches(cursor),
    [actions, kind],
  );
  const list = usePagedCollection<IncomingPullRequest | Match>(load, identifyConnection);
  const [selected, setSelected] = useState<DiscoveryProfile | null>(null);
  const [safety, setSafety] = useState<DiscoveryProfile | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const reviewing = useRef(false);
  const respond = async (id: string, decision: 'MERGED' | 'DECLINED') => {
    if (reviewing.current) return;
    reviewing.current = true;
    setBusyId(id);
    setError(null);
    try {
      await actions.respond(id, decision);
      list.remove(id);
      setNotice(
        decision === 'MERGED' ? 'Merged. Find your new connection in Merged.' : 'Request declined.',
      );
      if (list.items.length === 1 && list.hasMore) await list.loadMore();
    } catch (failure: unknown) {
      setError(
        failure instanceof Error ? failure.message : 'We could not save your response. Try again.',
      );
    } finally {
      reviewing.current = false;
      setBusyId(null);
    }
  };
  return (
    <>
      <ScrollView contentContainerStyle={sharedStyles.content} showsVerticalScrollIndicator={false}>
        <AppText style={sharedStyles.muted}>
          {kind === 'requests'
            ? 'A like on something you shared. Merge to make it mutual.'
            : 'You both chose the connection. Take the conversation somewhere good.'}
        </AppText>
        {notice === null ? null : (
          <AppText accessibilityLiveRegion="polite" variant="caption">
            {notice}
          </AppText>
        )}
        <ErrorNotice message={error ?? list.error} />
        {list.loading ? (
          <View accessibilityRole="progressbar">
            <ActivityIndicator color={colors.plum} />
          </View>
        ) : null}
        {!list.loading && list.items.length === 0 && list.error === null ? (
          <EmptyState
            title={
              kind === 'requests'
                ? 'Your next hello starts here.'
                : 'Good chemistry, mutually approved.'
            }
            body={
              kind === 'requests'
                ? 'When someone likes a photo or prompt, their pull request will land here.'
                : 'Accept a pull request to create your first connection.'
            }
          />
        ) : null}
        {list.items.map((item) => {
          const profile = 'sender' in item ? item.sender : item.profile;
          const pending = 'sender' in item;
          return (
            <View key={item.id} style={sharedStyles.card}>
              <View style={sharedStyles.row}>
                <Image
                  accessibilityLabel={`${profile.displayName}'s lead photo`}
                  contentFit="cover"
                  source={profile.photos[0]?.deliveryUrl ?? null}
                  style={styles.avatar}
                />
                <View style={styles.name}>
                  <AppText variant="button">
                    {profile.displayName}, {profile.age}
                  </AppText>
                  <AppText variant="caption">
                    {pending
                      ? `Liked your ${item.target.type === 'PHOTO' ? 'photo' : 'prompt'}`
                      : 'Merged'}{' '}
                    · {profile.locationLabel}
                  </AppText>
                </View>
              </View>
              {pending ? (
                <>
                  <TargetPreview target={item.target} />
                  {item.comment.length === 0 ? null : <AppText>“{item.comment}”</AppText>}
                </>
              ) : onOpenConversation === undefined ? null : (
                <AppButton
                  label={`Message ${profile.displayName}`}
                  onPress={() => onOpenConversation(item.id)}
                />
              )}
              <QuietButton
                label={`View ${profile.displayName}'s profile`}
                onPress={() => setSelected(profile)}
                disabled={busyId !== null}
              />
              {pending ? (
                <>
                  <AppButton
                    label={busyId === item.id ? 'Saving…' : 'Merge'}
                    accessibilityLabel={`Merge request from ${profile.displayName}`}
                    disabled={busyId !== null}
                    onPress={() => void respond(item.id, 'MERGED')}
                  />
                  <QuietButton
                    label={`Decline request from ${profile.displayName}`}
                    disabled={busyId !== null}
                    onPress={() => void respond(item.id, 'DECLINED')}
                  />
                </>
              ) : null}
              <QuietButton
                label={`Report or block ${profile.displayName}`}
                onPress={() => setSafety(profile)}
                disabled={busyId !== null}
              />
            </View>
          );
        })}
        <QuietButton
          label={
            list.hasMore
              ? `Load more ${kind === 'requests' ? 'requests' : 'connections'}`
              : kind === 'requests'
                ? 'Refresh requests'
                : 'Refresh connections'
          }
          disabled={list.loading || busyId !== null}
          onPress={() => void (list.hasMore ? list.loadMore() : list.refresh())}
        />
      </ScrollView>
      {selected === null ? null : (
        <DiscoverySheet
          title={`${selected.displayName}'s profile`}
          onClose={() => setSelected(null)}
        >
          <DiscoveryProfileCard profile={selected} />
          <QuietButton
            label="Report or block"
            onPress={() => {
              setSafety(selected);
              setSelected(null);
            }}
          />
        </DiscoverySheet>
      )}
      {safety === null ? null : (
        <ProfileSafetySheet
          profile={safety}
          actions={actions}
          onClose={() => setSafety(null)}
          onSaved={(message) => {
            list.items
              .filter(
                (item) =>
                  ('sender' in item ? item.sender.userId : item.profile.userId) === safety.userId,
              )
              .forEach((item) => list.remove(item.id));
            setSafety(null);
            setNotice(message);
          }}
        />
      )}
    </>
  );
}
const styles = StyleSheet.create({
  avatar: { width: 64, height: 80, borderRadius: radii.sm, backgroundColor: colors.plumSoft },
  name: { flex: 1 },
});
