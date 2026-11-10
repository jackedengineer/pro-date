import pino from 'pino';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  startOrphanUploadSweeper,
  sweepOrphanedUploads,
  type OrphanSweepDependencies,
} from '../src/media/orphan-upload-sweeper.js';
import type { UploadedProfileAsset } from '../src/media/profile-photo-provider.js';

const now = new Date('2026-11-10T12:00:00Z');
const userId = '729438da-99b3-4d3d-b566-bfe94401829b';
const day = 24 * 60 * 60 * 1000;
function asset(name: string, ageMs: number): UploadedProfileAsset {
  return {
    createdAt: new Date(now.getTime() - ageMs),
    publicId: `pro-date/users/${userId}/profile/${name}`,
    userId,
  };
}

function dependencies(
  pages: UploadedProfileAsset[][],
  referenced: string[] = [],
): OrphanSweepDependencies & { deleteUpload: ReturnType<typeof vi.fn> } {
  return {
    now: () => now,
    listUploads: vi.fn((cursor: string | undefined) => {
      const index = cursor === undefined ? 0 : Number(cursor);
      return Promise.resolve({
        assets: pages[index] ?? [],
        nextCursor: index + 1 < pages.length ? String(index + 1) : undefined,
      });
    }),
    referencedAssets: vi.fn((ids: string[]) =>
      Promise.resolve(new Set(ids.filter((id) => referenced.some((name) => id.endsWith(name))))),
    ),
    deleteUpload: vi.fn().mockResolvedValue(undefined),
  };
}

describe('orphaned upload sweep', () => {
  it('deletes only day-old uploads that nothing references', async () => {
    const deps = dependencies(
      [
        [asset('abandoned', 2 * day), asset('fresh', 60_000), asset('on-profile', 3 * day)],
        [asset('in-pull-request', 5 * day), asset('also-abandoned', day)],
      ],
      ['on-profile', 'in-pull-request'],
    );

    await expect(sweepOrphanedUploads(deps)).resolves.toEqual({
      scanned: 5,
      deleted: 2,
      failed: 0,
      complete: true,
    });
    expect(deps.deleteUpload.mock.calls).toEqual([
      [userId, `pro-date/users/${userId}/profile/abandoned`],
      [userId, `pro-date/users/${userId}/profile/also-abandoned`],
    ]);
  });

  it('counts a failed deletion and keeps going', async () => {
    const deps = dependencies([[asset('a', 2 * day), asset('b', 2 * day)]]);
    deps.deleteUpload.mockRejectedValueOnce(new Error('provider down'));

    await expect(sweepOrphanedUploads(deps)).resolves.toMatchObject({ deleted: 1, failed: 1 });
  });

  it('stops at its page and deletion budgets', async () => {
    const deps = dependencies([[asset('a', 2 * day), asset('b', 2 * day)], [asset('c', 2 * day)]]);

    await expect(
      sweepOrphanedUploads(deps, { minAgeMs: day, maxPages: 5, maxDeletes: 1 }),
    ).resolves.toEqual({ scanned: 2, deleted: 1, failed: 0, complete: false });
    await expect(
      sweepOrphanedUploads(dependencies([[asset('a', 0)], [asset('b', 0)]]), {
        minAgeMs: day,
        maxPages: 1,
        maxDeletes: 10,
      }),
    ).resolves.toMatchObject({ scanned: 1, complete: false });
  });
});

describe('orphaned upload sweeper', () => {
  afterEach(() => vi.useRealTimers());

  it('runs after a delay, repeats, never overlaps, and stops cleanly', async () => {
    vi.useFakeTimers();
    let finish: () => void = () => {};
    const sweep = vi.fn(
      () =>
        new Promise<{ scanned: number; deleted: number; failed: number; complete: boolean }>(
          (resolve) => {
            finish = () => resolve({ scanned: 0, deleted: 0, failed: 0, complete: true });
          },
        ),
    );
    const sweeper = startOrphanUploadSweeper({
      sweep,
      logger: pino({ level: 'silent' }),
      initialDelayMs: 1000,
      intervalMs: 5000,
    });

    await vi.advanceTimersByTimeAsync(999);
    expect(sweep).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(sweep).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    expect(sweep).toHaveBeenCalledTimes(1);

    finish();
    await vi.advanceTimersByTimeAsync(5000);
    expect(sweep).toHaveBeenCalledTimes(2);

    finish();
    await sweeper.stop();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(sweep).toHaveBeenCalledTimes(2);
  });
});
