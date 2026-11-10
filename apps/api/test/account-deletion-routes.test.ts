import { accountDeletionResponseSchema, apiErrorResponseSchema } from '@pro-date/contracts';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApiApp, type ApiAppOptions } from '../src/app.js';

const requestId = '59a2c4a6-110e-470e-bcab-c762c18dec45';

function createTestApp(options: ApiAppOptions = {}) {
  return createApiApp({
    logger: pino({ level: 'silent' }),
    requestId: () => requestId,
    ...options,
  });
}

describe('DELETE /v1/users/me', () => {
  it('requires a signed-in member', async () => {
    const deleteAccount = vi.fn();
    const response = await request(createTestApp({ accountDeletionService: { deleteAccount } }))
      .delete('/v1/users/me')
      .expect(401);

    expect(apiErrorResponseSchema.parse(response.body).error.code).toBe('UNAUTHORIZED');
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("deletes the caller's own account and reports the outcome", async () => {
    const deleteAccount = vi.fn().mockResolvedValue({ deleted: true, signInRemoved: true });
    const response = await request(
      createTestApp({
        accountDeletionService: { deleteAccount },
        resolveClerkSubject: () => 'user_private_clerk_subject',
      }),
    )
      .delete('/v1/users/me')
      .expect(200);

    expect(accountDeletionResponseSchema.parse(response.body).data).toEqual({
      deleted: true,
      signInRemoved: true,
    });
    // The subject comes from the verified session, never from the request.
    expect(deleteAccount).toHaveBeenCalledWith('user_private_clerk_subject');
  });

  it('says so when deletion is not configured, instead of pretending', async () => {
    const response = await request(
      createTestApp({ resolveClerkSubject: () => 'user_private_clerk_subject' }),
    )
      .delete('/v1/users/me')
      .expect(503);

    expect(apiErrorResponseSchema.parse(response.body).error.code).toBe(
      'ACCOUNT_DELETION_UNAVAILABLE',
    );
  });

  it('fails without a partial success when the data could not be deleted', async () => {
    const response = await request(
      createTestApp({
        accountDeletionService: {
          deleteAccount: vi.fn().mockRejectedValue(new Error('database down')),
        },
        resolveClerkSubject: () => 'user_private_clerk_subject',
      }),
    )
      .delete('/v1/users/me')
      .expect(500);

    expect(response.body).not.toHaveProperty('data');
  });
});
