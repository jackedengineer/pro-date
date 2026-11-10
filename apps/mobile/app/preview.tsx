import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../src/components/app-text';
import {
  previewActions,
  previewConversations,
  previewOwnerId,
  previewReview,
  previewThread,
  type PreviewData,
} from '../src/dev/preview-fixtures';
import { DiscoveryScreen } from '../src/features/discovery/discovery-screen';
import { ConversationScreen } from '../src/features/messaging/conversation-screen';
import { MergedInbox } from '../src/features/messaging/messaging-inbox';
import {
  MessagingPreviewProvider,
  type MessagingRuntime,
} from '../src/features/messaging/messaging-provider';
import { MyProfile } from '../src/features/profile/my-profile';
import { WelcomeScreen } from '../src/features/welcome/welcome-screen';
import { colors, spacing } from '../src/theme/tokens';

const screens = ['welcome', 'discover', 'requests', 'merged', 'profile', 'chat'] as const;

/**
 * Design-time gallery: real screens over stand-in data, so layout can be checked (and stressed
 * with worst-case content) without an account. Development builds only.
 */
export default function PreviewRoute() {
  const params = useLocalSearchParams<{ screen?: string; data?: string; empty?: string }>();
  const screen = screens.find((value) => value === params.screen) ?? 'discover';
  const data: PreviewData = params.data === 'worst' ? 'worst' : 'demo';
  const empty = params.empty === '1';
  const queries = useMemo(() => new QueryClient(), []);
  const actions = useMemo(() => previewActions(data, empty), [data, empty]);
  const runtime = useMemo(() => {
    const snapshot = previewThread(data, empty);
    const noop = () => Promise.resolve();
    const thread = {
      subscribe: () => () => {},
      getSnapshot: () => snapshot,
      loadOlder: noop,
      refreshReaction: noop,
      remove: noop,
      retry: noop,
      revoke: noop,
      selectReply: () => {},
      send: noop,
      setReaction: noop,
      sync: noop,
    };
    return {
      ownerId: previewOwnerId,
      safety: actions,
      api: {
        conversations: () =>
          Promise.resolve({ data: empty ? [] : previewConversations(data), nextCursor: null }),
        unmatch: noop,
      },
      storage: { saveConversations: noop },
      thread: () => thread,
      watch: () => () => {},
    } as unknown as MessagingRuntime;
  }, [actions, data, empty]);

  if (!__DEV__) return <Redirect href="/" />;

  const setParams = (next: Record<string, string>) => router.setParams(next);
  return (
    <QueryClientProvider client={queries}>
      <MessagingPreviewProvider value={{ runtime, error: null, retry: () => {} }}>
        <View style={styles.root}>
          <View style={styles.screen} key={`${screen}:${data}:${empty}`}>
            {screen === 'welcome' ? (
              <WelcomeScreen onGetStarted={() => {}} />
            ) : screen === 'chat' ? (
              <ConversationScreen id="10000000-0000-4000-8000-000000000400" />
            ) : (
              <DiscoveryScreen
                actions={actions}
                profile={
                  <MyProfile
                    loadProfileReview={() => Promise.resolve(previewReview(data, empty))}
                    onEdit={() => {}}
                    onFinishSetup={() => {}}
                  />
                }
                selectedTab={screen}
                onTabChange={(tab) => setParams({ screen: tab })}
                mergedInbox={
                  <MergedInbox onOpenConversation={() => setParams({ screen: 'chat' })} />
                }
              />
            )}
          </View>
          <View style={styles.bar}>
            {screens.map((value) => (
              <Pressable key={value} onPress={() => setParams({ screen: value })}>
                <AppText variant="caption" style={value === screen ? styles.on : styles.off}>
                  {value}
                </AppText>
              </Pressable>
            ))}
            <Pressable onPress={() => setParams({ data: data === 'worst' ? 'demo' : 'worst' })}>
              <AppText variant="caption" style={data === 'worst' ? styles.on : styles.off}>
                {data === 'worst' ? 'Worst case' : 'Demo data'}
              </AppText>
            </Pressable>
            <Pressable onPress={() => setParams({ empty: empty ? '0' : '1' })}>
              <AppText variant="caption" style={empty ? styles.on : styles.off}>
                empty
              </AppText>
            </Pressable>
          </View>
        </View>
      </MessagingPreviewProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  screen: { flex: 1, backgroundColor: colors.background },
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  on: { color: colors.white },
  off: { color: colors.fieldBorder },
});
