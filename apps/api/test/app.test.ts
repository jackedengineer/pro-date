import {
  apiErrorResponseSchema,
  currentUserResponseSchema,
  healthResponseSchema,
  profileResponseSchema,
} from '@pro-date/contracts';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApiApp, type ApiAppOptions } from '../src/app.js';

const requestId = '59a2c4a6-110e-470e-bcab-c762c18dec45';
const timestamp = '2026-10-04T11:00:00.000Z';

function createTestApp(options: ApiAppOptions = {}) {
  return createApiApp({
    clock: () => new Date(timestamp),
    logger: pino({ level: 'silent' }),
    requestId: () => requestId,
    ...options,
  });
}

describe('API application', () => {
  it('returns a contract-valid liveness response', async () => {
    const response = await request(createTestApp()).get('/health/live').expect(200);

    expect(response.headers['x-request-id']).toBe(requestId);
    expect(healthResponseSchema.parse(response.body)).toEqual({
      requestId,
      service: 'api',
      status: 'ok',
      timestamp,
    });
  });

  it('returns readiness only when dependencies are available', async () => {
    const response = await request(createTestApp()).get('/health/ready').expect(200);

    expect(healthResponseSchema.parse(response.body)).toEqual({
      checks: { application: 'up' },
      requestId,
      service: 'api',
      status: 'ok',
      timestamp,
    });
  });

  it('returns a safe unavailable response when readiness fails', async () => {
    const response = await request(
      createTestApp({
        readinessCheck: () =>
          Promise.reject<Record<string, 'up' | 'down'>>(
            new Error('postgres://admin:secret@example.test'),
          ),
      }),
    )
      .get('/health/ready')
      .expect(503);

    expect(healthResponseSchema.parse(response.body)).toEqual({
      checks: { application: 'down' },
      requestId,
      service: 'api',
      status: 'unavailable',
      timestamp,
    });
    expect(JSON.stringify(response.body)).not.toContain('secret');
  });

  it('returns a safe JSON envelope for an unknown route', async () => {
    const response = await request(createTestApp()).get('/v1/unknown').expect(404);

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(apiErrorResponseSchema.parse(response.body)).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
      },
      requestId,
    });
  });

  it('handles malformed JSON without exposing implementation details', async () => {
    const response = await request(createTestApp())
      .post('/v1/unknown')
      .set('content-type', 'application/json')
      .send('{')
      .expect(400);

    expect(apiErrorResponseSchema.parse(response.body)).toEqual({
      error: {
        code: 'MALFORMED_JSON',
        message: 'The request body must contain valid JSON.',
      },
      requestId,
    });
    expect(JSON.stringify(response.body)).not.toContain('SyntaxError');
  });

  it('rejects an unauthenticated current-user bootstrap request', async () => {
    const response = await request(createTestApp()).put('/v1/users/me').expect(401);

    expect(apiErrorResponseSchema.parse(response.body)).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication is required.',
      },
      requestId,
    });
  });

  it('creates or retrieves the current internal user without exposing the Clerk subject', async () => {
    const findOrCreateCurrentUser = vi.fn().mockResolvedValue({
      id: '729438da-99b3-4d3d-b566-bfe94401829b',
      onboardingStep: 'NAME',
      onboardingStatus: 'NOT_STARTED',
    });

    const response = await request(
      createTestApp({
        findOrCreateCurrentUser,
        resolveClerkSubject: () => 'user_private_clerk_subject',
      }),
    )
      .put('/v1/users/me')
      .expect(200);

    expect(findOrCreateCurrentUser).toHaveBeenCalledOnce();
    expect(findOrCreateCurrentUser).toHaveBeenCalledWith('user_private_clerk_subject');
    expect(currentUserResponseSchema.parse(response.body)).toEqual({
      data: {
        id: '729438da-99b3-4d3d-b566-bfe94401829b',
        onboardingStep: 'NAME',
        onboardingStatus: 'NOT_STARTED',
      },
      requestId,
    });
    expect(JSON.stringify(response.body)).not.toContain('user_private_clerk_subject');
  });

  it('returns the same current user when bootstrap is repeated', async () => {
    const currentUser = {
      id: '729438da-99b3-4d3d-b566-bfe94401829b',
      onboardingStep: 'BIRTHDAY' as const,
      onboardingStatus: 'IN_PROGRESS' as const,
    };
    const findOrCreateCurrentUser = vi.fn().mockResolvedValue(currentUser);
    const app = createTestApp({
      findOrCreateCurrentUser,
      resolveClerkSubject: () => 'user_private_clerk_subject',
    });

    const firstResponse = await request(app).put('/v1/users/me').expect(200);
    const secondResponse = await request(app).put('/v1/users/me').expect(200);

    expect(currentUserResponseSchema.parse(firstResponse.body).data).toEqual(currentUser);
    expect(currentUserResponseSchema.parse(secondResponse.body).data).toEqual(currentUser);
    expect(findOrCreateCurrentUser).toHaveBeenCalledTimes(2);
  });

  it('rejects an unauthenticated profile update', async () => {
    const response = await request(createTestApp())
      .patch('/v1/users/me/profile')
      .send({ displayName: 'Ada' })
      .expect(401);

    expect(apiErrorResponseSchema.parse(response.body)).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication is required.',
      },
      requestId,
    });
  });

  it('returns field-level details for an invalid profile update', async () => {
    const response = await request(
      createTestApp({ resolveClerkSubject: () => 'user_private_clerk_subject' }),
    )
      .patch('/v1/users/me/profile')
      .send({ displayName: 'A' })
      .expect(422);

    expect(apiErrorResponseSchema.parse(response.body)).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [
          {
            code: 'too_small',
            message: 'Your name must be between 2 and 40 characters.',
            path: 'displayName',
          },
        ],
        message: 'Check the highlighted profile fields.',
      },
      requestId,
    });
  });

  it('persists a trimmed display name and advances onboarding', async () => {
    const findOrCreateCurrentUser = vi.fn().mockResolvedValue({
      id: '729438da-99b3-4d3d-b566-bfe94401829b',
      onboardingStep: 'NAME',
      onboardingStatus: 'NOT_STARTED',
    });
    const saveProfileDisplayName = vi.fn().mockResolvedValue({
      birthDate: null,
      displayName: 'Ada',
      onboardingStatus: 'IN_PROGRESS',
      onboardingStep: 'BIRTHDAY',
    });

    const response = await request(
      createTestApp({
        findOrCreateCurrentUser,
        resolveClerkSubject: () => 'user_private_clerk_subject',
        saveProfileDisplayName,
      }),
    )
      .patch('/v1/users/me/profile')
      .send({ displayName: '  Ada  ' })
      .expect(200);

    expect(findOrCreateCurrentUser).toHaveBeenCalledWith('user_private_clerk_subject');
    expect(saveProfileDisplayName).toHaveBeenCalledWith(
      '729438da-99b3-4d3d-b566-bfe94401829b',
      'Ada',
    );
    expect(profileResponseSchema.parse(response.body)).toEqual({
      data: {
        birthDate: null,
        displayName: 'Ada',
        onboardingStatus: 'IN_PROGRESS',
        onboardingStep: 'BIRTHDAY',
      },
      requestId,
    });
    expect(JSON.stringify(response.body)).not.toContain('user_private_clerk_subject');
  });

  it('rejects a birthday that is under 18 using the server clock', async () => {
    const saveProfileBirthDate = vi.fn();
    const response = await request(
      createTestApp({
        resolveClerkSubject: () => 'user_private_clerk_subject',
        saveProfileBirthDate,
      }),
    )
      .patch('/v1/users/me/profile')
      .send({ birthDate: '2008-10-05' })
      .expect(422);

    expect(apiErrorResponseSchema.parse(response.body)).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [
          {
            code: 'too_young',
            message: 'You must be 18 or older to use ProDate.',
            path: 'birthDate',
          },
        ],
        message: 'Check the highlighted profile fields.',
      },
      requestId,
    });
    expect(saveProfileBirthDate).not.toHaveBeenCalled();
  });

  it('persists a calendar birthday and advances onboarding to identity', async () => {
    const findOrCreateCurrentUser = vi.fn().mockResolvedValue({
      id: '729438da-99b3-4d3d-b566-bfe94401829b',
      onboardingStep: 'BIRTHDAY',
      onboardingStatus: 'IN_PROGRESS',
    });
    const saveProfileBirthDate = vi.fn().mockResolvedValue({
      birthDate: '2000-02-29',
      displayName: 'Ada',
      onboardingStatus: 'IN_PROGRESS',
      onboardingStep: 'IDENTITY',
    });

    const response = await request(
      createTestApp({
        findOrCreateCurrentUser,
        resolveClerkSubject: () => 'user_private_clerk_subject',
        saveProfileBirthDate,
      }),
    )
      .patch('/v1/users/me/profile')
      .send({ birthDate: '2000-02-29' })
      .expect(200);

    expect(saveProfileBirthDate).toHaveBeenCalledWith(
      '729438da-99b3-4d3d-b566-bfe94401829b',
      '2000-02-29',
    );
    expect(profileResponseSchema.parse(response.body)).toEqual({
      data: {
        birthDate: '2000-02-29',
        displayName: 'Ada',
        onboardingStatus: 'IN_PROGRESS',
        onboardingStep: 'IDENTITY',
      },
      requestId,
    });
  });
});
