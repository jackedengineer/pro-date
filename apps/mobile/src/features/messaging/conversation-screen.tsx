import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Image } from 'expo-image';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Ellipsis from 'lucide-react-native/icons/ellipsis';
import { IconButton } from '../../components/icon-button';
import { useReducedMotionPreference } from '../../theme/motion';
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
import { ReactionPicker } from './reaction-picker';
import type { MessageAnchor } from './reaction-picker-layout';
import type { ReactionKind } from '@pro-date/contracts';
import { triggerFeedback } from '../../theme/feedback';
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
  const reducedMotion = useReducedMotionPreference();
  const { runtime } = useMessaging();
  const thread = useMemo(() => runtime!.thread(id), [runtime, id]);
  const state = useSyncExternalStore(thread.subscribe, thread.getSnapshot);
  const insets = useSafeAreaInsets();
  const padding = useSharedValue(80);
  const list = useRef<FlashListRef<ChatRow>>(null);
  const [atEnd, setAtEnd] = useState(true);
  const [safety, setSafety] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [composerHeight, setComposerHeight] = useState(80);
  const [messageAction, setMessageAction] = useState<{
    id: string;
    anchor: MessageAnchor | null;
  } | null>(null);
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
  const reply = useCallback((messageId: string) => thread.selectReply(messageId), [thread]);
  const cancelReply = useCallback(() => thread.selectReply(null), [thread]);
  const openMessageActions = useCallback((messageId: string, anchor?: MessageAnchor) => {
    // Keep keyboard/list geometry stable while the anchored menu is visible.
    setMessageAction({ id: messageId, anchor: anchor ?? null });
  }, []);
  const react = useCallback(
    (messageId: string, kind: ReactionKind) => {
      setMessageAction(null);
      if (!reducedMotion) triggerFeedback('selection');
      void thread.setReaction(messageId, kind);
    },
    [thread, reducedMotion],
  );
  const refreshReaction = useCallback(
    (messageId: string) => {
      void thread.refreshReaction(messageId);
    },
    [thread],
  );
  const renderMessage = useCallback(
    ({ item }: { item: ChatRow }) => (
      <MessageBubble
        row={item}
        mine={item.senderId === runtime!.ownerId}
        retry={retry}
        remove={remove}
        reply={state.capabilities.replies ? reply : null}
        reducedMotion={reducedMotion}
        ownerId={runtime!.ownerId}
        online={state.online}
        actions={state.capabilities.reactions ? openMessageActions : null}
        react={state.capabilities.reactions ? react : null}
        refreshReaction={refreshReaction}
      />
    ),
    [
      runtime,
      retry,
      remove,
      state.capabilities.replies,
      state.capabilities.reactions,
      state.online,
      reply,
      reducedMotion,
      openMessageActions,
      react,
      refreshReaction,
    ],
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
        <View style={styles.member}>
          <IconButton label="Back to Merged" icon={ArrowLeft} onPress={backToMerged} />
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
            <NotificationSettingsButton runtime={runtime!} conversationId={id} compact />
          ) : null}
          {state.conversation === null ? null : (
            <IconButton
              label="More chat options"
              icon={Ellipsis}
              accessibilityState={{ expanded: toolsOpen }}
              onPress={() => {
                Keyboard.dismiss();
                setToolsOpen((value) => !value);
              }}
            />
          )}
        </View>
        {state.conversation === null || !toolsOpen ? null : (
          <View style={styles.tools}>
            <QuietButton
              label="Report or block"
              onPress={() => {
                Keyboard.dismiss();
                setToolsOpen(false);
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
      <ErrorNotice message={actionError ?? state.error ?? state.contextError} />
      {(state.error !== null || state.contextError !== null) && !state.unavailable ? (
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
                  void list.current?.scrollToEnd({ animated: !reducedMotion });
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
              key={`${runtime!.ownerId}:${id}`}
              onSend={send}
              disabled={state.loading || state.unavailable || state.conversation === null}
              bottomInset={insets.bottom}
              replyTo={state.replyTo}
              onCancelReply={cancelReply}
            />
          </View>
        </KeyboardStickyView>
      </View>
      <ReactionPicker
        row={
          state.unavailable || !state.capabilities.reactions
            ? null
            : (state.rows.find((row) => row.messageId === messageAction?.id) ?? null)
        }
        ownerId={runtime!.ownerId}
        online={state.online}
        bottomInset={insets.bottom}
        topInset={insets.top}
        leftInset={insets.left}
        rightInset={insets.right}
        anchor={messageAction?.anchor ?? null}
        onClose={() => setMessageAction(null)}
        onReply={
          state.capabilities.replies
            ? (messageId) => {
                setMessageAction(null);
                reply(messageId);
              }
            : null
        }
        onReact={react}
        onRefresh={refreshReaction}
      />
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
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 8,
  },
  member: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 64 },
  avatar: { width: 40, height: 40, borderRadius: 16, backgroundColor: colors.plumSoft },
  name: { flex: 1 },
  tools: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    backgroundColor: colors.plumSoft,
    borderRadius: 12,
  },
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
