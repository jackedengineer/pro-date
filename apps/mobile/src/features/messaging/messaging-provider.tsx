import { useAuth } from '@clerk/expo';
import { conversationChangedSchema, type Conversation } from '@pro-date/contracts';
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import * as Network from 'expo-network';
import { usePathname } from 'expo-router';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';
import { io } from 'socket.io-client';
import { createDiscoveryApi, type DiscoveryActions } from '../../api/discovery';
import { bootstrapChatUser, createMessagingApi, type MessagingApi } from '../../api/messaging';
import { apiBaseUrl, isClerkConfigured } from '../../config/public-env';
import { ChatThread } from './chat-thread';
import type { ChatStorage } from './chat-storage';
import { cachedChatOwner, forgetChatAccounts, openChatStorage } from './sqlite-chat-storage';

export class MessagingRuntime {
  private threads = new Map<string, ChatThread>();
  private watched = new Set<string>();
  private enabled = false;
  private disposed = false;
  private timer = setInterval(() => {
    if (this.enabled) for (const id of this.watched) void this.thread(id).sync();
  }, 15_000);
  constructor(
    readonly ownerId: string,
    readonly api: MessagingApi,
    readonly safety: DiscoveryActions,
    readonly storage: ChatStorage,
    readonly queries: QueryClient,
  ) {}
  async restoreQueue() {
    const cached = await this.storage.cachedConversations();
    if (this.disposed) return;
    if (cached.length > 0)
      this.queries.setQueryData(
        ['conversations', this.ownerId],
        { pages: [{ data: cached, nextCursor: null }], pageParams: [undefined] },
        { updatedAt: 0 },
      );
    for (const id of await this.storage.pendingIds()) {
      if (this.disposed) return;
      this.thread(id);
    }
  }
  thread(id: string) {
    let thread = this.threads.get(id);
    if (thread === undefined) {
      thread = new ChatThread(id, this.ownerId, this.storage, this.api, randomUUID, () => {
        if (!this.disposed) {
          if (this.threads.get(id)?.getSnapshot().unavailable)
            this.queries.setQueryData<{
              pages: { data: Conversation[]; nextCursor: string | null }[];
              pageParams: unknown[];
            }>(['conversations', this.ownerId], (cached) =>
              cached === undefined
                ? undefined
                : {
                    ...cached,
                    pages: cached.pages.map((page) => ({
                      ...page,
                      data: page.data.filter((conversation) => conversation.id !== id),
                    })),
                  },
            );
          void this.queries.invalidateQueries({ queryKey: ['conversations', this.ownerId] });
        }
      });
      this.threads.set(id, thread);
      thread.setEnabled(this.enabled);
    }
    return thread;
  }
  watch(id: string) {
    this.watched.add(id);
    void this.thread(id).sync();
    return () => {
      this.watched.delete(id);
    };
  }
  hint(id: string) {
    const thread = this.threads.get(id);
    if (thread !== undefined) void thread.sync();
    void this.queries.invalidateQueries({ queryKey: ['conversations', this.ownerId] });
  }
  setEnabled(enabled: boolean) {
    if (this.disposed) return;
    this.enabled = enabled;
    for (const thread of this.threads.values()) thread.setEnabled(enabled);
  }
  dispose() {
    this.disposed = true;
    clearInterval(this.timer);
    for (const thread of this.threads.values()) thread.dispose();
    this.queries.clear();
  }
}
interface MessagingState {
  runtime: MessagingRuntime | null;
  error: string | null;
  retry: () => void;
}
const Context = createContext<MessagingState>({ runtime: null, error: null, retry: () => {} });
export const useMessaging = () => useContext(Context);
export function MessagingProvider({ children }: PropsWithChildren) {
  return isClerkConfigured && apiBaseUrl !== null ? (
    <ConfiguredProvider apiUrl={apiBaseUrl}>{children}</ConfiguredProvider>
  ) : (
    <>{children}</>
  );
}
function ConfiguredProvider({ children, apiUrl }: PropsWithChildren<{ apiUrl: string }>) {
  const auth = useAuth();
  const pathname = usePathname();
  const authRef = useRef(auth);
  useEffect(() => {
    authRef.current = auth;
  }, [auth]);
  const session = auth.isLoaded && auth.isSignedIn ? auth.userId : null;
  const runtimeRef = useRef<MessagingRuntime | null>(null);
  const previousSession = useRef<string | null>(null);
  const transition = useRef<Promise<void>>(Promise.resolve());
  const [state, setState] = useState<{
    runtime: MessagingRuntime | null;
    error: string | null;
    session: string | null;
  }>({ runtime: null, error: null, session: null });
  const [attempt, setAttempt] = useState(0);
  const [queries] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, staleTime: 10_000, gcTime: 5 * 60_000 } },
      }),
  );
  const shouldStart =
    pathname === '/discover' || pathname.startsWith('/messages') || state.runtime !== null;
  useEffect(
    () => () => {
      const runtime = runtimeRef.current;
      runtimeRef.current = null;
      runtime?.dispose();
      if (runtime !== null)
        transition.current = transition.current
          .catch(() => {})
          .then(() => runtime.storage.close(false))
          .catch(() => {});
    },
    [],
  );
  useEffect(() => {
    if (!auth.isLoaded) return;
    let cancelled = false;
    let cleanupConnection = () => {};
    const previous = runtimeRef.current;
    runtimeRef.current = null;
    const purge = session !== previousSession.current;
    previousSession.current = session;
    previous?.dispose();
    transition.current = transition.current
      .catch(() => {})
      .then(async () => {
        if (!cancelled) setState({ runtime: null, error: null, session });
        if (previous !== null) await previous.storage.close(purge);
        if (session === null) {
          await forgetChatAccounts();
          queries.clear();
          return;
        }
        if (cancelled || !shouldStart) return;
        const getToken = async () =>
          authRef.current.userId === session && authRef.current.isSignedIn
            ? authRef.current.getToken()
            : null;
        let ownerId = await cachedChatOwner(session);
        if (ownerId === null) {
          const user = await bootstrapChatUser({ apiBaseUrl: apiUrl, getToken });
          if (user.onboardingStatus !== 'COMPLETE') throw new Error('Complete your profile first.');
          ownerId = user.id;
        }
        if (cancelled) return;
        const storage = await openChatStorage(ownerId, session);
        if (cancelled) {
          await storage.close(false);
          return;
        }
        const runtime = new MessagingRuntime(
          ownerId,
          createMessagingApi({ apiBaseUrl: apiUrl, getToken }),
          createDiscoveryApi({ apiBaseUrl: apiUrl, getToken }),
          storage,
          queries,
        );
        runtimeRef.current = runtime;
        const socket = io(apiUrl, {
          autoConnect: false,
          transports: ['websocket'],
          reconnectionDelay: 1000,
          reconnectionDelayMax: 10_000,
          auth: (done) => {
            void getToken()
              .then((token) => done({ token }))
              .catch(() => done({ token: null }));
          },
        });
        let foreground = AppState.currentState === 'active';
        let online = true;
        let reconnect: ReturnType<typeof setTimeout> | undefined;
        const update = () => {
          const enabled = foreground && online;
          runtime.setEnabled(enabled);
          focusManager.setFocused(foreground);
          onlineManager.setOnline(online);
          if (enabled) socket.connect();
          else {
            clearTimeout(reconnect);
            socket.disconnect();
          }
        };
        socket.on('connect', () => {
          if (foreground && online) {
            runtime.setEnabled(true);
            void queries.invalidateQueries({ queryKey: ['conversations', ownerId] });
          }
        });
        socket.on('conversation:changed', (value: unknown) => {
          const parsed = conversationChangedSchema.safeParse(value);
          if (parsed.success) runtime.hint(parsed.data.conversationId);
        });
        const retryConnection = () => {
          clearTimeout(reconnect);
          if (foreground && online) reconnect = setTimeout(() => socket.connect(), 2500);
        };
        socket.on('disconnect', (reason) => {
          if (reason === 'io server disconnect') retryConnection();
        });
        socket.on('connect_error', retryConnection);
        const appListener = AppState.addEventListener('change', (value) => {
          foreground = value === 'active';
          update();
        });
        const networkChanged = (value: Network.NetworkState) => {
          online = value.isConnected !== false && value.isInternetReachable !== false;
          update();
        };
        const networkListener = Network.addNetworkStateListener(networkChanged);
        void Network.getNetworkStateAsync()
          .then((value) => {
            if (!cancelled) networkChanged(value);
          })
          .catch(() => {});
        cleanupConnection = () => {
          clearTimeout(reconnect);
          socket.removeAllListeners();
          socket.disconnect();
          appListener.remove();
          networkListener.remove();
          runtime.dispose();
        };
        await runtime.restoreQueue();
        if (cancelled) {
          cleanupConnection();
          await storage.close(false);
          runtimeRef.current = null;
          return;
        }
        update();
        setState({ runtime, error: null, session });
      })
      .catch(() => {
        if (!cancelled)
          setState({
            runtime: null,
            error: 'We couldn’t open messaging. Check your connection and try again.',
            session,
          });
      });
    return () => {
      cancelled = true;
      cleanupConnection();
    };
    // Session transitions are serialized; token refreshes do not recreate the device queue.
  }, [session, shouldStart, auth.isLoaded, apiUrl, queries, attempt]);
  return (
    <QueryClientProvider client={queries}>
      <Context.Provider
        value={{
          runtime: state.session === session ? state.runtime : null,
          error: state.session === session ? state.error : null,
          retry: () => setAttempt((value) => value + 1),
        }}
      >
        {children}
      </Context.Provider>
    </QueryClientProvider>
  );
}
