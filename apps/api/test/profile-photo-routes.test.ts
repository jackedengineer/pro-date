import {
  apiErrorResponseSchema,
  profilePhotoListResponseSchema,
  profilePhotoUploadIntentResponseSchema,
  type ProfilePhoto,
} from '@pro-date/contracts';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApiApp, type ApiAppOptions } from '../src/app.js';

const requestId = '59a2c4a6-110e-470e-bcab-c762c18dec45';
const userId = '729438da-99b3-4d3d-b566-bfe94401829b';
const publicId =
  'pro-date/users/729438da-99b3-4d3d-b566-bfe94401829b/profile/7d256e61-ed8f-41ba-a8bb-7b5dcc279f29';

const photos: ProfilePhoto[] = [
  {
    deliveryUrl: 'https://res.cloudinary.com/pro-date-dev/image/upload/profile-1.jpg',
    height: 1600,
    id: 'c0b4c84f-68cb-4ba0-b120-7f5af320be1e',
    position: 0,
    width: 1200,
  },
];

function createTestApp(options: ApiAppOptions = {}) {
  return createApiApp({
    clock: () => new Date('2026-10-06T12:00:00.000Z'),
    logger: pino({ level: 'silent' }),
    requestId: () => requestId,
    ...options,
  });
}

function authenticatedOptions(overrides: ApiAppOptions = {}): ApiAppOptions {
  return {
    findOrCreateCurrentUser: vi.fn().mockResolvedValue({
      id: userId,
      onboardingStatus: 'IN_PROGRESS',
      onboardingStep: 'PHOTOS',
    }),
    resolveClerkSubject: () => 'user_private_clerk_subject',
    ...overrides,
  };
}

