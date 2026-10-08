import { useCallback, useEffect, useRef, useState } from 'react';

import type { DiscoveryPage } from '../../api/discovery';

export function usePagedCollection<T>(
  load: (cursor?: string) => Promise<DiscoveryPage<T>>,
  identity: (item: T) => string,
) {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const pending = useRef(false);

  const requestPage = useCallback(
    (next?: string) => {
      if (pending.current && next !== undefined) return Promise.resolve();
      const current = ++generation.current;
      pending.current = true;
      return load(next)
        .then((result) => {
          if (current !== generation.current) return;
          setItems((previous) => [
            ...new Map(
              (next === undefined ? result.data : [...previous, ...result.data]).map((item) => [
                identity(item),
                item,
              ]),
            ).values(),
          ]);
          setCursor(result.nextCursor);
        })
        .catch((failure: unknown) => {
          if (current === generation.current)
            setError(
              failure instanceof Error
                ? failure.message
                : 'We could not load this list. Try again.',
            );
        })
        .finally(() => {
          if (current === generation.current) {
            pending.current = false;
            setLoading(false);
          }
        });
    },
    [identity, load],
  );

  useEffect(() => {
    void requestPage();
    return () => {
      generation.current += 1;
      pending.current = false;
    };
  }, [requestPage]);

  return {
    items,
    loading,
    error,
    hasMore: cursor !== null,
    refresh: () => {
      setLoading(true);
      setError(null);
      return requestPage();
    },
    loadMore: () => {
      if (cursor === null) return Promise.resolve();
      setLoading(true);
      setError(null);
      return requestPage(cursor);
    },
    remove: (id: string) =>
      setItems((previous) => previous.filter((item) => identity(item) !== id)),
  };
}
