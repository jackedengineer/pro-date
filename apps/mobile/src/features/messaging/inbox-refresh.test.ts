import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { InboxRefresh } from './inbox-refresh';

const owner = 'fixture-owner';
const key = ['conversations', owner];
async function setup() {
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  let requests = 0;
  let aborted = 0;
  let hold = false;
  let resolve!: (data: number) => void;
  const queryFn = ({ signal }: { signal: AbortSignal }) => {
    requests++;
    signal.addEventListener('abort', () => aborted++, { once: true });
    return hold ? new Promise<number>((done) => (resolve = done)) : Promise.resolve(requests);
  };
  await queries.fetchQuery({ queryKey: key, queryFn });
  const observer = new QueryObserver(queries, { queryKey: key, queryFn, staleTime: Infinity });
  const unsubscribe = observer.subscribe(() => {});
  requests = 0;
  const refresh = new InboxRefresh(queries, owner);
  return {
    queries,
    refresh,
    count: () => ({ requests, aborted }),
    hold: () => (hold = true),
    release: () => {
      hold = false;
      resolve(requests);
    },
    close: () => {
      refresh.dispose();
      unsubscribe();
      queries.clear();
    },
  };
}
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('account-scoped inbox refresh coalescing', () => {
  it('turns a 125-hint burst into one request without aborting requests', async () => {
    const fixture = await setup();
    try {
      for (let i = 0; i < 125; i++) fixture.refresh.request();
      await jest.advanceTimersByTimeAsync(50);
      expect(fixture.count()).toEqual({ requests: 1, aborted: 0 });
    } finally {
      fixture.close();
    }
  });

  it('does not cancel a running refresh and follows up once for newer hints', async () => {
    const fixture = await setup();
    try {
      fixture.hold();
      fixture.refresh.request();
      await jest.advanceTimersByTimeAsync(50);
      for (let i = 0; i < 125; i++) fixture.refresh.request();
      await jest.advanceTimersByTimeAsync(200);
      expect(fixture.count()).toEqual({ requests: 1, aborted: 0 });
      fixture.release();
      await jest.advanceTimersByTimeAsync(50);
      expect(fixture.count()).toEqual({ requests: 2, aborted: 0 });
    } finally {
      fixture.close();
    }
  });

  it('follows up if a hint arrives during a refresh started outside the coalescer', async () => {
    const fixture = await setup();
    try {
      fixture.hold();
      const external = fixture.queries.refetchQueries({ queryKey: key });
      fixture.refresh.request();
      await jest.advanceTimersByTimeAsync(50);
      expect(fixture.count()).toEqual({ requests: 1, aborted: 0 });
      fixture.release();
      await external;
      await jest.advanceTimersByTimeAsync(50);
      expect(fixture.count()).toEqual({ requests: 2, aborted: 0 });
    } finally {
      fixture.close();
    }
  });

  it('cancels scheduled work on dispose', async () => {
    const fixture = await setup();
    try {
      fixture.refresh.request();
      fixture.refresh.dispose();
      fixture.refresh.request();
      await jest.advanceTimersByTimeAsync(100);
      expect(fixture.count()).toEqual({ requests: 0, aborted: 0 });
    } finally {
      fixture.close();
    }
  });

  it('does not start trailing work after disposal during a refresh', async () => {
    const fixture = await setup();
    try {
      fixture.hold();
      fixture.refresh.request();
      await jest.advanceTimersByTimeAsync(50);
      fixture.refresh.request();
      fixture.refresh.dispose();
      fixture.release();
      await jest.advanceTimersByTimeAsync(100);
      expect(fixture.count()).toEqual({ requests: 1, aborted: 0 });
    } finally {
      fixture.close();
    }
  });

  it('only invalidates the owning account inbox', async () => {
    const fixture = await setup();
    const otherKey = ['conversations', 'another-owner'];
    fixture.queries.setQueryData(otherKey, []);
    try {
      fixture.refresh.request();
      await jest.advanceTimersByTimeAsync(50);
      expect(fixture.queries.getQueryState(otherKey)?.isInvalidated).toBe(false);
    } finally {
      fixture.close();
    }
  });
});