describe('profile photo routes', () => {
  it('requires authentication for the photo collection', async () => {
    const response = await request(createTestApp()).get('/v1/users/me/profile-photos').expect(401);

    expect(apiErrorResponseSchema.parse(response.body).error.code).toBe('UNAUTHORIZED');
  });

  it('returns a safe unavailable response while provider credentials are incomplete', async () => {
    const response = await request(createTestApp(authenticatedOptions()))
      .post('/v1/users/me/profile-photo-upload-intents')
      .expect(503);

    expect(apiErrorResponseSchema.parse(response.body)).toEqual({
      error: {
        code: 'MEDIA_UNAVAILABLE',
        message: 'Photo uploads are not configured yet.',
      },
      requestId,
    });
  });

  it('issues a contract-valid upload intent at the photo checkpoint', async () => {
    const createUploadIntent = vi.fn().mockReturnValue({
      apiKey: '123456789012345',
      cloudName: 'pro-date-dev',
      maxBytes: 10_485_760,
      publicId,
      signature: 'a'.repeat(40),
      timestamp: 1_791_288_000,
      uploadUrl: 'https://api.cloudinary.com/v1_1/pro-date-dev/image/upload',
    });
    const response = await request(
      createTestApp(
        authenticatedOptions({
          profilePhotoService: {
            add: vi.fn(),
            complete: vi.fn(),
            createUploadIntent,
            list: vi.fn(),
            remove: vi.fn(),
          },
        }),
      ),
    )
      .post('/v1/users/me/profile-photo-upload-intents')
      .expect(201);

    expect(profilePhotoUploadIntentResponseSchema.parse(response.body).data.publicId).toBe(
      publicId,
    );
    expect(createUploadIntent).toHaveBeenCalledWith(userId);
  });

  it('does not issue upload credentials before the photo checkpoint', async () => {
    const createUploadIntent = vi.fn();
    const response = await request(
      createTestApp(
        authenticatedOptions({
          findOrCreateCurrentUser: vi.fn().mockResolvedValue({
            id: userId,
            onboardingStatus: 'IN_PROGRESS',
            onboardingStep: 'DETAILS',
          }),
          profilePhotoService: {
            add: vi.fn(),
            complete: vi.fn(),
            createUploadIntent,
            list: vi.fn(),
            remove: vi.fn(),
          },
        }),
      ),
    )
      .post('/v1/users/me/profile-photo-upload-intents')
      .expect(409);

    expect(apiErrorResponseSchema.parse(response.body).error.code).toBe('ONBOARDING_STEP_REQUIRED');
    expect(createUploadIntent).not.toHaveBeenCalled();
  });

  it('validates provider proof before adding a photo', async () => {
    const add = vi.fn();
    const response = await request(
      createTestApp(
        authenticatedOptions({
          profilePhotoService: {
            add,
            complete: vi.fn(),
            createUploadIntent: vi.fn(),
            list: vi.fn(),
            remove: vi.fn(),
          },
        }),
      ),
    )
      .post('/v1/users/me/profile-photos')
      .send({ position: 9, publicId: 'not-an-asset', signature: 'forged', version: -1 })
      .expect(422);

    expect(apiErrorResponseSchema.parse(response.body).error.code).toBe('VALIDATION_ERROR');
    expect(add).not.toHaveBeenCalled();
  });

  it('confirms and returns the ordered photo collection', async () => {
    const add = vi.fn().mockResolvedValue(photos);
    const response = await request(
      createTestApp(
        authenticatedOptions({
          profilePhotoService: {
            add,
            complete: vi.fn(),
            createUploadIntent: vi.fn(),
            list: vi.fn(),
            remove: vi.fn(),
          },
        }),
      ),
    )
      .post('/v1/users/me/profile-photos')
      .send({ position: 0, publicId, signature: 'a'.repeat(40), version: 1_790_000_001 })
      .expect(201);

    expect(profilePhotoListResponseSchema.parse(response.body)).toEqual({
      data: photos,
      onboardingStep: 'PHOTOS',
      requestId,
    });
    expect(add).toHaveBeenCalledWith(userId, {
      position: 0,
      publicId,
      signature: 'a'.repeat(40),
      version: 1_790_000_001,
    });
  });

  it('requires four unique photos before advancing to prompts', async () => {
    const complete = vi.fn();
    const response = await request(
      createTestApp(
        authenticatedOptions({
          profilePhotoService: {
            add: vi.fn(),
            complete,
            createUploadIntent: vi.fn(),
            list: vi.fn(),
            remove: vi.fn(),
          },
        }),
      ),
    )
      .put('/v1/users/me/profile-photos')
      .send({ photoIds: photos.map((photo) => photo.id) })
      .expect(422);

    expect(apiErrorResponseSchema.parse(response.body).error.code).toBe('VALIDATION_ERROR');
    expect(complete).not.toHaveBeenCalled();
  });

  it('persists ordering and advances an eligible collection to prompts', async () => {
    const fourPhotos = Array.from({ length: 4 }, (_, position) => ({
      ...photos[0]!,
      id: [
        'c0b4c84f-68cb-4ba0-b120-7f5af320be1e',
        'f5b6be07-e137-4652-b072-c58cb3f6c3dd',
        'cff2a792-62bc-48ef-88ec-a9aee6b6797d',
        'd55c9466-4a17-42cd-a37f-4f5ec835579b',
      ][position]!,
      position,
    }));
    const complete = vi.fn().mockResolvedValue({ onboardingStep: 'PROMPTS', photos: fourPhotos });
    const photoIds = fourPhotos.map((photo) => photo.id);
    const response = await request(
      createTestApp(
        authenticatedOptions({
          profilePhotoService: {
            add: vi.fn(),
            complete,
            createUploadIntent: vi.fn(),
            list: vi.fn(),
            remove: vi.fn(),
          },
        }),
      ),
    )
      .put('/v1/users/me/profile-photos')
      .send({ photoIds })
      .expect(200);

    expect(profilePhotoListResponseSchema.parse(response.body).onboardingStep).toBe('PROMPTS');
    expect(complete).toHaveBeenCalledWith(userId, photoIds);
  });

  it('removes an owned photo and returns the compacted collection', async () => {
    const remove = vi.fn().mockResolvedValue([]);
    const response = await request(
      createTestApp(
        authenticatedOptions({
          profilePhotoService: {
            add: vi.fn(),
            complete: vi.fn(),
            createUploadIntent: vi.fn(),
            list: vi.fn(),
            remove,
          },
        }),
      ),
    )
      .delete(`/v1/users/me/profile-photos/${photos[0]!.id}`)
      .expect(200);

    expect(profilePhotoListResponseSchema.parse(response.body).data).toEqual([]);
    expect(remove).toHaveBeenCalledWith(userId, photos[0]!.id);
  });

  it('does not reveal whether another user owns a missing photo', async () => {
    const remove = vi.fn().mockResolvedValue(null);
    const response = await request(
      createTestApp(
        authenticatedOptions({
          profilePhotoService: {
            add: vi.fn(),
            complete: vi.fn(),
            createUploadIntent: vi.fn(),
            list: vi.fn(),
            remove,
          },
        }),
      ),
    )
      .delete(`/v1/users/me/profile-photos/${photos[0]!.id}`)
      .expect(404);

    expect(apiErrorResponseSchema.parse(response.body).error.code).toBe('NOT_FOUND');
  });
});
