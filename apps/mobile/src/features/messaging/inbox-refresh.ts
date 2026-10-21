import type { QueryClient } from '@tanstack/react-query';

/** Batches inbox hints without delaying open-thread synchronization. Owned by one account runtime. */
export class InboxRefresh {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pending = false;
  private dirty = false;
  private disposed = false;
  constructor(
    private queries: QueryClient,
    private ownerId: string,
  ) {}

  request() {
    if (this.disposed) return;
    this.dirty = true;
    if (this.pending || this.timer !== undefined) return;
    // Fixed window, not a resetting debounce: sustained traffic cannot postpone a refresh forever.
    this.timer = setTimeout(() => {
      this.timer = undefined;
      const filters = { queryKey: ['conversations', this.ownerId], exact: true };
      // A fetch started elsewhere may predate these hints; revalidate once it settles.
      this.dirty = this.queries.isFetching(filters) > 0;
      this.pending = true;
      // Preserve a running request rather than repeatedly canceling it during message bursts.
      // Source: https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient
      void this.queries.invalidateQueries(filters, { cancelRefetch: false }).finally(() => {
        this.pending = false;
        if (this.dirty) this.request();
      });
    }, 50);
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    this.timer = undefined;
  }
}
