import {
  apiErrorResponseSchema,
  completeProfilePhotosRequestSchema,
  profilePhotoListResponseSchema,
  profilePhotoUploadIntentResponseSchema,
  type OnboardingStep,
  type ProfilePhoto,
} from '@pro-date/contracts';
import { z } from 'zod';

import type { GetSessionToken } from './current-user';

export interface LocalProfilePhoto {
  height: number;
  mimeType: 'image/jpeg';
  uri: string;
  width: number;
}

interface ProfilePhotoApiOptions {
  apiBaseUrl: string;
  fetchImplementation?: typeof fetch;
  getToken: GetSessionToken;
}

interface AddProfilePhotoOptions extends ProfilePhotoApiOptions {
  formDataFactory?: () => FormData;
  photo: LocalProfilePhoto;
  position: number;
}

interface CompleteProfilePhotosOptions extends ProfilePhotoApiOptions {
  photoIds: string[];
}

interface DeleteProfilePhotoOptions extends ProfilePhotoApiOptions {
  photoId: string;
}

export interface CompletedProfilePhotos {
  onboardingStep: OnboardingStep;
  photos: ProfilePhoto[];
}

const cloudinaryUploadResponseSchema = z.object({
  public_id: z.string().trim().min(1).max(255),
  signature: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{40,64}$/),
  version: z.number().int().positive(),
});

const cloudinaryErrorResponseSchema = z.object({
  error: z.object({ message: z.string().trim().min(1).max(500) }),
});

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

async function getRequiredToken(getToken: GetSessionToken): Promise<string> {
  const token = await getToken();

  if (token === null) {
    throw new Error('Your session expired. Please sign in again.');
  }

  return token;
}

function throwApiError(responseBody: unknown, fallback: string): never {
  const apiError = apiErrorResponseSchema.safeParse(responseBody);

  throw new Error(apiError.success ? apiError.data.error.message : fallback);
}

function parsePhotoList(responseBody: unknown): {
  onboardingStep: OnboardingStep;
  photos: ProfilePhoto[];
} {
  const parsed = profilePhotoListResponseSchema.safeParse(responseBody);

  if (!parsed.success) {
    throw new Error('The server returned an unexpected photo response.');
  }

  return {
    onboardingStep: parsed.data.onboardingStep,
    photos: parsed.data.data,
  };
}

export async function listProfilePhotos({
  apiBaseUrl,
  fetchImplementation = fetch,
  getToken,
}: ProfilePhotoApiOptions): Promise<ProfilePhoto[]> {
  const token = await getRequiredToken(getToken);
  const response = await fetchImplementation(`${apiBaseUrl}/v1/users/me/profile-photos`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    method: 'GET',
  });
  const responseBody = await readJsonResponse(response);

  if (!response.ok) {
    throwApiError(responseBody, 'We could not load your photos. Please try again.');
  }

  return parsePhotoList(responseBody).photos;
}

export async function addProfilePhoto({
  apiBaseUrl,
  fetchImplementation = fetch,
  formDataFactory = () => new FormData(),
  getToken,
  photo,
  position,
}: AddProfilePhotoOptions): Promise<ProfilePhoto[]> {
  const token = await getRequiredToken(getToken);
  const authorizationHeaders = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };
  const intentResponse = await fetchImplementation(
    `${apiBaseUrl}/v1/users/me/profile-photo-upload-intents`,
    { headers: authorizationHeaders, method: 'POST' },
  );
  const intentBody = await readJsonResponse(intentResponse);

  if (!intentResponse.ok) {
    throwApiError(intentBody, 'We could not prepare that photo. Please try again.');
  }

  const parsedIntent = profilePhotoUploadIntentResponseSchema.safeParse(intentBody);

  if (!parsedIntent.success) {
    throw new Error('The server returned an unexpected upload response.');
  }

  const intent = parsedIntent.data.data;
  const formData = formDataFactory();
  formData.append('file', {
    name: 'profile.jpg',
    type: photo.mimeType,
    uri: photo.uri,
  } as unknown as Blob);
  formData.append('api_key', intent.apiKey);
  formData.append('timestamp', intent.timestamp.toString());
  formData.append('signature', intent.signature);
  formData.append('public_id', intent.publicId);
  formData.append('format', 'jpg');
  formData.append('overwrite', 'false');

  const uploadResponse = await fetchImplementation(intent.uploadUrl, {
    body: formData,
    method: 'POST',
  });
  const uploadBody = await readJsonResponse(uploadResponse);

  if (!uploadResponse.ok) {
    const cloudinaryError = cloudinaryErrorResponseSchema.safeParse(uploadBody);

    throw new Error(
      cloudinaryError.success
        ? cloudinaryError.data.error.message
        : 'We could not upload that photo. Please try again.',
    );
  }

  const uploaded = cloudinaryUploadResponseSchema.safeParse(uploadBody);

  if (!uploaded.success || uploaded.data.public_id !== intent.publicId) {
    throw new Error('The photo host returned an unexpected response.');
  }

  const confirmationResponse = await fetchImplementation(
    `${apiBaseUrl}/v1/users/me/profile-photos`,
    {
      body: JSON.stringify({
        position,
        publicId: uploaded.data.public_id,
        signature: uploaded.data.signature,
        version: uploaded.data.version,
      }),
      headers: {
        ...authorizationHeaders,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  );
  const confirmationBody = await readJsonResponse(confirmationResponse);

  if (!confirmationResponse.ok) {
    throwApiError(confirmationBody, 'We could not save that photo. Please try again.');
  }

  return parsePhotoList(confirmationBody).photos;
}

export async function completeProfilePhotos({
  apiBaseUrl,
  fetchImplementation = fetch,
  getToken,
  photoIds,
}: CompleteProfilePhotosOptions): Promise<CompletedProfilePhotos> {
  const input = completeProfilePhotosRequestSchema.safeParse({ photoIds });

  if (!input.success) {
    throw new Error('Add at least four different photos before continuing.');
  }

  const token = await getRequiredToken(getToken);
  const response = await fetchImplementation(`${apiBaseUrl}/v1/users/me/profile-photos`, {
    body: JSON.stringify(input.data),
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    method: 'PUT',
  });
  const responseBody = await readJsonResponse(response);

  if (!response.ok) {
    throwApiError(responseBody, 'We could not save your photo order. Please try again.');
  }

  const result = parsePhotoList(responseBody);

  return { onboardingStep: result.onboardingStep, photos: result.photos };
}

export async function deleteProfilePhoto({
  apiBaseUrl,
  fetchImplementation = fetch,
  getToken,
  photoId,
}: DeleteProfilePhotoOptions): Promise<ProfilePhoto[]> {
  const token = await getRequiredToken(getToken);
  const response = await fetchImplementation(
    `${apiBaseUrl}/v1/users/me/profile-photos/${encodeURIComponent(photoId)}`,
    {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      method: 'DELETE',
    },
  );
  const responseBody = await readJsonResponse(response);

  if (!response.ok) {
    throwApiError(responseBody, 'We could not remove that photo. Please try again.');
  }

  return parsePhotoList(responseBody).photos;
}
