import type { Logger } from 'pino';

import { describeError } from '../logger.js';
import type { UploadedProfileAsset } from './profile-photo-provider.js';

export interface OrphanSweepDependencies {
  listUploads: (
    cursor: string | undefined,
  ) => Promise<{ assets: UploadedProfileAsset[]; nextCursor: string | undefined }>;
  referencedAssets: (publicIds: string[]) => Promise<Set<string>>;
  deleteUpload: (userId: string, publicId: string) => Promise<void>;
  now?: () => Date;
}

export interface OrphanSweepLimits {
  /** Uploads younger than this may still be awaiting their confirmation request. */
  minAgeMs: number;
  /** Admin API listing calls per run; Cloudinary rate-limits them per hour. */
  maxPages: number;
  /** Deletions per run, so one run cannot flood the provider. */
  maxDeletes: number;
}

export const defaultOrphanSweepLimits: OrphanSweepLimits = {
  minAgeMs: 24 * 60 * 60 * 1000,
  maxPages: 10,
  maxDeletes: 200,
};

export interface OrphanSweepResult {
  scanned: number;
  deleted: number;
  failed: number;
  /** False when a limit stopped the run before the listing ended. */
  complete: boolean;
}

/**
 * Deletes profile uploads that are older than a day and that neither a profile photo nor a
 * pull request references: abandoned uploads (picked, uploaded, never confirmed) and removed
 * photos whose last pull request has since gone away.
 */
export async function sweepOrphanedUploads(
  dependencies: OrphanSweepDependencies,
  limits: OrphanSweepLimits = defaultOrphanSweepLimits,
): Promise<OrphanSweepResult> {
  const now = (dependencies.now ?? (() => new Date()))().getTime();
  const result: OrphanSweepResult = { scanned: 0, deleted: 0, failed: 0, complete: false };
  let cursor: string | undefined;

  for (let page = 0; page < limits.maxPages; page++) {
    const listing = await dependencies.listUploads(cursor);
    result.scanned += listing.assets.length;
    const candidates = listing.assets.filter(
      (asset) => now - asset.createdAt.getTime() >= limits.minAgeMs,
    );
    // Checked page by page, right before deleting, so a reference written meanwhile still counts.
    const referenced = await dependencies.referencedAssets(
      candidates.map((asset) => asset.publicId),
    );

    for (const asset of candidates) {
      if (referenced.has(asset.publicId)) continue;
      if (result.deleted + result.failed >= limits.maxDeletes) return result;
      try {
        await dependencies.deleteUpload(asset.userId, asset.publicId);
        result.deleted += 1;
      } catch {
        result.failed += 1;
      }
    }

    if (listing.nextCursor === undefined) {
      result.complete = true;
      return result;
    }
    cursor = listing.nextCursor;
  }

  return result;
}

interface SweeperOptions {
  sweep: () => Promise<OrphanSweepResult>;
  logger: Logger;
  initialDelayMs?: number;
  intervalMs?: number;
}

/**
 * Runs the sweep a few minutes after start and then every six hours while the process lives.
 * The container sleeps when idle, so each wake gets a run; the age threshold keeps that safe.
 */
export function startOrphanUploadSweeper({
  sweep,
  logger,
  initialDelayMs = 5 * 60 * 1000,
  intervalMs = 6 * 60 * 60 * 1000,
}: SweeperOptions) {
  let running: Promise<void> | null = null;
  let stopped = false;
  const run = () => {
    if (stopped || running !== null) return;
    running = sweep()
      .then((result) => {
        logger.info({ event: 'media_orphan_sweep', ...result }, 'Orphaned upload sweep finished');
      })
      .catch((error: unknown) => {
        logger.warn(
          { event: 'media_orphan_sweep_failed', error: describeError(error) },
          'Orphaned upload sweep failed; it will retry on the next run',
        );
      })
      .finally(() => {
        running = null;
      });
  };
  const first = setTimeout(run, initialDelayMs);
  const repeat = setInterval(run, intervalMs);
  first.unref();
  repeat.unref();

  return {
    async stop() {
      stopped = true;
      clearTimeout(first);
      clearInterval(repeat);
      await running;
    },
  };
}
