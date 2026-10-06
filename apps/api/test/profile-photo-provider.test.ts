import { describe, expect, it, vi } from 'vitest';

import {
  createProfilePhotoProvider,
  ProfilePhotoProviderError,
  type ProfilePhotoCloudinaryClient,
} from '../src/media/profile-photo-provider.js';

const userId = '729438da-99b3-4d3d-b566-bfe94401829b';
const uploadId = '7d256e61-ed8f-41ba-a8bb-7b5dcc279f29';
const publicId = `pro-date/users/${userId}/profile/${uploadId}`;

function createClient(
  overrides: Partial<ProfilePhotoCloudinaryClient> = {},
): ProfilePhotoCloudinaryClient {
  return {
    buildDeliveryUrl: vi.fn().mockReturnValue('https://res.cloudinary.com/demo/profile.jpg'),
    getResource: vi.fn().mockResolvedValue({
      asset_id: 'asset-immutable-id',
      bytes: 1_250_000,
      format: 'jpg',
      height: 1600,
      public_id: publicId,
      resource_type: 'image',
      type: 'upload',
      version: 1_790_000_001,
      width: 1200,
    }),
    signUpload: vi.fn().mockReturnValue('a'.repeat(40)),
    verifyResponse: vi.fn().mockReturnValue(true),
    ...overrides,
  };
}

describe('profile photo provider', () => {
  it('creates an authenticated upload intent scoped to the internal user', () => {
    const client = createClient();
    const provider = createProfilePhotoProvider({
      apiKey: '123456789012345',
      clock: () => new Date('2026-10-06T12:00:00.000Z'),
      cloudName: 'pro-date-dev',
      client,
      randomId: () => uploadId,
    });

    expect(provider.createUploadIntent(userId)).toEqual({
      apiKey: '123456789012345',
      cloudName: 'pro-date-dev',
      maxBytes: 10_485_760,
      publicId,
      signature: 'a'.repeat(40),
      timestamp: 1_791_288_000,
      uploadUrl: 'https://api.cloudinary.com/v1_1/pro-date-dev/image/upload',
    });
    expect(client.signUpload).toHaveBeenCalledWith({
      format: 'jpg',
      overwrite: false,
      public_id: publicId,
      timestamp: 1_791_288_000,
    });
  });

  it('rejects a forged upload response before reading provider metadata', async () => {
    const client = createClient({ verifyResponse: vi.fn().mockReturnValue(false) });
    const provider = createProfilePhotoProvider({
      apiKey: 'key',
      cloudName: 'cloud',
      client,
    });

    await expect(
      provider.confirmUpload(userId, {
        position: 0,
        publicId,
        signature: 'b'.repeat(40),
        version: 1_790_000_001,
      }),
    ).rejects.toMatchObject<Partial<ProfilePhotoProviderError>>({ code: 'INVALID_UPLOAD_PROOF' });
    expect(client.getResource).not.toHaveBeenCalled();
  });

  it('rejects a validly signed asset belonging to another user', async () => {
    const client = createClient();
    const provider = createProfilePhotoProvider({
      apiKey: 'key',
      cloudName: 'cloud',
      client,
    });

    await expect(
      provider.confirmUpload(userId, {
        position: 0,
        publicId:
          'pro-date/users/c0b4c84f-68cb-4ba0-b120-7f5af320be1e/profile/7d256e61-ed8f-41ba-a8bb-7b5dcc279f29',
        signature: 'a'.repeat(40),
        version: 1_790_000_001,
      }),
    ).rejects.toMatchObject<Partial<ProfilePhotoProviderError>>({ code: 'INVALID_UPLOAD_PROOF' });
  });

  it('returns canonical provider metadata for an eligible uploaded photo', async () => {
    const client = createClient();
    const provider = createProfilePhotoProvider({
      apiKey: 'key',
      cloudName: 'cloud',
      client,
    });

    await expect(
      provider.confirmUpload(userId, {
        position: 2,
        publicId,
        signature: 'a'.repeat(40),
        version: 1_790_000_001,
      }),
    ).resolves.toEqual({
      bytes: 1_250_000,
      deliveryUrl: 'https://res.cloudinary.com/demo/profile.jpg',
      format: 'jpg',
      height: 1600,
      position: 2,
      providerAssetId: 'asset-immutable-id',
      providerPublicId: publicId,
      providerVersion: 1_790_000_001,
      width: 1200,
    });
    expect(client.buildDeliveryUrl).toHaveBeenCalledWith(publicId, 1_790_000_001);
  });

  it.each([
    { bytes: 10_485_761 },
    { format: 'png' },
    { height: 599 },
    { resource_type: 'video' },
    { type: 'authenticated' },
    { width: 599 },
  ])('rejects ineligible canonical media metadata: %o', async (invalidField) => {
    const client = createClient({
      getResource: vi.fn().mockResolvedValue({
        asset_id: 'asset-immutable-id',
        bytes: 1_250_000,
        format: 'jpg',
        height: 1600,
        public_id: publicId,
        resource_type: 'image',
        type: 'upload',
        version: 1_790_000_001,
        width: 1200,
        ...invalidField,
      }),
    });
    const provider = createProfilePhotoProvider({
      apiKey: 'key',
      cloudName: 'cloud',
      client,
    });

    await expect(
      provider.confirmUpload(userId, {
        position: 0,
        publicId,
        signature: 'a'.repeat(40),
        version: 1_790_000_001,
      }),
    ).rejects.toMatchObject<Partial<ProfilePhotoProviderError>>({ code: 'INELIGIBLE_MEDIA' });
  });
});
