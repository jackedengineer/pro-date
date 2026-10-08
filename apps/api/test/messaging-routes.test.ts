import { apiErrorResponseSchema, messageResponseSchema } from '@pro-date/contracts';
import { DiscoveryError } from '@pro-date/database';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApiApp } from '../src/app.js';
import type { MessagingService } from '../src/messaging/messaging-service.js';

const viewerId = '10000000-0000-4000-8000-000000000001';
const id = '10000000-0000-4000-8000-000000000002';
const requestId = '10000000-0000-4000-8000-000000000003';
const message = {
  id,
  conversationId: id,
  senderId: viewerId,
  clientId: id,
  sequence: 1,
  body: 'Hello there.',
  createdAt: '2026-10-08T12:00:00.000Z',
};
function setup(subject: string | null = 'clerk-test') {
  const service: MessagingService = {
    conversations: vi.fn().mockResolvedValue({ data: [], nextCursor: null }),
    conversation: vi.fn(),
    history: vi.fn().mockResolvedValue({
      data: [],
      olderCursor: null,
      nextAfterSequence: null,
      latestSequence: 0,
    }),
    send: vi.fn().mockResolvedValue(message),
    unmatch: vi.fn(),
  };
  const app = createApiApp({
    logger: pino({ level: 'silent' }),
    requestId: () => requestId,
    resolveClerkSubject: () => subject,
    findCurrentUser: vi.fn().mockResolvedValue({
      id: viewerId,
      onboardingStatus: 'COMPLETE',
      onboardingStep: 'COMPLETE',
    }),
    messagingService: service,
  });
  return { app, service };
}
describe('private messaging routes', () => {
  it('requires Clerk authentication for history, send, and inbox', async () => {
    const { app, service } = setup(null);
    await request(app).get('/v1/conversations').expect(401);
    await request(app).get(`/v1/conversations/${id}/messages`).expect(401);
    await request(app)
      .post(`/v1/conversations/${id}/messages`)
      .send({ clientId: id, body: 'Hello' })
      .expect(401);
    expect(service.send).not.toHaveBeenCalled();
  });
  it('takes sender only from verified identity and rejects forged fields', async () => {
    const { app, service } = setup();
    await request(app)
      .post(`/v1/conversations/${id}/messages`)
      .send({ clientId: id, body: 'Hello', senderId: id })
      .expect(422);
    const response = await request(app)
      .post(`/v1/conversations/${id}/messages`)
      .send({ clientId: id, body: ' Hello there. ' })
      .expect(200);
    expect(messageResponseSchema.parse(response.body).data).toEqual(message);
    expect(service.send).toHaveBeenCalledWith(viewerId, id, { clientId: id, body: 'Hello there.' });
  });
  it('rejects invalid IDs and invalid pagination before repository access', async () => {
    const { app, service } = setup();
    await request(app).get('/v1/conversations/not-a-uuid/messages').expect(422);
    await request(app).get(`/v1/conversations/${id}/messages?limit=500`).expect(422);
    expect(service.history).not.toHaveBeenCalled();
  });
  it('returns a safe unavailable error for non-members, blocks, or unmatch', async () => {
    const { app, service } = setup();
    vi.mocked(service.history).mockRejectedValue(
      new DiscoveryError('NOT_FOUND', 404, 'This conversation is no longer available.'),
    );
    const response = await request(app).get(`/v1/conversations/${id}/messages`).expect(404);
    expect(apiErrorResponseSchema.parse(response.body).error.code).toBe('NOT_FOUND');
  });
  it('unmatches only as the authenticated member', async () => {
    const { app, service } = setup();
    await request(app).delete(`/v1/conversations/${id}`).expect(200);
    expect(service.unmatch).toHaveBeenCalledWith(viewerId, id);
  });
});
