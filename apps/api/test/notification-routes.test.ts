import pino from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { DiscoveryError, type NotificationPreferencesRepository } from '@pro-date/database';
import { createApiApp } from '../src/app.js';
import {
  apiErrorResponseSchema,
  notificationSettingsResponseSchema,
  conversationNotificationResponseSchema,
} from '@pro-date/contracts';

const owner = '10000000-0000-4000-8000-000000000001';
const id = '10000000-0000-4000-8000-000000000002';
function setup(subject: string | null = 'verified', enabled = true) {
  const repository: NotificationPreferencesRepository = {
    settings: vi.fn().mockResolvedValue({ isPaused: false, revision: 0 }),
    saveSettings: vi.fn().mockResolvedValue({ isPaused: true, revision: 1 }),
    conversation: vi.fn().mockResolvedValue({ isEnabled: false, revision: 0 }),
    saveConversation: vi.fn().mockResolvedValue({ isEnabled: true, revision: 1 }),
  };
  const findCurrentUser = vi
    .fn()
    .mockResolvedValue({ id: owner, onboardingStatus: 'COMPLETE', onboardingStep: 'COMPLETE' });
  const app = createApiApp({
    logger: pino({ level: 'silent' }),
    requestId: () => id,
    resolveClerkSubject: () => subject,
    findCurrentUser,
    notificationPreferences: { repository, enabled },
  });
  return { app, repository, findCurrentUser };
}
describe('account-owned notification preferences', () => {
  it('requires authentication and a published account on every endpoint', async () => {
    const { app, repository } = setup(null);
    await request(app).get('/v1/notification-settings').expect(401);
    await request(app)
      .patch(`/v1/conversations/${id}/notification-preference`)
      .send({ isEnabled: true })
      .expect(401);
    expect(repository.saveConversation).not.toHaveBeenCalled();
    const unpublished = setup();
    unpublished.findCurrentUser.mockResolvedValue({
      id: owner,
      onboardingStatus: 'IN_PROGRESS',
      onboardingStep: 'PROMPTS',
    });
    await request(unpublished.app).get('/v1/notification-settings').expect(409);
  });
  it('returns setup-pending defaults without touching unmigrated tables', async () => {
    const { app, repository } = setup('verified', false);
    const response = await request(app).get('/v1/notification-settings').expect(200);
    expect(notificationSettingsResponseSchema.parse(response.body).data).toEqual({
      isPaused: false,
      revision: 0,
      isAvailable: false,
      isDeliveryReady: false,
    });
    await request(app).patch('/v1/notification-settings').send({ isPaused: true }).expect(503);
    expect(repository.settings).not.toHaveBeenCalled();
    expect(repository.saveSettings).not.toHaveBeenCalled();
    await request(app).get('/v1/notification-settings/').expect(200);
  });
  it('takes recipient from verified identity and rejects forged owners, coercion and invalid IDs', async () => {
    const { app, repository } = setup();
    await request(app)
      .patch(`/v1/conversations/${id}/notification-preference`)
      .send({ isEnabled: true, userId: id })
      .expect(422);
    await request(app)
      .patch(`/v1/conversations/${id}/notification-preference`)
      .send({ isEnabled: 'true' })
      .expect(422);
    await request(app)
      .patch('/v1/conversations/invalid/notification-preference')
      .send({ isEnabled: true })
      .expect(422);
    expect(repository.saveConversation).not.toHaveBeenCalled();
    const response = await request(app)
      .patch(`/v1/conversations/${id}/notification-preference`)
      .send({ isEnabled: true })
      .expect(200);
    expect(repository.saveConversation).toHaveBeenCalledWith(owner, id, true);
    expect(conversationNotificationResponseSchema.parse(response.body).data).toEqual({
      conversationId: id,
      isEnabled: true,
      revision: 1,
      isAvailable: true,
      isDeliveryReady: false,
    });
  });
  it('preserves non-disclosing unavailable behavior for other members, blocks and unmatches', async () => {
    const { app, repository } = setup();
    vi.mocked(repository.conversation).mockRejectedValue(
      new DiscoveryError('NOT_FOUND', 404, 'This conversation is no longer available.'),
    );
    const response = await request(app)
      .get(`/v1/conversations/${id}/notification-preference`)
      .expect(404);
    expect(apiErrorResponseSchema.parse(response.body).error.code).toBe('NOT_FOUND');
  });
  it('updates only the account pause state without replacing chat preferences', async () => {
    const { app, repository } = setup();
    await request(app).patch('/v1/notification-settings').send({ isPaused: true }).expect(200);
    expect(repository.saveSettings).toHaveBeenCalledWith(owner, true);
    expect(repository.saveConversation).not.toHaveBeenCalled();
  });
});
