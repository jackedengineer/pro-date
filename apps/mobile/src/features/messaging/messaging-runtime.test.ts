import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { MessagingRuntime } from './messaging-provider';

jest.mock('@clerk/expo', () => ({ useAuth: jest.fn() }));
jest.mock('expo-router', () => ({ usePathname: jest.fn() }));
jest.mock('expo-network', () => ({}));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('socket.io-client', () => ({ io: jest.fn() }));
jest.mock('./sqlite-chat-storage', () => ({}));

type Dependencies = ConstructorParameters<typeof MessagingRuntime>;
const owner = '10000000-0000-4000-8000-000000000001';
const id = '20000000-0000-4000-8000-000000000001';

it('cancels an older inbox fetch immediately when a conversation is revoked', async () => {
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const key = ['conversations', owner];
  const data = { pages: [{ data: [{ id }], nextCursor: null }], pageParams: [undefined] };
  queries.setQueryData(key, data);
  let aborted = false;
  const observer = new QueryObserver(queries, {
    queryKey: key,
    staleTime: Infinity,
    queryFn: ({ signal }) =>
      new Promise<typeof data>((resolve) => {
        signal.addEventListener('abort', () => {
          aborted = true;
          resolve(data);
        });
      }),
  });
  const unsubscribe = observer.subscribe(() => {});
  const storage = {
    read: () =>
      Promise.resolve({
        conversation: null,
        messages: [],
        outgoing: [],
        contexts: [],
        capabilities: null,
      }),
    clear: () => Promise.resolve(),
  } as unknown as Dependencies[3];
  const runtime = new MessagingRuntime(
    owner,
    {} as Dependencies[1],
    {} as Dependencies[2],
    storage,
    queries,
    {} as Dependencies[5],
    {} as Dependencies[6],
    () => true,
  );
  try {
    void queries.refetchQueries({ queryKey: key });
    const thread = runtime.thread(id);
    await thread.ready;
    await thread.revoke();
    expect(aborted).toBe(true);
    expect(queries.getQueryData<typeof data>(key)?.pages[0]?.data).toEqual([]);
  } finally {
    unsubscribe();
    runtime.dispose();
  }
});
