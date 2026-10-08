import type { Conversation } from '@pro-date/contracts';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../components/app-text';
import { Screen } from '../../components/screen';
import { colors } from '../../theme/tokens';
import { EmptyState, ErrorNotice, QuietButton } from '../discovery/discovery-shared';
import { useMessaging } from './messaging-provider';

const identify = (row: Conversation) => row.id;
export function MessagingInbox() {
  const { runtime } = useMessaging();
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
  const conversations = [
    ...new Map(query.data?.pages.flatMap((page) => page.data).map((row) => [row.id, row])).values(),
  ];
  return (
    <Screen>
      <View style={styles.header}>
        <QuietButton label="Back to discovery" onPress={() => router.replace('/discover')} />
        <AppText variant="title">Messages</AppText>
      </View>
      <AppText style={styles.intro}>The merge was mutual. Make the hello yours.</AppText>
      {query.fetchStatus === 'paused' ? (
        <AppText style={styles.intro} variant="caption">
          Offline · showing conversations saved on this device.
        </AppText>
      ) : null}
      <ErrorNotice message={query.error?.message ?? null} />
      {query.isPending ? <ActivityIndicator color={colors.plum} /> : null}
      <FlashList
        data={conversations}
        keyExtractor={identify}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Message ${item.member.displayName}`}
            onPress={() => router.push({ pathname: '/messages/[id]', params: { id: item.id } })}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <Image
              source={item.member.photoUrl}
              contentFit="cover"
              style={styles.avatar}
              recyclingKey={item.member.userId}
            />
            <View style={styles.summary}>
              <AppText variant="button">{item.member.displayName}</AppText>
              <AppText numberOfLines={2} variant="caption">
                {item.lastMessage === null
                  ? 'Your conversation starts here.'
                  : `${item.lastMessage.senderId === runtime?.ownerId ? 'You: ' : ''}${item.lastMessage.body}`}
              </AppText>
            </View>
            <AppText variant="caption">
              {new Date(item.activityAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </AppText>
          </Pressable>
        )}
        ListEmptyComponent={
          !query.isPending && query.error === null ? (
            <View style={styles.empty}>
              <EmptyState
                title="Good chemistry, mutually approved."
                body="Merge a pull request to start a private conversation. No random DMs."
              />
            </View>
          ) : null
        }
        ListFooterComponent={
          <QuietButton
            label={
              query.isFetchingNextPage
                ? 'Loading…'
                : query.hasNextPage
                  ? 'Load more conversations'
                  : 'Refresh conversations'
            }
            disabled={query.isFetching}
            onPress={() => void (query.hasNextPage ? query.fetchNextPage() : query.refetch())}
          />
        }
      />
    </Screen>
  );
}
const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  intro: { paddingHorizontal: 24, paddingVertical: 16, color: colors.muted },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 88,
  },
  summary: { flex: 1, gap: 4 },
  avatar: { width: 56, height: 64, borderRadius: 18, backgroundColor: colors.plumSoft },
  pressed: { backgroundColor: colors.plumSoft },
  empty: { padding: 24 },
});
