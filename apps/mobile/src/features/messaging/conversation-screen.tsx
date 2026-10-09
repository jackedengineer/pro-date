import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  StyleSheet,
  View,
  type ScrollViewProps,
} from 'react-native';
import { KeyboardChatScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import Reanimated, { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiRequestError } from '../../api/http-client';
import { AppText } from '../../components/app-text';
import { colors } from '../../theme/tokens';
import { EmptyState, ErrorNotice, QuietButton } from '../discovery/discovery-shared';
import { ProfileSafetySheet } from '../discovery/profile-safety-sheet';
import type { ChatRow, ThreadSnapshot } from './chat-thread';
import { MessageBubble } from './message-bubble';
import { MessageComposer } from './message-composer';
import { useMessaging } from './messaging-provider';
import { NotificationSettingsButton } from '../notifications/notification-settings-sheet';

const ScrollContext = createContext<{
  padding: SharedValue<number>;
  offset: number;
  onEnd: (visible: boolean) => void;
} | null>(null);
// Keep this component identity stable: a new scroll wrapper would reset native scroll state.
const ChatScroll = forwardRef<Reanimated.ScrollView, ScrollViewProps>(
  function ChatScroll(props, ref) {
    const config = useContext(ScrollContext)!;
    return (
      <KeyboardChatScrollView
        {...props}
        ref={ref}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        keyboardLiftBehavior="whenAtEnd"
        offset={config.offset}
        extraContentPadding={config.padding}
        onEndVisible={config.onEnd}
      />
    );
  },
);
const position = {
  startRenderingFromBottom: true,
  autoscrollToBottomThreshold: 0.2,
  animateAutoScrollToBottom: false,
};
const identify = (row: ChatRow) => row.key;
const backToMerged = () => router.replace({ pathname: '/discover', params: { tab: 'merged' } });
export function ConversationScreen({ id }: { id: string }) {
  const { runtime } = useMessaging();
  const thread = useMemo(() => runtime!.thread(id), [runtime, id]);
  const state = useSyncExternalStore(thread.subscribe, thread.getSnapshot);
  const insets = useSafeAreaInsets();
  const padding = useSharedValue(80);
  const list = useRef<FlashListRef<ChatRow>>(null);
  const [atEnd, setAtEnd] = useState(true);
  const [safety, setSafety] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [composerHeight, setComposerHeight] = useState(80);
  useEffect(() => runtime!.watch(id), [runtime, id]);
  const handleFailure = useCallback(
    (failure: unknown) =>
      setActionError(failure instanceof Error ? failure.message : 'We couldn’t save this change.'),
    [],
  );
  const retry = useCallback(
    (clientId: string) => {
      void thread.retry(clientId).catch(handleFailure);
    },
    [thread, handleFailure],
  );
  const remove = useCallback(
    (clientId: string) => {
      void thread.remove(clientId).catch(handleFailure);
    },
    [thread, handleFailure],
  );
  const send = useCallback((body: string) => thread.send(body), [thread]);
  const renderMessage = useCallback(
    ({ item }: { item: ChatRow }) => (
      <MessageBubble
        row={item}
        mine={item.senderId === runtime!.ownerId}
        retry={retry}
        remove={remove}
      />
    ),
    [runtime, retry, remove],
  );
  const scrollConfig = useMemo(
    () => ({ padding, offset: insets.bottom, onEnd: setAtEnd }),
    [padding, insets.bottom],
  );
  const endConnection = async () => {
    try {
      await runtime!.api.unmatch(id);
    } catch (failure: unknown) {
      if (!(failure instanceof ApiRequestError && failure.status === 404)) {
        handleFailure(failure);
        return;
      }
    }
    await thread.revoke();
    backToMerged();
  };
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <QuietButton label="Back to Merged" onPress={backToMerged} />
        <View style={styles.member}>
          <Image
            source={state.conversation?.member.photoUrl ?? null}
            contentFit="cover"
            style={styles.avatar}
          />
          <View style={styles.name}>
            <AppText variant="button" numberOfLines={1}>
              {state.conversation?.member.displayName ?? 'Conversation'}
            </AppText>
            <AppText variant="caption">
              {state.unavailable
                ? 'No longer available'
                : state.online
                  ? 'A mutual connection'
                  : 'Offline · sends stay queued'}
            </AppText>
          </View>
          {!state.unavailable && state.conversation !== null ? (
            <NotificationSettingsButton runtime={runtime!} conversationId={id} />
          ) : null}
        </View>
        {state.conversation === null ? null : (
          <View style={styles.tools}>
            <QuietButton
              label="Report or block"
              onPress={() => {
                Keyboard.dismiss();
                setSafety(true);
              }}
            />
            <QuietButton
              label="Unmatch"
              onPress={() =>
                Alert.alert(
                  'End this connection?',
                  'Neither of you will be able to send messages or open this conversation. This cannot be undone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Unmatch',
                      style: 'destructive',
                      onPress: () => {
                        void endConnection().catch(handleFailure);
                      },
                    },
                  ],
                )
              }
            />
          </View>
        )}
      </View>
      <ErrorNotice message={actionError ?? state.error} />
      {state.error !== null && !state.unavailable ? (
        <QuietButton label="Refresh conversation" onPress={() => void thread.sync()} />
      ) : null}
      <View style={styles.body}>
        <ScrollContext.Provider value={scrollConfig}>
          <FlashList
            ref={list}
            data={state.rows}
            renderItem={renderMessage}
            keyExtractor={identify}
            renderScrollComponent={ChatScroll}
            maintainVisibleContentPosition={position}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.history}
            ListHeaderComponent={
              state.hasOlder ? (
                <QuietButton
                  label={state.loadingOlder ? 'Loading…' : 'Load earlier messages'}
                  disabled={state.loadingOlder || !state.online}
                  onPress={() => void thread.loadOlder()}
                />
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <ConversationEmptyState state={state} />
              </View>
            }
          />
        </ScrollContext.Provider>
        <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }} style={styles.sticky}>
          {!atEnd && state.rows.length > 0 ? (
            <View style={styles.jump}>
              <QuietButton
                label="Jump to latest"
                onPress={() => {
                  void list.current?.scrollToEnd({ animated: true });
                }}
              />
            </View>
          ) : null}
          <View
            onLayout={(event) => {
              const height = event.nativeEvent.layout.height;
              if (height !== composerHeight) {
                padding.set(height);
                setComposerHeight(height);
              }
            }}
          >
            <MessageComposer
              onSend={send}
              disabled={state.loading || state.unavailable || state.conversation === null}
              bottomInset={insets.bottom}
            />
          </View>
        </KeyboardStickyView>
      </View>
      {safety && state.conversation !== null ? (
        <ProfileSafetySheet
          profile={state.conversation.member}
          actions={runtime!.safety}
          onClose={() => setSafety(false)}
          onSaved={() => {
            setSafety(false);
            void thread.revoke().then(backToMerged).catch(handleFailure);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}
function ConversationEmptyState({
  state,
}: {
  state: Pick<ThreadSnapshot, 'loading' | 'unavailable' | 'conversation'>;
}) {
  if (state.loading) return <ActivityIndicator color={colors.plum} />;
  if (state.unavailable)
    return (
      <EmptyState
        title="This connection has ended."
        body="This conversation is unavailable. Return to Merged to continue."
      />
    );
  if (state.conversation === null || state.conversation.lastMessage !== null)
    return (
      <EmptyState
        title="Your conversation is not loaded yet."
        body="Go online or refresh this conversation to load its history."
      />
    );
  return (
    <EmptyState
      title="You both approved the merge."
      body="Ship the first hello. A question about their profile is a good place to start."
    />
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  member: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 42, borderRadius: 12, backgroundColor: colors.plumSoft },
  name: { flex: 1 },
  tools: { flexDirection: 'row', justifyContent: 'space-between' },
  body: { flex: 1 },
  history: { paddingTop: 12 },
  sticky: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  empty: { padding: 24 },
  jump: {
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
});
