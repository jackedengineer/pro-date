import type { Message } from '@pro-date/contracts';
import type { MessagingRepository } from '@pro-date/database';
import { describe, expect, it, vi } from 'vitest';
import { createMessagingService } from '../src/messaging/messaging-service.js';

const viewer = '10000000-0000-4000-8000-000000000001';
const id = '10000000-0000-4000-8000-000000000002';
const message = (sequence: number): Message => ({
  id,
  conversationId: id,
  senderId: viewer,
  clientId: id,
  sequence,
  body: 'Hello',
  createdAt: '2026-10-08T00:00:00.000Z',
});
describe('ordered messaging history', () => {
  it('returns ascending display order, with a cursor bound to both account and conversation', async () => {
    const history = vi
      .fn()
      .mockResolvedValue({ rows: [message(3), message(2), message(1)], latestSequence: 3 });
    const repository = { history } as unknown as MessagingRepository;
    const service = createMessagingService(repository, () => 'https://example.com/photo');
    const page = await service.history(viewer, id, { limit: 2 });
    expect(page.data.map((row) => row.sequence)).toEqual([2, 3]);
    expect(page.olderCursor).not.toBeNull();
    await expect(
      service.history(id, id, { limit: 2, cursor: page.olderCursor! }),
    ).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
    await expect(
      service.history(viewer, viewer, { limit: 2, cursor: page.olderCursor! }),
    ).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
    expect(history).toHaveBeenCalledTimes(1);
  });
  it('advances delta pages only through the returned sequence, not the final database watermark', async () => {
    const repository = {
      history: vi
        .fn()
        .mockResolvedValue({ rows: [message(2), message(3), message(4)], latestSequence: 7 }),
    } as unknown as MessagingRepository;
    const service = createMessagingService(repository, () => 'https://example.com/photo');
    expect(await service.history(viewer, id, { limit: 2, afterSequence: 1 })).toMatchObject({
      nextAfterSequence: 3,
      latestSequence: 7,
      olderCursor: null,
    });
  });
});
