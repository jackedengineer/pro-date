import pino from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { DiscoveryError, type NotificationDeviceRepository } from '@pro-date/database';
import { apiErrorResponseSchema, notificationDeviceResponseSchema } from '@pro-date/contracts';
import { createApiApp } from '../src/app.js';
const owner = '10000000-0000-4000-8000-000000000001';
const installation = '10000000-0000-4000-8000-000000000002';
const project = '10000000-0000-4000-8000-000000000003';
const input = {
  bindingSecret: 'a'.repeat(64),
  expectedVersion: 0,
  operationId: owner,
  token: 'ExpoPushToken[test-token]',
  platform: 'ios',
  projectId: project,
};
function setup({
  subject = 'verified',
  enabled = true,
  projectId = project,
}: {
  subject?: string;
  enabled?: boolean;
  projectId?: string | null;
} = {}) {
  const repository: NotificationDeviceRepository = {
    register: vi
      .fn()
      .mockResolvedValue({ installationId: installation, version: 1, isRegistered: true }),
    revoke: vi
      .fn()
      .mockResolvedValue({ installationId: installation, version: 2, isRegistered: false }),
  };
  const findCurrentUser = vi
    .fn()
    .mockResolvedValue({ id: owner, onboardingStatus: 'COMPLETE', onboardingStep: 'COMPLETE' });
  const app = createApiApp({
    logger: pino({ level: 'silent' }),
    requestId: () => project,
    resolveClerkSubject: () => subject || null,
    findCurrentUser,
    notificationDevices: { repository, enabled, projectId },
  });
  return { app, repository, findCurrentUser };
}
describe('write-only device registration API', () => {
  it('requires a published authenticated account for register and revoke', async () => {
    const { app, repository } = setup({ subject: '' });
    await request(app).put(`/v1/notification-devices/${installation}`).send(input).expect(401);
    await request(app).delete(`/v1/notification-devices/${installation}`).send(input).expect(401);
    expect(repository.register).not.toHaveBeenCalled();
    const unpublished = setup();
    unpublished.findCurrentUser.mockResolvedValue({
      id: owner,
      onboardingStatus: 'IN_PROGRESS',
      onboardingStep: 'NAME',
    });
    await request(unpublished.app)
      .put(`/v1/notification-devices/${installation}`)
      .send(input)
      .expect(409);
  });
  it('does not touch unmigrated tables or bind to a client-selected project', async () => {
    for (const options of [{ enabled: false }, { projectId: null }]) {
      const { app, repository } = setup(options);
      await request(app).put(`/v1/notification-devices/${installation}`).send(input).expect(503);
      expect(repository.register).not.toHaveBeenCalled();
    }
    const { app, repository } = setup();
    for (const payload of [
      { ...input, ownerId: project },
      { ...input, projectId: owner },
      { ...input, token: 'bad-token' },
    ])
      await request(app).put(`/v1/notification-devices/${installation}`).send(payload).expect(422);
    await request(app).put('/v1/notification-devices/invalid').send(input).expect(422);
    expect(repository.register).not.toHaveBeenCalled();
  });
  it('derives owner from Clerk and returns no proof or token', async () => {
    const { app, repository } = setup();
    const response = await request(app)
      .put(`/v1/notification-devices/${installation}`)
      .send(input)
      .expect(200);
    expect(repository.register).toHaveBeenCalledWith(owner, installation, input);
    expect(notificationDeviceResponseSchema.parse(response.body).data).toEqual({
      installationId: installation,
      version: 1,
      isRegistered: true,
    });
    expect(JSON.stringify(response.body)).not.toContain(input.bindingSecret);
    expect(JSON.stringify(response.body)).not.toContain(input.token);
    const revoke = { bindingSecret: input.bindingSecret, expectedVersion: 1, operationId: project };
    const revoked = await request(app)
      .delete(`/v1/notification-devices/${installation}`)
      .send(revoke)
      .expect(200);
    expect(repository.revoke).toHaveBeenCalledWith(owner, installation, revoke);
    expect(notificationDeviceResponseSchema.parse(revoked.body).data.isRegistered).toBe(false);
  });
  it('returns a generic conflict for a forged or obsolete installation operation', async () => {
    const { app, repository } = setup();
    vi.mocked(repository.register).mockRejectedValue(
      new DiscoveryError('CONFLICT', 409, 'Device registration changed.'),
    );
    const response = await request(app)
      .put(`/v1/notification-devices/${installation}`)
      .send(input)
      .expect(409);
    expect(apiErrorResponseSchema.parse(response.body).error.code).toBe('CONFLICT');
  });
  it('allows an authenticated revocation when project configuration was removed', async () => {
    const { app, repository } = setup({ projectId: null });
    const revoke = { bindingSecret: input.bindingSecret, expectedVersion: 1, operationId: project };
    await request(app).delete(`/v1/notification-devices/${installation}`).send(revoke).expect(200);
    expect(repository.revoke).toHaveBeenCalled();
  });
});
