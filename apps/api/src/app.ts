import { randomUUID } from 'node:crypto';

import type {
  ApiErrorResponse,
  CompleteProfilePromptsRequest,
  CompleteProfilePhotosRequest,
  CreateProfilePhotoRequest,
  CurrentUserResponse,
  HeightUpdate,
  HealthResponse,
  IdentityUpdate,
  LocationUpdate,
  OnboardingStatus,
  OnboardingStep,
  PreferencesUpdate,
  ProfilePhotoListResponse,
  ProfilePhotoUploadIntentResponse,
  ProfilePromptListResponse,
  ProfileResponse,
} from '@pro-date/contracts';
import {
  completeProfilePhotosRequestSchema,
  completeProfilePromptsRequestSchema,
  createProfilePhotoRequestSchema,
  isAtLeastAge,
  profilePhotoIdSchema,
  updateProfileRequestSchema,
} from '@pro-date/contracts';
import cors from 'cors';
import express, {
  type ErrorRequestHandler,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import pinoHttp from 'pino-http';

import { createLogger } from './logger.js';
import { ProfilePhotoProviderError } from './media/profile-photo-provider.js';
import {
  ProfilePhotoSlotConflictError,
  type ProfilePhotoService,
} from './media/profile-photo-service.js';
import type { ProfilePromptService } from './profile/profile-prompt-service.js';

type ReadinessStatus = 'up' | 'down';
type ReadinessChecks = Record<string, ReadinessStatus>;

const onboardingStepRank: Record<OnboardingStep, number> = {
  BIRTHDAY: 1,
  COMPLETE: 9,
  DETAILS: 5,
  IDENTITY: 2,
  LOCATION: 4,
  NAME: 0,
  PHOTOS: 6,
  PREFERENCES: 3,
  PROMPTS: 7,
  REVIEW: 8,
};

export interface CurrentUserRecord {
  id: string;
  onboardingStep: OnboardingStep;
  onboardingStatus: OnboardingStatus;
}

export type ProfileCheckpointRecord = ProfileResponse['data'];

export interface ApiAppOptions {
  authenticationMiddleware?: RequestHandler;
  clock?: () => Date;
  findOrCreateCurrentUser?: (clerkSubject: string) => Promise<CurrentUserRecord>;
  logger?: Logger;
  profilePhotoService?: ProfilePhotoService;
  profilePromptService?: ProfilePromptService;
  readinessCheck?: () => Promise<ReadinessChecks>;
  requestId?: () => string;
  resolveClerkSubject?: (request: Request) => string | null;
  saveProfileDisplayName?: (
    userId: string,
    displayName: string,
  ) => Promise<ProfileCheckpointRecord>;
  saveProfileBirthDate?: (userId: string, birthDate: string) => Promise<ProfileCheckpointRecord>;
  saveProfileHeight?: (userId: string, height: HeightUpdate) => Promise<ProfileCheckpointRecord>;
  saveProfileIdentity?: (
    userId: string,
    identity: IdentityUpdate,
  ) => Promise<ProfileCheckpointRecord>;
  saveProfileLocation?: (
    userId: string,
    location: LocationUpdate,
  ) => Promise<ProfileCheckpointRecord>;
  saveProfilePreferences?: (
    userId: string,
    preferences: PreferencesUpdate,
  ) => Promise<ProfileCheckpointRecord>;
}

function areChecksHealthy(checks: ReadinessChecks): checks is Record<string, 'up'> {
  return Object.values(checks).every((status) => status === 'up');
}

function isMalformedJsonError(error: unknown): error is SyntaxError & { type: string } {
  return (
    error instanceof SyntaxError &&
    'type' in error &&
    typeof error.type === 'string' &&
    error.type === 'entity.parse.failed'
  );
}

function getRequestId(request: Request): string {
  if (typeof request.id === 'string') {
    return request.id;
  }

  if (typeof request.id === 'number') {
    return request.id.toString();
  }

  throw new TypeError('Request ID must be a string or number.');
}

export function createApiApp(options: ApiAppOptions = {}) {
  const clock = options.clock ?? (() => new Date());
  const findOrCreateCurrentUser =
    options.findOrCreateCurrentUser ??
    (() => Promise.reject(new Error('Current-user persistence is not configured.')));
  const logger = options.logger ?? createLogger();
  const profilePhotoService = options.profilePhotoService;
  const profilePromptService = options.profilePromptService;
  const readinessCheck = options.readinessCheck ?? (() => Promise.resolve({ application: 'up' }));
  const requestId = options.requestId ?? randomUUID;
  const resolveClerkSubject = options.resolveClerkSubject ?? (() => null);
  const saveProfileDisplayName =
    options.saveProfileDisplayName ??
    (() => Promise.reject(new Error('Profile persistence is not configured.')));
  const saveProfileBirthDate =
    options.saveProfileBirthDate ??
    (() => Promise.reject(new Error('Profile persistence is not configured.')));
  const saveProfileHeight =
    options.saveProfileHeight ??
    (() => Promise.reject(new Error('Profile persistence is not configured.')));
  const saveProfileIdentity =
    options.saveProfileIdentity ??
    (() => Promise.reject(new Error('Profile persistence is not configured.')));
  const saveProfileLocation =
    options.saveProfileLocation ??
    (() => Promise.reject(new Error('Profile persistence is not configured.')));
  const saveProfilePreferences =
    options.saveProfilePreferences ??
    (() => Promise.reject(new Error('Profile persistence is not configured.')));
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: false }));
  app.use(
    pinoHttp({
      genReqId: () => requestId(),
      logger,
    }),
  );
  app.use((request, response, next) => {
    response.setHeader('x-request-id', getRequestId(request));
    next();
  });
  app.use(express.json({ limit: '100kb' }));

  if (options.authenticationMiddleware !== undefined) {
    app.use(options.authenticationMiddleware);
  }

  app.get('/health/live', (request, response) => {
    const body = {
      requestId: getRequestId(request),
      service: 'api',
      status: 'ok',
      timestamp: clock().toISOString(),
    } satisfies HealthResponse;

    response.status(200).json(body);
  });

  app.get('/health/ready', async (request, response) => {
    try {
      const checks = await readinessCheck();

      if (areChecksHealthy(checks)) {
        const body = {
          checks,
          requestId: getRequestId(request),
          service: 'api',
          status: 'ok',
          timestamp: clock().toISOString(),
        } satisfies HealthResponse;

        response.status(200).json(body);
        return;
      }

      const body = {
        checks,
        requestId: getRequestId(request),
        service: 'api',
        status: 'unavailable',
        timestamp: clock().toISOString(),
      } satisfies HealthResponse;

      response.status(503).json(body);
    } catch (error: unknown) {
      request.log.warn(
        { errorType: error instanceof Error ? error.name : 'UnknownError' },
        'Readiness check failed',
      );

      const body = {
        checks: { application: 'down' },
        requestId: getRequestId(request),
        service: 'api',
        status: 'unavailable',
        timestamp: clock().toISOString(),
      } satisfies HealthResponse;

      response.status(503).json(body);
    }
  });

  app.put('/v1/users/me', async (request, response) => {
    const clerkSubject = resolveClerkSubject(request);

    if (clerkSubject === null || clerkSubject.length === 0) {
      const body = {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication is required.',
        },
        requestId: getRequestId(request),
      } satisfies ApiErrorResponse;

      response.status(401).json(body);
      return;
    }

    const currentUser = await findOrCreateCurrentUser(clerkSubject);
    const body = {
      data: currentUser,
      requestId: getRequestId(request),
    } satisfies CurrentUserResponse;

    response.status(200).json(body);
  });

  app.patch('/v1/users/me/profile', async (request, response) => {
    const clerkSubject = resolveClerkSubject(request);

    if (clerkSubject === null || clerkSubject.length === 0) {
      const body = {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication is required.',
        },
        requestId: getRequestId(request),
      } satisfies ApiErrorResponse;

      response.status(401).json(body);
      return;
    }

    const input = updateProfileRequestSchema.safeParse(request.body);

    if (!input.success) {
      const body = {
        error: {
          code: 'VALIDATION_ERROR',
          details: input.error.issues.map((issue) => ({
            code: issue.code,
            message:
              issue.path[0] === 'displayName'
                ? 'Your name must be between 2 and 40 characters.'
                : issue.path[0] === 'birthDate'
                  ? 'Enter a valid birthday.'
                  : issue.path[0] === 'identity'
                    ? 'Check your identity and pronoun details.'
                    : issue.path[0] === 'preferences'
                      ? 'Choose who you want to meet and what you are looking for.'
                      : issue.path[0] === 'location'
                        ? 'We could not use that location.'
                        : issue.path[0] === 'height'
                          ? 'Choose a height between 120 and 230 cm.'
                          : 'This profile field is not supported.',
            path: issue.path.join('.') || 'profile',
          })),
          message: 'Check the highlighted profile fields.',
        },
        requestId: getRequestId(request),
      } satisfies ApiErrorResponse;

      response.status(422).json(body);
      return;
    }

    if (
      input.data.birthDate !== undefined &&
      !isAtLeastAge(input.data.birthDate, clock().toISOString().slice(0, 10), 18)
    ) {
      const body = {
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
        requestId: getRequestId(request),
      } satisfies ApiErrorResponse;

      response.status(422).json(body);
      return;
    }

    const currentUser = await findOrCreateCurrentUser(clerkSubject);
    let requiredStep: OnboardingStep;
    let saveProfileSection: () => Promise<ProfileCheckpointRecord>;

    if (input.data.displayName !== undefined) {
      const { displayName } = input.data;
      requiredStep = 'NAME';
      saveProfileSection = () => saveProfileDisplayName(currentUser.id, displayName);
    } else if (input.data.birthDate !== undefined) {
      const { birthDate } = input.data;
      requiredStep = 'BIRTHDAY';
      saveProfileSection = () => saveProfileBirthDate(currentUser.id, birthDate);
    } else if (input.data.identity !== undefined) {
      const { identity } = input.data;
      requiredStep = 'IDENTITY';
      saveProfileSection = () => saveProfileIdentity(currentUser.id, identity);
    } else if (input.data.preferences !== undefined) {
      const { preferences } = input.data;
      requiredStep = 'PREFERENCES';
      saveProfileSection = () => saveProfilePreferences(currentUser.id, preferences);
    } else if (input.data.location !== undefined) {
      const { location } = input.data;
      requiredStep = 'LOCATION';
      saveProfileSection = () => saveProfileLocation(currentUser.id, location);
    } else if (input.data.height !== undefined) {
      const { height } = input.data;
      requiredStep = 'DETAILS';
      saveProfileSection = () => saveProfileHeight(currentUser.id, height);
    } else {
      throw new Error('The validated profile update did not contain a supported field.');
    }

    if (onboardingStepRank[currentUser.onboardingStep] < onboardingStepRank[requiredStep]) {
      const body = {
        error: {
          code: 'ONBOARDING_STEP_REQUIRED',
          message: 'Complete the earlier profile steps first.',
        },
        requestId: getRequestId(request),
      } satisfies ApiErrorResponse;

      response.status(409).json(body);
      return;
    }

    const profile = await saveProfileSection();
    const body = {
      data: profile,
      requestId: getRequestId(request),
    } satisfies ProfileResponse;

    response.status(200).json(body);
  });

  async function resolveProfilePhotoUser(
    request: Request,
    response: Response,
  ): Promise<CurrentUserRecord | null> {
    const clerkSubject = resolveClerkSubject(request);

    if (clerkSubject === null || clerkSubject.length === 0) {
      const body = {
        error: { code: 'UNAUTHORIZED', message: 'Authentication is required.' },
        requestId: getRequestId(request),
      } satisfies ApiErrorResponse;

      response.status(401).json(body);
      return null;
    }

    const currentUser = await findOrCreateCurrentUser(clerkSubject);

    if (onboardingStepRank[currentUser.onboardingStep] < onboardingStepRank.PHOTOS) {
      const body = {
        error: {
          code: 'ONBOARDING_STEP_REQUIRED',
          message: 'Complete the earlier profile steps first.',
        },
        requestId: getRequestId(request),
      } satisfies ApiErrorResponse;

      response.status(409).json(body);
      return null;
    }

    if (profilePhotoService === undefined) {
      const body = {
        error: {
          code: 'MEDIA_UNAVAILABLE',
          message: 'Photo uploads are not configured yet.',
        },
        requestId: getRequestId(request),
      } satisfies ApiErrorResponse;

      response.status(503).json(body);
      return null;
    }

    return currentUser;
  }

  app.get('/v1/users/me/profile-photos', async (request, response) => {
    const currentUser = await resolveProfilePhotoUser(request, response);

    if (currentUser === null || profilePhotoService === undefined) {
      return;
    }

    const body = {
      data: await profilePhotoService.list(currentUser.id),
      onboardingStep: currentUser.onboardingStep,
      requestId: getRequestId(request),
    } satisfies ProfilePhotoListResponse;

    response.status(200).json(body);
  });

  app.post('/v1/users/me/profile-photo-upload-intents', async (request, response) => {
    const currentUser = await resolveProfilePhotoUser(request, response);

    if (currentUser === null || profilePhotoService === undefined) {
      return;
    }

    const body = {
      data: profilePhotoService.createUploadIntent(currentUser.id),
      requestId: getRequestId(request),
    } satisfies ProfilePhotoUploadIntentResponse;

    response.status(201).json(body);
  });

  app.post('/v1/users/me/profile-photos', async (request, response) => {
    const currentUser = await resolveProfilePhotoUser(request, response);

    if (currentUser === null || profilePhotoService === undefined) {
      return;
    }

    const input = createProfilePhotoRequestSchema.safeParse(request.body);

    if (!input.success) {
      const body = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'The uploaded photo proof is invalid.',
        },
        requestId: getRequestId(request),
      } satisfies ApiErrorResponse;

      response.status(422).json(body);
      return;
    }

    const upload: CreateProfilePhotoRequest = input.data;
    const body = {
      data: await profilePhotoService.add(currentUser.id, upload),
      onboardingStep: currentUser.onboardingStep,
      requestId: getRequestId(request),
    } satisfies ProfilePhotoListResponse;

    response.status(201).json(body);
  });

  app.put('/v1/users/me/profile-photos', async (request, response) => {
    const currentUser = await resolveProfilePhotoUser(request, response);

    if (currentUser === null || profilePhotoService === undefined) {
      return;
    }

    const input = completeProfilePhotosRequestSchema.safeParse(request.body);

    if (!input.success) {
      const body = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Add at least four different photos before continuing.',
        },
        requestId: getRequestId(request),
      } satisfies ApiErrorResponse;

      response.status(422).json(body);
      return;
    }

    const update: CompleteProfilePhotosRequest = input.data;
    const result = await profilePhotoService.complete(currentUser.id, update.photoIds);
    const body = {
      data: result.photos,
      onboardingStep: result.onboardingStep,
      requestId: getRequestId(request),
    } satisfies ProfilePhotoListResponse;

    response.status(200).json(body);
  });

  app.delete('/v1/users/me/profile-photos/:photoId', async (request, response) => {
    const currentUser = await resolveProfilePhotoUser(request, response);

    if (currentUser === null || profilePhotoService === undefined) return;

    const photoId = profilePhotoIdSchema.safeParse(request.params.photoId);

    if (!photoId.success) {
      const body = {
        error: { code: 'VALIDATION_ERROR', message: 'The profile photo ID is invalid.' },
        requestId: getRequestId(request),
      } satisfies ApiErrorResponse;

      response.status(422).json(body);
      return;
    }

    const photos = await profilePhotoService.remove(currentUser.id, photoId.data);

    if (photos === null) {
      const body = {
        error: { code: 'NOT_FOUND', message: 'That profile photo was not found.' },
        requestId: getRequestId(request),
      } satisfies ApiErrorResponse;

      response.status(404).json(body);
      return;
    }

    const body = {
      data: photos,
      onboardingStep: currentUser.onboardingStep,
      requestId: getRequestId(request),
    } satisfies ProfilePhotoListResponse;

    response.status(200).json(body);
  });

  async function resolveProfilePromptUser(
    request: Request,
    response: Response,
  ): Promise<CurrentUserRecord | null> {
    const clerkSubject = resolveClerkSubject(request);

    if (clerkSubject === null || clerkSubject.length === 0) {
      const body = {
        error: { code: 'UNAUTHORIZED', message: 'Authentication is required.' },
        requestId: getRequestId(request),
      } satisfies ApiErrorResponse;

      response.status(401).json(body);
      return null;
    }

    const currentUser = await findOrCreateCurrentUser(clerkSubject);

    if (onboardingStepRank[currentUser.onboardingStep] < onboardingStepRank.PROMPTS) {
      const body = {
        error: {
          code: 'ONBOARDING_STEP_REQUIRED',
          message: 'Complete the earlier profile steps first.',
        },
        requestId: getRequestId(request),
      } satisfies ApiErrorResponse;

      response.status(409).json(body);
      return null;
    }

    if (profilePromptService === undefined) {
      const body = {
        error: {
          code: 'PROFILE_UNAVAILABLE',
          message: 'Profile prompts are not configured yet.',
        },
        requestId: getRequestId(request),
      } satisfies ApiErrorResponse;

      response.status(503).json(body);
      return null;
    }

    return currentUser;
  }

  app.get('/v1/users/me/profile-prompts', async (request, response) => {
    const currentUser = await resolveProfilePromptUser(request, response);

    if (currentUser === null || profilePromptService === undefined) return;

    const body = {
      data: await profilePromptService.list(currentUser.id),
      onboardingStep: currentUser.onboardingStep,
      requestId: getRequestId(request),
    } satisfies ProfilePromptListResponse;

    response.status(200).json(body);
  });

  app.put('/v1/users/me/profile-prompts', async (request, response) => {
    const currentUser = await resolveProfilePromptUser(request, response);

    if (currentUser === null || profilePromptService === undefined) return;

    const input = completeProfilePromptsRequestSchema.safeParse(request.body);

    if (!input.success) {
      const body = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Choose three different prompts and answer each with at least five words.',
        },
        requestId: getRequestId(request),
      } satisfies ApiErrorResponse;

      response.status(422).json(body);
      return;
    }

    const update: CompleteProfilePromptsRequest = input.data;
    const result = await profilePromptService.complete(currentUser.id, update.prompts);
    const body = {
      data: result.answers,
      onboardingStep: result.onboardingStep,
      requestId: getRequestId(request),
    } satisfies ProfilePromptListResponse;

    response.status(200).json(body);
  });

  app.use((request, response) => {
    const body = {
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
      },
      requestId: getRequestId(request),
    } satisfies ApiErrorResponse;

    response.status(404).json(body);
  });

  const errorHandler: ErrorRequestHandler = (error, request, response, next) => {
    void next;

    if (isMalformedJsonError(error)) {
      const body = {
        error: {
          code: 'MALFORMED_JSON',
          message: 'The request body must contain valid JSON.',
        },
        requestId: getRequestId(request),
      } satisfies ApiErrorResponse;

      response.status(400).json(body);
      return;
    }

    if (error instanceof ProfilePhotoProviderError) {
      const body = {
        error: {
          code: 'VALIDATION_ERROR',
          message:
            error.code === 'INVALID_UPLOAD_PROOF'
              ? 'We could not verify that upload.'
              : 'Use a JPEG photo under 10 MB with both edges at least 600 px.',
        },
        requestId: getRequestId(request),
      } satisfies ApiErrorResponse;

      response.status(422).json(body);
      return;
    }

    if (error instanceof ProfilePhotoSlotConflictError) {
      const body = {
        error: {
          code: 'CONFLICT',
          message: 'That photo slot changed. Reload your draft and try again.',
        },
        requestId: getRequestId(request),
      } satisfies ApiErrorResponse;

      response.status(409).json(body);
      return;
    }

    request.log.error(
      { errorType: error instanceof Error ? error.name : 'UnknownError' },
      'Unhandled request error',
    );

    const body = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong.',
      },
      requestId: getRequestId(request),
    } satisfies ApiErrorResponse;

    response.status(500).json(body);
  };

  app.use(errorHandler);

  return app;
}
