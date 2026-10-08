import { describe, expect, it, vi } from 'vitest';
import type { DiscoveryRepository, PublicProfileRecord } from '@pro-date/database';
import { createDiscoveryService } from '../src/discovery/discovery-service.js';
import { decodeDiscoveryCursor } from '../src/discovery/cursor.js';

const viewerId = '729438da-99b3-4d3d-b566-bfe94401829b';
const otherId = '10000000-0000-4000-8000-000000000001';
const row: PublicProfileRecord = {
  userId: otherId,
  displayName: 'Avery',
  age: 28,
  locationLabel: 'Fixture City',
  genderIdentity: null,
  pronouns: null,
  heightCm: null,
  relationshipIntent: 'LONG_TERM',
  cursorAt: '2026-01-01T00:00:00.123456Z',
};
function repository(): DiscoveryRepository {
  return {
    browse: vi.fn().mockResolvedValue([row, { ...row, userId: viewerId }]),
    media: vi.fn().mockResolvedValue({
      photos: Array.from({ length: 4 }, (_, position) => ({
        userId: otherId,
        id: `00000000-0000-4000-8000-${(position + 1).toString().padStart(12, '0')}`,
        position,
        height: 1600,
        width: 1200,
        providerPublicId: 'fixture',
        providerVersion: 1,
      })),
      prompts: ['weekend_build', 'debug_bad_day', 'merge_criteria'].map((promptId, position) => ({
        userId: otherId,
        id: `10000000-0000-4000-8000-${(position + 1).toString().padStart(12, '0')}`,
        promptId,
        position,
        answer: 'I enjoy making thoughtful products with kind people.',
      })),
    }),
    inbox: vi.fn(),
    listMatches: vi.fn(),
    send: vi.fn(),
    respond: vi.fn(),
    pass: vi.fn(),
    block: vi.fn(),
    report: vi.fn(),
  };
}
describe('discovery service', () => {
  it('omits a profile that becomes incomplete during media retrieval while keeping the page cursor', async () => {
    const repo = repository();
    vi.mocked(repo.media).mockResolvedValue({ photos: [], prompts: [] });
    const service = createDiscoveryService(
      repo,
      () => 'https://res.cloudinary.com/demo/image/upload/fixture.jpg',
    );
    const result = await service.browse(viewerId, {
      limit: 1,
      radiusKm: 50,
      minAge: 18,
      maxAge: 99,
    });
    expect(result.data).toEqual([]);
    expect(result.nextCursor).not.toBeNull();
  });
  it('assembles only public fields and emits an opaque cursor for the last displayed candidate', async () => {
    const repo = repository();
    const service = createDiscoveryService(
      repo,
      () => 'https://res.cloudinary.com/demo/image/upload/fixture.jpg',
      () => new Date('2026-10-08T00:00:00.000Z'),
    );
    const result = await service.browse(viewerId, {
      limit: 1,
      radiusKm: 50,
      minAge: 18,
      maxAge: 99,
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.photos).toHaveLength(4);
    expect(result.data[0]).not.toHaveProperty('cursorAt');
    expect(result.data[0]).not.toHaveProperty('birthDate');
    expect(decodeDiscoveryCursor(result.nextCursor!, `discovery:${viewerId}:50:18:99`)).toEqual({
      id: otherId,
      at: row.cursorAt,
      ceiling: '2026-10-08T00:00:00.000Z',
    });
  });
  it('rejects a cursor reused by a different viewer before reading profiles', async () => {
    const repo = repository();
    const service = createDiscoveryService(
      repo,
      () => 'https://res.cloudinary.com/demo/image/upload/fixture.jpg',
    );
    const result = await service.browse(viewerId, {
      limit: 1,
      radiusKm: 50,
      minAge: 18,
      maxAge: 99,
    });
    vi.mocked(repo.browse).mockClear();
    await expect(
      service.browse(otherId, {
        cursor: result.nextCursor!,
        limit: 1,
        radiusKm: 50,
        minAge: 18,
        maxAge: 99,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
    expect(repo.browse).not.toHaveBeenCalled();
  });
});
