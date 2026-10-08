import {
  discoveryProfileSchema,
  incomingPullRequestSchema,
  type DiscoveryProfile,
  type DiscoveryQuery,
  type InboxQuery,
  type IncomingPullRequest,
  type Match,
} from '@pro-date/contracts';
import type { DiscoveryRepository, PublicProfileRecord, PagePosition } from '@pro-date/database';

import { decodeDiscoveryCursor, encodeDiscoveryCursor } from './cursor.js';

export function createDiscoveryService(
  repository: DiscoveryRepository,
  getDeliveryUrl: (publicId: string, version: number) => string,
  clock: () => Date = () => new Date(),
) {
  function position(scope: string, cursor: string | undefined): PagePosition {
    return cursor === undefined
      ? { ceiling: clock().toISOString() }
      : decodeDiscoveryCursor(cursor, scope);
  }
  async function assemble(records: PublicProfileRecord[]): Promise<Map<string, DiscoveryProfile>> {
    const media = await repository.media(records.map((record) => record.userId));
    return new Map(
      records
        .filter(
          (record) =>
            media.photos.filter((photo) => photo.userId === record.userId).length >= 4 &&
            media.prompts.filter((prompt) => prompt.userId === record.userId).length === 3,
        )
        .map((record) => [
          record.userId,
          discoveryProfileSchema.parse({
            userId: record.userId,
            displayName: record.displayName,
            age: record.age,
            locationLabel: record.locationLabel,
            genderIdentity: record.genderIdentity,
            pronouns: record.pronouns,
            heightCm: record.heightCm,
            relationshipIntent: record.relationshipIntent,
            photos: media.photos
              .filter((photo) => photo.userId === record.userId)
              .map((photo) => ({
                id: photo.id,
                position: photo.position,
                height: photo.height,
                width: photo.width,
                deliveryUrl: getDeliveryUrl(photo.providerPublicId, photo.providerVersion),
              })),
            prompts: media.prompts
              .filter((prompt) => prompt.userId === record.userId)
              .map((prompt) => ({
                id: prompt.id,
                position: prompt.position,
                promptId: prompt.promptId,
                answer: prompt.answer,
              })),
          }),
        ]),
    );
  }
  function nextCursor<T>(
    records: T[],
    limit: number,
    scope: string,
    ceiling: string,
    key: (record: T) => { id: string; at: string },
  ): string | null {
    const last = records[limit - 1];
    return records.length > limit && last !== undefined
      ? encodeDiscoveryCursor(scope, { ...key(last), ceiling })
      : null;
  }
  return {
    async browse(this: void, viewerId: string, query: DiscoveryQuery) {
      const scope = `discovery:${viewerId}:${query.radiusKm}:${query.minAge}:${query.maxAge}`;
      const start = position(scope, query.cursor);
      const records = await repository.browse(viewerId, query, start);
      const profiles = await assemble(records.slice(0, query.limit));
      return {
        data: [...profiles.values()],
        nextCursor: nextCursor(records, query.limit, scope, start.ceiling, (row) => ({
          id: row.userId,
          at: row.cursorAt,
        })),
      };
    },
    async inbox(this: void, viewerId: string, query: InboxQuery) {
      const scope = `inbox:${viewerId}`;
      const start = position(scope, query.cursor);
      const records = await repository.inbox(viewerId, query, start);
      const selected = records.slice(0, query.limit);
      const profiles = await assemble(selected);
      const data: IncomingPullRequest[] = selected
        .filter((row) => profiles.has(row.userId))
        .map((row) =>
          incomingPullRequestSchema.parse({
            id: row.requestId,
            sender: profiles.get(row.userId),
            comment: row.comment,
            createdAt: row.requestAt,
            target:
              row.targetType === 'PHOTO'
                ? {
                    type: 'PHOTO',
                    id: row.targetId,
                    deliveryUrl: getDeliveryUrl(row.photoPublicId!, row.photoVersion!),
                  }
                : {
                    type: 'PROMPT',
                    id: row.targetId,
                    promptId: row.promptId,
                    answer: row.promptAnswer,
                  },
          }),
        );
      return {
        data,
        nextCursor: nextCursor(records, query.limit, scope, start.ceiling, (row) => ({
          id: row.requestId,
          at: row.requestAt,
        })),
      };
    },
    async listMatches(this: void, viewerId: string, query: InboxQuery) {
      const scope = `matches:${viewerId}`;
      const start = position(scope, query.cursor);
      const records = await repository.listMatches(viewerId, query, start);
      const selected = records.slice(0, query.limit);
      const profiles = await assemble(selected);
      const data: Match[] = selected
        .filter((row) => profiles.has(row.userId))
        .map((row) => ({
          id: row.matchId,
          profile: profiles.get(row.userId)!,
          createdAt: row.matchAt,
        }));
      return {
        data,
        nextCursor: nextCursor(records, query.limit, scope, start.ceiling, (row) => ({
          id: row.matchId,
          at: row.matchAt,
        })),
      };
    },
    send: (viewerId: string, input: Parameters<DiscoveryRepository['send']>[1]) =>
      repository.send(viewerId, input),
    respond: (viewerId: string, requestId: string, decision: 'MERGED' | 'DECLINED') =>
      repository.respond(viewerId, requestId, decision),
    pass: (viewerId: string, otherId: string) => repository.pass(viewerId, otherId),
    block: (viewerId: string, otherId: string) => repository.block(viewerId, otherId),
    report: (viewerId: string, input: Parameters<DiscoveryRepository['report']>[1]) =>
      repository.report(viewerId, input),
  };
}

export type DiscoveryService = ReturnType<typeof createDiscoveryService>;
