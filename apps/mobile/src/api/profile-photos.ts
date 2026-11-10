import {
  apiErrorResponseSchema,
  completeProfilePhotosRequestSchema,
  profilePhotoListResponseSchema,
  profilePhotoUploadIntentResponseSchema,
  type OnboardingStep,
  type ProfilePhoto,
} from '@pro-date/contracts';
import { File } from 'expo-file-system';
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
  fileFactory?: (uri: string) => Blob;
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

/** API calls are small JSON exchanges; the photo itself gets longer on slow networks. */
export const PHOTO_API_TIMEOUT_MS = 20_000;
export const PHOTO_UPLOAD_TIMEOUT_MS = 120_000;
const TIMEOUT_MESSAGE = 'That took too long. Check your connection and try again.';

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

/**
 * Sends one request and reads its JSON body under a deadline. A request on a stalled network
 * would otherwise never settle, leaving the photo grid locked on its spinner.
 */
async function timedJsonRequest(
  fetchImplementation: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ body: unknown; response: Response }> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(TIMEOUT_MESSAGE));
      controller.abort();
    }, timeoutMs);
  });
  const exchange = async () => {
    const response = await fetchImplementation(url, { ...init, signal: controller.signal });
    return { body: await readJsonResponse(response), response };
  };
  try {
    return await Promise.race([exchange(), deadline]);
  } finally {
    clearTimeout(timer);
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
  const { body: responseBody, response } = await timedJsonRequest(
    fetchImplementation,
    `${apiBaseUrl}/v1/users/me/profile-photos`,
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      method: 'GET',
    },
    PHOTO_API_TIMEOUT_MS,
  );

  if (!response.ok) {
    throwApiError(responseBody, 'We could not load your photos. Please try again.');
  }

  return parsePhotoList(responseBody).photos;
}

export async function addProfilePhoto({
  apiBaseUrl,
  fetchImplementation = fetch,
  fileFactory = (uri) => new File(uri),
  formDataFactory = () => new FormData(),
  getToken,
  photo,
  position,
}: AddProfilePhotoOptions): Promise<ProfilePhoto[]> {
  const authorizationHeaders = async () => ({
    Accept: 'application/json',
    Authorization: `Bearer ${await getRequiredToken(getToken)}`,
  });
  const { body: intentBody, response: intentResponse } = await timedJsonRequest(
    fetchImplementation,
    `${apiBaseUrl}/v1/users/me/profile-photo-upload-intents`,
    { headers: await authorizationHeaders(), method: 'POST' },
    PHOTO_API_TIMEOUT_MS,
  );

  if (!intentResponse.ok) {
    throwApiError(intentBody, 'We could not prepare that photo. Please try again.');
  }

  const parsedIntent = profilePhotoUploadIntentResponseSchema.safeParse(intentBody);

  if (!parsedIntent.success) {
    throw new Error('The server returned an unexpected upload response.');
  }

  const intent = parsedIntent.data.data;
  const formData = formDataFactory();
  formData.append('file', fileFactory(photo.uri), 'profile.jpg');
  formData.append('api_key', intent.apiKey);
  formData.append('timestamp', intent.timestamp.toString());
  formData.append('signature', intent.signature);
  formData.append('public_id', intent.publicId);
  formData.append('format', 'jpg');
  formData.append('overwrite', 'false');

  const { body: uploadBody, response: uploadResponse } = await timedJsonRequest(
    fetchImplementation,
    intent.uploadUrl,
    { body: formData, method: 'POST' },
    PHOTO_UPLOAD_TIMEOUT_MS,
  );

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

  // A slow upload can outlive the short-lived session token, so ask Clerk again here.
  const { body: confirmationBody, response: confirmationResponse } = await timedJsonRequest(
    fetchImplementation,
    `${apiBaseUrl}/v1/users/me/profile-photos`,
    {
      body: JSON.stringify({
        position,
        publicId: uploaded.data.public_id,
        signature: uploaded.data.signature,
        version: uploaded.data.version,
      }),
      headers: {
        ...(await authorizationHeaders()),
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
    PHOTO_API_TIMEOUT_MS,
  );

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
  const { body: responseBody, response } = await timedJsonRequest(
    fetchImplementation,
    `${apiBaseUrl}/v1/users/me/profile-photos`,
    {
      body: JSON.stringify(input.data),
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      method: 'PUT',
    },
    PHOTO_API_TIMEOUT_MS,
  );

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
  const { body: responseBody, response } = await timedJsonRequest(
    fetchImplementation,
    `${apiBaseUrl}/v1/users/me/profile-photos/${encodeURIComponent(photoId)}`,
    {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      method: 'DELETE',
    },
    PHOTO_API_TIMEOUT_MS,
  );

  if (!response.ok) {
    throwApiError(responseBody, 'We could not remove that photo. Please try again.');
  }

  return parsePhotoList(responseBody).photos;
}
