import { describe, expect, it, vi } from 'vitest';

import {
  createProfilePhotoService,
  type ProfilePhotoProvider,
  type ProfilePhotoRepository,
} from '../src/media/profile-photo-service.js';

const userId = '729438da-99b3-4d3d-b566-bfe94401829b';
const photoId = 'c0b4c84f-68cb-4ba0-b120-7f5af320be1e';
const photo = {
  bytes: 1_250_000,
  format: 'jpg',
  height: 1600,
  id: photoId,
  position: 0,
  providerAssetId: 'asset-immutable-id',
  providerPublicId: `pro-date/users/${userId}/profile/provider-id`,
  providerVersion: 1_790_000_001,
  width: 1200,
};
const upload = {
  position: 0,
  publicId: photo.providerPublicId,
  signature: 'a'.repeat(40),
  version: photo.providerVersion,
};

function provider(overrides: Partial<ProfilePhotoProvider> = {}): ProfilePhotoProvider {
  return {
    confirmUpload: vi.fn(),
    createUploadIntent: vi.fn(),
    deleteUpload: vi.fn(),
    getDeliveryUrl: vi.fn().mockReturnValue('https://res.cloudinary.com/demo/photo.jpg'),
    ...overrides,
  };
}

function repository(overrides: Partial<ProfilePhotoRepository> = {}): ProfilePhotoRepository {
  return {
    complete: vi.fn(),
    find: vi.fn(),
    list: vi.fn(),
    remove: vi.fn(),
    save: vi.fn(),
    ...overrides,
  };
}

describe('profile photo service removal', () => {
  it('deletes the provider asset before removing and compacting the database row', async () => {
    const deleteUpload = vi.fn().mockResolvedValue(undefined);
    const remove = vi.fn().mockResolvedValue({ photo, photos: [] });
    const service = createProfilePhotoService(
      provider({ deleteUpload }),
      repository({ find: vi.fn().mockResolvedValue(photo), remove }),
    );

    await expect(service.remove(userId, photoId)).resolves.toEqual([]);
    expect(deleteUpload).toHaveBeenCalledWith(userId, photo.providerPublicId);
    expect(deleteUpload.mock.invocationCallOrder[0]).toBeLessThan(
      remove.mock.invocationCallOrder[0]!,
    );
  });

  it('does not call the provider when the owned row does not exist', async () => {
    const deleteUpload = vi.fn();
    const remove = vi.fn();
    const service = createProfilePhotoService(
      provider({ deleteUpload }),
      repository({ find: vi.fn().mockResolvedValue(null), remove }),
    );

    await expect(service.remove(userId, photoId)).resolves.toBeNull();
    expect(deleteUpload).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});

describe('profile photo service upload cleanup', () => {
  it('treats a repeated confirmation as an idempotent read, never deleting the saved photo', async () => {
    const media = provider({ confirmUpload: vi.fn().mockResolvedValue(photo) });
    const data = repository({ list: vi.fn().mockResolvedValue([photo]) });
    await expect(createProfilePhotoService(media, data).add(userId, upload)).resolves.toMatchObject(
      [{ id: photoId }],
    );
    expect(media.deleteUpload).not.toHaveBeenCalled();
    expect(data.save).not.toHaveBeenCalled();
  });
  it('recognizes a replay after the saved photo has been reordered', async () => {
    const media = provider({ confirmUpload: vi.fn().mockResolvedValue(photo) });
    const data = repository({ list: vi.fn().mockResolvedValue([{ ...photo, position: 2 }]) });
    await expect(createProfilePhotoService(media, data).add(userId, upload)).resolves.toMatchObject(
      [{ id: photoId, position: 2 }],
    );
    expect(media.deleteUpload).not.toHaveBeenCalled();
    expect(data.save).not.toHaveBeenCalled();
  });
  it('rejects a different photo in an occupied slot without destructive compensation', async () => {
    const deleteUpload = vi.fn().mockResolvedValue(undefined);
    const save = vi.fn();
    const service = createProfilePhotoService(
      provider({
        confirmUpload: vi.fn().mockResolvedValue(photo),
        deleteUpload,
      }),
      repository({
        list: vi
          .fn()
          .mockResolvedValue([
            { ...photo, providerAssetId: 'other-asset', providerPublicId: 'other-public-id' },
          ]),
        save,
      }),
    );

    await expect(service.add(userId, upload)).rejects.toMatchObject({
      code: 'PHOTO_SLOT_OCCUPIED',
      name: 'ProfilePhotoSlotConflictError',
    });
    expect(deleteUpload).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('does not delete a photo after an unknown database commit outcome', async () => {
    const databaseError = new Error('Database write failed.');
    const deleteUpload = vi.fn().mockResolvedValue(undefined);
    const service = createProfilePhotoService(
      provider({
        confirmUpload: vi.fn().mockResolvedValue(photo),
        deleteUpload,
      }),
      repository({
        list: vi.fn().mockResolvedValue([]),
        save: vi.fn().mockRejectedValue(databaseError),
      }),
    );

    await expect(service.add(userId, upload)).rejects.toBe(databaseError);
    expect(deleteUpload).not.toHaveBeenCalled();
  });
});
