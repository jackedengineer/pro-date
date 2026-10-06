import { PROFILE_PHOTO_MAX_BYTES, type ProfilePhoto } from '@pro-date/contracts';

import type { GetSessionToken } from './current-user';
import {
  addProfilePhoto,
  completeProfilePhotos,
  deleteProfilePhoto,
  listProfilePhotos,
  type LocalProfilePhoto,
} from './profile-photos';

const apiBaseUrl = 'https://api.prodate.example';
const requestId = '59a2c4a6-110e-470e-bcab-c762c18dec45';
const profilePhoto: ProfilePhoto = {
  deliveryUrl: 'https://res.cloudinary.com/pro-date/image/upload/v1/photo.jpg',
  height: 1200,
  id: '415657ff-2a5d-40bc-89c6-4fd0d85dee1a',
  position: 0,
  width: 960,
};
const localPhoto: LocalProfilePhoto = {
  height: 1200,
  mimeType: 'image/jpeg',
  uri: 'file:///profile.jpg',
  width: 960,
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

describe('profile photo API', () => {
  const getToken = jest.fn().mockResolvedValue('session-token') as GetSessionToken;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads the authenticated profile photo draft', async () => {
    const fetchImplementation = jest
      .fn()
      .mockResolvedValue(response({ data: [profilePhoto], onboardingStep: 'PHOTOS', requestId }));

    await expect(listProfilePhotos({ apiBaseUrl, fetchImplementation, getToken })).resolves.toEqual(
      [profilePhoto],
    );
    expect(fetchImplementation).toHaveBeenCalledWith(`${apiBaseUrl}/v1/users/me/profile-photos`, {
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer session-token',
      },
      method: 'GET',
    });
  });

  it('uploads directly with the public intent and confirms the proof with our API', async () => {
    const uploadUrl = 'https://api.cloudinary.com/v1_1/demo/image/upload';
    const publicId =
      'pro-date/users/729438da-99b3-4d3d-b566-bfe94401829b/profile/31f91663-7e13-4d94-9bfa-683aa92fd09f';
    const intent = {
      apiKey: 'public-api-key',
      cloudName: 'demo',
      maxBytes: PROFILE_PHOTO_MAX_BYTES,
      publicId,
      signature: 'a'.repeat(40),
      timestamp: 1_800_000_000,
      uploadUrl,
    };
    const photoFile = {
      bytes: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      name: 'profile.jpg',
      type: 'image/jpeg',
    };
    const appendedFields: [string, unknown, string | undefined][] = [];
    const formData = {
      append: (key: string, value: unknown, fileName?: string) =>
        appendedFields.push([key, value, fileName]),
    };
    const fetchImplementation = jest
      .fn()
      .mockResolvedValueOnce(response({ data: intent, requestId }, 201))
      .mockResolvedValueOnce(
        response({ public_id: publicId, signature: 'b'.repeat(40), version: 1_800_000_001 }),
      )
      .mockResolvedValueOnce(
        response({ data: [profilePhoto], onboardingStep: 'PHOTOS', requestId }, 201),
      );

    await expect(
      addProfilePhoto({
        apiBaseUrl,
        fetchImplementation,
        fileFactory: () => photoFile as unknown as Blob,
        formDataFactory: () => formData as unknown as FormData,
        getToken,
        photo: localPhoto,
        position: 0,
      }),
    ).resolves.toEqual([profilePhoto]);

    expect(fetchImplementation).toHaveBeenNthCalledWith(
      1,
      `${apiBaseUrl}/v1/users/me/profile-photo-upload-intents`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer session-token',
        },
        method: 'POST',
      },
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(2, uploadUrl, {
      body: formData,
      method: 'POST',
    });
    expect(appendedFields).toEqual([
      ['file', photoFile, 'profile.jpg'],
      ['api_key', 'public-api-key', undefined],
      ['timestamp', '1800000000', undefined],
      ['signature', 'a'.repeat(40), undefined],
      ['public_id', publicId, undefined],
      ['format', 'jpg', undefined],
      ['overwrite', 'false', undefined],
    ]);
    expect(JSON.stringify(appendedFields)).not.toContain('api_secret');
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      3,
      `${apiBaseUrl}/v1/users/me/profile-photos`,
      {
        body: JSON.stringify({
          position: 0,
          publicId,
          signature: 'b'.repeat(40),
          version: 1_800_000_001,
        }),
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer session-token',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
  });

  it('surfaces the provider error without sending an invalid confirmation', async () => {
    const uploadUrl = 'https://api.cloudinary.com/v1_1/demo/image/upload';
    const fetchImplementation = jest
      .fn()
      .mockResolvedValueOnce(
        response(
          {
            data: {
              apiKey: 'public-api-key',
              cloudName: 'demo',
              maxBytes: PROFILE_PHOTO_MAX_BYTES,
              publicId:
                'pro-date/users/729438da-99b3-4d3d-b566-bfe94401829b/profile/31f91663-7e13-4d94-9bfa-683aa92fd09f',
              signature: 'a'.repeat(40),
              timestamp: 1_800_000_000,
              uploadUrl,
            },
            requestId,
          },
          201,
        ),
      )
      .mockResolvedValueOnce(response({ error: { message: 'Upload rejected.' } }, 400));

    await expect(
      addProfilePhoto({
        apiBaseUrl,
        fetchImplementation,
        fileFactory: () => new Blob(['photo'], { type: 'image/jpeg' }),
        getToken,
        photo: localPhoto,
        position: 0,
      }),
    ).rejects.toThrow('Upload rejected.');
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it('sends the chosen order and returns the next onboarding checkpoint', async () => {
    const photoIds = [
      '415657ff-2a5d-40bc-89c6-4fd0d85dee1a',
      'ae6c047a-ea24-464a-b999-976dc6a771e9',
      '9e303c3d-30d5-4e07-b918-2f3fbf5935db',
      'd55d404d-d27e-431f-b708-b0274ea9b1ed',
    ];
    const fetchImplementation = jest
      .fn()
      .mockResolvedValue(response({ data: [profilePhoto], onboardingStep: 'PROMPTS', requestId }));

    await expect(
      completeProfilePhotos({ apiBaseUrl, fetchImplementation, getToken, photoIds }),
    ).resolves.toEqual({ onboardingStep: 'PROMPTS', photos: [profilePhoto] });
    expect(fetchImplementation).toHaveBeenCalledWith(`${apiBaseUrl}/v1/users/me/profile-photos`, {
      body: JSON.stringify({ photoIds }),
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
      },
      method: 'PUT',
    });
  });

  it('deletes an authenticated photo and returns the compacted collection', async () => {
    const fetchImplementation = jest
      .fn()
      .mockResolvedValue(response({ data: [], onboardingStep: 'PHOTOS', requestId }));

    await expect(
      deleteProfilePhoto({
        apiBaseUrl,
        fetchImplementation,
        getToken,
        photoId: profilePhoto.id,
      }),
    ).resolves.toEqual([]);
    expect(fetchImplementation).toHaveBeenCalledWith(
      `${apiBaseUrl}/v1/users/me/profile-photos/${profilePhoto.id}`,
      {
        headers: { Accept: 'application/json', Authorization: 'Bearer session-token' },
        method: 'DELETE',
      },
    );
  });

  it('uses the API error message when media is not configured', async () => {
    const fetchImplementation = jest.fn().mockResolvedValue(
      response(
        {
          error: {
            code: 'MEDIA_UNAVAILABLE',
            message: 'Photo uploads are not configured yet.',
          },
          requestId,
        },
        503,
      ),
    );

    await expect(listProfilePhotos({ apiBaseUrl, fetchImplementation, getToken })).rejects.toThrow(
      'Photo uploads are not configured yet.',
    );
  });
});
