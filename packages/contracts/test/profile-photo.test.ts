import { describe, expect, it } from 'vitest';

import {
  completeProfilePhotosRequestSchema,
  createProfilePhotoRequestSchema,
  profilePhotoListResponseSchema,
  profilePhotoUploadIntentResponseSchema,
} from '../src/profile-photo.js';

const firstPhotoId = 'c0b4c84f-68cb-4ba0-b120-7f5af320be1e';
const secondPhotoId = 'f5b6be07-e137-4652-b072-c58cb3f6c3dd';
const providerPublicId =
  'pro-date/users/729438da-99b3-4d3d-b566-bfe94401829b/profile/7d256e61-ed8f-41ba-a8bb-7b5dcc279f29';
const providerSignature = 'a'.repeat(40);

describe('profile photo contracts', () => {
  it('accepts a short-lived signed upload intent without exposing a provider secret', () => {
    const response = profilePhotoUploadIntentResponseSchema.parse({
      data: {
        apiKey: '123456789012345',
        cloudName: 'pro-date-dev',
        maxBytes: 10_485_760,
        publicId: providerPublicId,
        signature: providerSignature,
        timestamp: 1_790_000_000,
        uploadUrl: 'https://api.cloudinary.com/v1_1/pro-date-dev/image/upload',
      },
      requestId: '59a2c4a6-110e-470e-bcab-c762c18dec45',
    });

    expect(response.data).not.toHaveProperty('apiSecret');
  });

  it('accepts only the minimum Cloudinary proof needed for server-side confirmation', () => {
    expect(
      createProfilePhotoRequestSchema.parse({
        position: 0,
        publicId: providerPublicId,
        signature: providerSignature,
        version: 1_790_000_001,
      }),
    ).toEqual({
      position: 0,
      publicId: providerPublicId,
      signature: providerSignature,
      version: 1_790_000_001,
    });
  });

  it('rejects positions outside the six-slot profile grid', () => {
    expect(
      createProfilePhotoRequestSchema.safeParse({
        position: 6,
        publicId: providerPublicId,
        signature: providerSignature,
        version: 1_790_000_001,
      }).success,
    ).toBe(false);
  });

  it('requires four to six unique photo IDs before advancing to prompts', () => {
    const fourPhotoIds = [
      firstPhotoId,
      secondPhotoId,
      'cff2a792-62bc-48ef-88ec-a9aee6b6797d',
      'd55c9466-4a17-42cd-a37f-4f5ec835579b',
    ];

    expect(completeProfilePhotosRequestSchema.parse({ photoIds: fourPhotoIds })).toEqual({
      photoIds: fourPhotoIds,
    });
    expect(
      completeProfilePhotosRequestSchema.safeParse({ photoIds: fourPhotoIds.slice(0, 3) }).success,
    ).toBe(false);
    expect(
      completeProfilePhotosRequestSchema.safeParse({
        photoIds: [firstPhotoId, secondPhotoId, firstPhotoId, secondPhotoId],
      }).success,
    ).toBe(false);
  });

  it('returns ordered delivery metadata without provider credentials', () => {
    const response = profilePhotoListResponseSchema.parse({
      data: [
        {
          deliveryUrl:
            'https://res.cloudinary.com/pro-date-dev/image/upload/c_fill,g_auto,h_1200,w_960/q_auto/f_auto/v1790000001/pro-date/users/user/profile/asset-1',
          height: 1600,
          id: firstPhotoId,
          position: 0,
          width: 1200,
        },
      ],
      onboardingStep: 'PHOTOS',
      requestId: '59a2c4a6-110e-470e-bcab-c762c18dec45',
    });

    expect(response.data[0]?.position).toBe(0);
    expect(JSON.stringify(response)).not.toContain('apiKey');
  });
});
