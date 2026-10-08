import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../components/app-text';
import { colors, radii, spacing } from '../../theme/tokens';
import { EmptyState, ErrorNotice, QuietButton } from '../discovery/discovery-shared';
import { buildMergedInboxRows, type MergedInboxRow } from './merged-inbox-model';
import { MergedConversationRow } from './merged-inbox-row';
import { useMessaging } from './messaging-provider';
import { NotificationSettingsButton } from '../notifications/notification-settings-sheet';

const identify = (row: MergedInboxRow) => row.key;
const itemType = (row: MergedInboxRow) => row.type;
const position = { disabled: true };
export function MergedInbox({ onOpenConversation }: { onOpenConversation: (id: string) => void }) {
  const { runtime, error: runtimeError, retry } = useMessaging();
  const query = useInfiniteQuery({
    queryKey: ['conversations', runtime?.ownerId],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const page = await runtime!.api.conversations(pageParam, signal);
      void runtime!.storage.saveConversations(page.data).catch(() => {});
      return page;
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: runtime !== null,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
  const rows = useMemo(
    () =>
      buildMergedInboxRows(
        query.data?.pages.flatMap((page) => page.data) ?? [],
        runtime?.ownerId ?? '',
      ),
    [query.data, runtime?.ownerId],
  );
  const renderRow = useCallback(
    ({ item }: { item: MergedInboxRow }) =>
      item.type === 'header' ? (
        <View style={styles.section} accessibilityRole="header">
          <AppText variant="button">
            {item.turn === 'YOUR_TURN' ? 'Your turn' : 'Their turn'}
          </AppText>
          <AppText variant="caption" style={styles.count}>
            {item.count}
          </AppText>
        </View>
      ) : (
        <MergedConversationRow
          conversation={item.conversation}
          turn={item.turn}
          onOpen={onOpenConversation}
        />
      ),
    [onOpenConversation],
  );
  if (runtime === null)
    return (
      <View style={styles.center}>
        {runtimeError === null ? (
          <InboxLoading />
        ) : (
          <>
            <ErrorNotice message={runtimeError} />
            <QuietButton label="Retry opening Merged" onPress={retry} />
          </>
        )}
      </View>
    );
  const offline = query.fetchStatus === 'paused';
  return (
    <View style={styles.body}>
      <FlashList
        data={rows}
        keyExtractor={identify}
        getItemType={itemType}
        renderItem={renderRow}
        maintainVisibleContentPosition={position}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.intro}>
            <AppText style={styles.muted}>Mutual interest. Open threads.</AppText>
            <View style={styles.notifications}>
              <NotificationSettingsButton runtime={runtime} />
            </View>
            {offline ? (
              <AppText variant="caption" style={styles.muted}>
                Offline · showing connections saved on this device.
              </AppText>
            ) : null}
            <ErrorNotice message={query.error?.message ?? null} />
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            {offline ? (
              <EmptyState
                title="Your connections need a connection."
                body="Go online to load your merges. Conversations saved here will be available offline."
              />
            ) : query.isPending ? (
              <InboxLoading />
            ) : query.error === null ? (
              <EmptyState
                title="No merges. Yet."
                body="Send a pull request on something that caught your eye. Mutual interest lands here—no first message required."
              />
            ) : null}
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {query.hasNextPage ? (
              <AppText variant="caption" style={styles.muted}>
                Counts reflect loaded connections. Load more to see the rest.
              </AppText>
            ) : null}
            <QuietButton
              label={
                query.isFetchingNextPage
                  ? 'Loading…'
                  : query.error !== null
                    ? 'Retry loading connections'
                    : query.hasNextPage
                      ? 'Load more connections'
                      : 'Refresh connections'
              }
              disabled={query.isFetching || offline}
              onPress={() =>
                void (query.error !== null || !query.hasNextPage
                  ? query.refetch()
                  : query.fetchNextPage())
              }
            />
          </View>
        }
      />
    </View>
  );
}
function InboxLoading() {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading connections"
      style={styles.loading}
    >
      {[0, 1, 2].map((id) => (
        <View key={id} style={styles.skeletonRow}>
          <View style={styles.skeletonAvatar} />
          <View style={styles.skeletonText}>
            <View style={styles.skeletonName} />
            <View style={styles.skeletonLine} />
          </View>
        </View>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  body: { flex: 1 },
  content: { paddingBottom: spacing.lg },
  intro: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  muted: { color: colors.muted },
  notifications: { alignSelf: 'flex-start' },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  count: { color: colors.plum, fontVariant: ['tabular-nums'] },
  empty: { paddingHorizontal: spacing.lg },
  center: { padding: spacing.lg, gap: spacing.md },
  footer: { padding: spacing.lg, gap: spacing.md },
  loading: { gap: spacing.lg, paddingVertical: spacing.md },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  skeletonAvatar: {
    width: 56,
    height: 64,
    borderRadius: radii.md,
    backgroundColor: colors.plumSoft,
  },
  skeletonText: { flex: 1, gap: spacing.sm },
  skeletonName: {
    height: 16,
    width: '45%',
    borderRadius: spacing.xs,
    backgroundColor: colors.plumSoft,
  },
  skeletonLine: {
    height: 12,
    width: '80%',
    borderRadius: spacing.xs,
    backgroundColor: colors.plumSoft,
  },
});
