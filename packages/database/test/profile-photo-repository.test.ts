import { drizzle } from 'drizzle-orm/node-postgres';
import { describe, expect, it } from 'vitest';

import {
  buildProfilePhotoInsertQuery,
  buildProfilePhotoListQuery,
  buildProfilePhotoOrderUpdateQuery,
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
    expect(params).toEqual(
      expect.arrayContaining([secondPhotoId, 0, firstPhotoId, 1, userId]),
    );
  });
});
