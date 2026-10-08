import pino from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { DiscoveryError } from '@pro-date/database';
import { apiErrorResponseSchema } from '@pro-date/contracts';
import { createApiApp } from '../src/app.js';
import type { DiscoveryService } from '../src/discovery/discovery-service.js';

const viewerId = '729438da-99b3-4d3d-b566-bfe94401829b';
const otherId = '10000000-0000-4000-8000-000000000001';
const requestId = '59a2c4a6-110e-470e-bcab-c762c18dec45';
function service(): DiscoveryService {
  return {
    browse: vi.fn().mockResolvedValue({ data: [], nextCursor: null }),
    inbox: vi.fn().mockResolvedValue({ data: [], nextCursor: null }),
    listMatches: vi.fn().mockResolvedValue({ data: [], nextCursor: null }),
    send: vi.fn().mockResolvedValue({ id: otherId, status: 'PENDING', matchId: null }),
    respond: vi.fn(),
    pass: vi.fn(),
    block: vi.fn(),
    report: vi.fn(),
  };
}
function app(
  discoveryService = service(),
  status: 'COMPLETE' | 'IN_PROGRESS' = 'COMPLETE',
  authenticated = true,
) {
  return createApiApp({
    logger: pino({ level: 'silent' }),
    requestId: () => requestId,
    discoveryService,
    resolveClerkSubject: () => (authenticated ? 'user_clerk_test' : null),
    findOrCreateCurrentUser: () =>
      Promise.resolve({
        id: viewerId,
        onboardingStatus: status,
        onboardingStep: status === 'COMPLETE' ? 'COMPLETE' : 'REVIEW',
      }),
  });
}
describe('discovery and engagement routes', () => {
  it('requires authentication and completed onboarding', async () => {
    await request(app(service(), 'COMPLETE', false))
      .get('/v1/discovery')
      .expect(401);
    await request(app(service(), 'IN_PROGRESS')).get('/v1/discovery').expect(409);
  });
  it('validates filters and resolves the viewer from the authenticated session', async () => {
    const actions = service();
    await request(app(actions)).get('/v1/discovery?minAge=17').expect(422);
    const result = await request(app(actions)).get('/v1/discovery?radiusKm=25').expect(200);
    expect(result.body).toEqual({ data: [], nextCursor: null, requestId });
    expect(actions.browse).toHaveBeenCalledWith(viewerId, {
      limit: 10,
      minAge: 18,
      maxAge: 99,
      radiusKm: 25,
    });
  });
  it('accepts only item-specific requests and rejects forged sender fields', async () => {
    const actions = service();
    const input = {
      recipientUserId: otherId,
      targetType: 'PROMPT',
      targetId: otherId,
      comment: '   This is my kind of side project.   ',
    };
    await request(app(actions))
      .post('/v1/pull-requests')
      .send({ ...input, senderUserId: otherId })
      .expect(422);
    await request(app(actions)).post('/v1/pull-requests').send(input).expect(200);
    expect(actions.send).toHaveBeenCalledWith(viewerId, {
      ...input,
      comment: 'This is my kind of side project.',
    });
  });
  it('maps a stale target or blocked pair to a safe domain error', async () => {
    const actions = service();
    vi.mocked(actions.send).mockRejectedValue(
      new DiscoveryError('NOT_FOUND', 404, 'This profile is unavailable.'),
    );
    const result = await request(app(actions))
      .post('/v1/pull-requests')
      .send({ recipientUserId: otherId, targetType: 'PHOTO', targetId: otherId })
      .expect(404);
    expect(apiErrorResponseSchema.parse(result.body).error.code).toBe('NOT_FOUND');
  });
  it('validates responses and persists report-and-block through the authenticated viewer', async () => {
    const actions = service();
    vi.mocked(actions.respond).mockResolvedValue({
      id: otherId,
      status: 'MERGED',
      matchId: otherId,
    });
    await request(app(actions))
      .put(`/v1/pull-requests/${otherId}/response`)
      .send({ decision: 'MERGED' })
      .expect(200);
    expect(actions.respond).toHaveBeenCalledWith(viewerId, otherId, 'MERGED');
    await request(app(actions))
      .put('/v1/reports')
      .send({ userId: otherId, reason: 'HARASSMENT' })
      .expect(200);
    expect(actions.report).toHaveBeenCalledWith(viewerId, {
      userId: otherId,
      reason: 'HARASSMENT',
      details: '',
    });
    await request(app(actions)).put('/v1/blocks').send({ userId: otherId }).expect(200);
    expect(actions.block).toHaveBeenCalledWith(viewerId, otherId);
  });
});
