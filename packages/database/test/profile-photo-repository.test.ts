import { drizzle } from 'drizzle-orm/node-postgres';
import { describe, expect, it } from 'vitest';

import {
  assertPhotoRemovalAllowed,
  buildProfilePhotoCompactQuery,
  buildProfilePhotoDeleteQuery,
  buildProfilePhotoInsertQuery,
  buildProfilePhotoListQuery,
  buildProfilePhotoOrderUpdateQuery,
  buildReferencedPhotoAssetQueries,
  ProfilePhotoMinimumError,
} from '../src/profile-photo-repository.js';
import * as schema from '../src/schema.js';

const userId = '729438da-99b3-4d3d-b566-bfe94401829b';
const firstPhotoId = 'c0b4c84f-68cb-4ba0-b120-7f5af320be1e';
const secondPhotoId = 'f5b6be07-e137-4652-b072-c58cb3f6c3dd';

describe('profile photo repository', () => {
  it('inserts canonical provider metadata under the internal user ID', () => {
    const database = drizzle.mock({ schema });
    const { params, sql } = buildProfilePhotoInsertQuery(database, userId, {
      bytes: 1_250_000,
      format: 'jpg',
      height: 1600,
      position: 0,
      providerAssetId: 'asset-immutable-id',
      providerPublicId: `pro-date/users/${userId}/profile/provider-id`,
      providerVersion: 1_790_000_001,
      width: 1200,
    }).toSQL();

    expect(sql).toContain('insert into "profile_photos"');
    expect(sql).toContain('returning');
    expect(sql).not.toContain('clerk_subject');
    expect(params).toEqual(
      expect.arrayContaining([
        userId,
        'asset-immutable-id',
        `pro-date/users/${userId}/profile/provider-id`,
        1_790_000_001,
        0,
      ]),
    );
  });

  it('lists only the owner photos in presentation order', () => {
    const database = drizzle.mock({ schema });
    const { params, sql } = buildProfilePhotoListQuery(database, userId).toSQL();

    expect(sql).toContain('from "profile_photos"');
    expect(sql).toContain('where "profile_photos"."user_id" = $1');
    expect(sql).toContain('order by "profile_photos"."position"');
    expect(params).toEqual([userId]);
  });

  it('reorders an owned set in one update statement', () => {
    const database = drizzle.mock({ schema });
    const { params, sql } = buildProfilePhotoOrderUpdateQuery(database, userId, [
      secondPhotoId,
      firstPhotoId,
    ]).toSQL();

    expect(sql).toContain('update "profile_photos"');
    expect(sql).toContain('case "profile_photos"."id"');
    expect(sql).toContain('"profile_photos"."user_id" =');
    expect(sql).toContain('"profile_photos"."id" in');
    expect(params).toEqual(expect.arrayContaining([secondPhotoId, 0, firstPhotoId, 1, userId]));
  });

  it('deletes only an owned photo and compacts the remaining positions', () => {
    const database = drizzle.mock({ schema });
    const deletion = buildProfilePhotoDeleteQuery(database, userId, firstPhotoId).toSQL();
    const compaction = buildProfilePhotoCompactQuery(database, userId, 1).toSQL();

    expect(deletion.sql).toContain('delete from "profile_photos"');
    expect(deletion.params).toEqual(expect.arrayContaining([userId, firstPhotoId]));
    expect(compaction.sql).toContain('update "profile_photos"');
    expect(compaction.sql).toContain('"profile_photos"."position" >');
    expect(compaction.params).toEqual(expect.arrayContaining([1, userId]));
  });
});

describe('orphaned upload references', () => {
  it('checks both live profile photos and pull request snapshots', () => {
    const database = drizzle.mock({ schema });
    const ids = ['pro-date/users/a/profile/1', 'pro-date/users/a/profile/2'];
    const [photos, pullRequests] = buildReferencedPhotoAssetQueries(database, ids).map((query) =>
      query.toSQL(),
    );

    expect(photos?.sql).toContain('from "profile_photos"');
    expect(photos?.sql).toContain('"provider_public_id" in ($1, $2)');
    expect(pullRequests?.sql).toContain('from "pull_requests"');
    expect(pullRequests?.sql).toContain('"photo_public_id" in ($1, $2)');
    expect(photos?.params).toEqual(ids);
    expect(pullRequests?.params).toEqual(ids);
  });
});

describe('published profile photo floor', () => {
  it('lets an unpublished draft remove any photo but keeps a live profile at four', () => {
    expect(() => assertPhotoRemovalAllowed(false, 1)).not.toThrow();
    expect(() => assertPhotoRemovalAllowed(true, 5)).not.toThrow();
    expect(() => assertPhotoRemovalAllowed(true, 4)).toThrow(ProfilePhotoMinimumError);
    expect(() => assertPhotoRemovalAllowed(true, 3)).toThrow(ProfilePhotoMinimumError);
  });
});
