import { randomUUID, timingSafeEqual } from 'node:crypto';

import { PROFILE_PHOTO_MAX_BYTES, type CreateProfilePhotoRequest } from '@pro-date/contracts';
import { v2 as cloudinary } from 'cloudinary';
import { z } from 'zod';

const minimumPhotoEdge = 600;

const cloudinaryResourceSchema = z.object({
  asset_id: z.string().trim().min(1).max(255),
  bytes: z.number().int().positive(),
  format: z.string().trim().toLowerCase(),
  height: z.number().int().positive(),
  public_id: z.string().trim().min(1).max(255),
  resource_type: z.string(),
  type: z.string(),
  version: z.number().int().positive(),
  width: z.number().int().positive(),
});

interface UploadParameters {
  format: 'jpg';
  overwrite: false;
  public_id: string;
  timestamp: number;
}

export interface ProfilePhotoCloudinaryClient {
  buildDeliveryUrl: (publicId: string, version: number) => string;
  getResource: (publicId: string) => Promise<unknown>;
  signUpload: (parameters: UploadParameters) => string;
  verifyResponse: (publicId: string, version: number, signature: string) => boolean;
}

export type ProfilePhotoProviderErrorCode = 'INELIGIBLE_MEDIA' | 'INVALID_UPLOAD_PROOF';

export class ProfilePhotoProviderError extends Error {
  constructor(public readonly code: ProfilePhotoProviderErrorCode) {
    super(
      code === 'INVALID_UPLOAD_PROOF'
        ? 'The upload proof is invalid.'
        : 'The photo is not eligible.',
    );
    this.name = 'ProfilePhotoProviderError';
  }
}

interface ProfilePhotoProviderOptions {
  apiKey: string;
  clock?: () => Date;
  cloudName: string;
  client: ProfilePhotoCloudinaryClient;
  randomId?: () => string;
}

export interface ConfirmedProfilePhoto {
  bytes: number;
  deliveryUrl: string;
  format: string;
  height: number;
  position: number;
  providerAssetId: string;
  providerPublicId: string;
  providerVersion: number;
  width: number;
}

export function createProfilePhotoProvider({
  apiKey,
  clock = () => new Date(),
  cloudName,
  client,
  randomId = randomUUID,
}: ProfilePhotoProviderOptions) {
  return {
    async confirmUpload(
      userId: string,
      upload: CreateProfilePhotoRequest,
    ): Promise<ConfirmedProfilePhoto> {
      const expectedPrefix = `pro-date/users/${userId}/profile/`;

      if (
        !upload.publicId.startsWith(expectedPrefix) ||
        !client.verifyResponse(upload.publicId, upload.version, upload.signature)
      ) {
        throw new ProfilePhotoProviderError('INVALID_UPLOAD_PROOF');
      }

      const resource = cloudinaryResourceSchema.safeParse(
        await client.getResource(upload.publicId),
      );

      if (
        !resource.success ||
        resource.data.public_id !== upload.publicId ||
        resource.data.version !== upload.version
      ) {
        throw new ProfilePhotoProviderError('INVALID_UPLOAD_PROOF');
      }

      if (
        resource.data.resource_type !== 'image' ||
        resource.data.type !== 'upload' ||
        !['jpg', 'jpeg'].includes(resource.data.format) ||
        resource.data.bytes > PROFILE_PHOTO_MAX_BYTES ||
        resource.data.width < minimumPhotoEdge ||
        resource.data.height < minimumPhotoEdge
      ) {
        throw new ProfilePhotoProviderError('INELIGIBLE_MEDIA');
      }

      return {
        bytes: resource.data.bytes,
        deliveryUrl: client.buildDeliveryUrl(upload.publicId, upload.version),
        format: resource.data.format,
        height: resource.data.height,
        position: upload.position,
        providerAssetId: resource.data.asset_id,
        providerPublicId: resource.data.public_id,
        providerVersion: resource.data.version,
        width: resource.data.width,
      };
    },

    createUploadIntent(userId: string) {
      const publicId = `pro-date/users/${userId}/profile/${randomId()}`;
      const timestamp = Math.floor(clock().getTime() / 1000);
      const parameters = {
        format: 'jpg',
        overwrite: false,
        public_id: publicId,
        timestamp,
      } satisfies UploadParameters;

      return {
        apiKey,
        cloudName,
        maxBytes: PROFILE_PHOTO_MAX_BYTES,
        publicId,
        signature: client.signUpload(parameters),
        timestamp,
        uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      };
    },

    getDeliveryUrl(publicId: string, version: number) {
      return client.buildDeliveryUrl(publicId, version);
    },
  };
}

interface CloudinaryClientOptions {
  apiKey: string;
  apiSecret: string;
  cloudName: string;
}

export function createCloudinaryProfilePhotoClient({
  apiKey,
  apiSecret,
  cloudName,
}: CloudinaryClientOptions): ProfilePhotoCloudinaryClient {
  cloudinary.config({
    api_key: apiKey,
    api_secret: apiSecret,
    cloud_name: cloudName,
    secure: true,
  });

  return {
    buildDeliveryUrl: (publicId, version) =>
      cloudinary.url(publicId, {
        secure: true,
        transformation: [
          { crop: 'fill', gravity: 'auto', height: 1200, width: 960 },
          { quality: 'auto' },
          { fetch_format: 'auto' },
        ],
        version,
      }),
    getResource: (publicId) =>
      cloudinary.api.resource(publicId, { resource_type: 'image', type: 'upload' }),
    signUpload: (parameters) => cloudinary.utils.api_sign_request(parameters, apiSecret),
    verifyResponse: (publicId, version, signature) => {
      const expectedSignature = cloudinary.utils.api_sign_request(
        { public_id: publicId, version },
        apiSecret,
      );
      const actual = Buffer.from(signature);
      const expected = Buffer.from(expectedSignature);

      return actual.length === expected.length && timingSafeEqual(actual, expected);
    },
  };
}
