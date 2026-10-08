import { createServer } from 'node:http';
import { verifyToken } from '@clerk/backend';
import { clerkMiddleware, getAuth } from '@clerk/express';
import { z } from 'zod';
import {
  createCurrentUserRepository,
  createDatabaseResources,
  createDiscoveryRepository,
  createMessagingRepository,
  createProfilePhotoRepository,
  createProfilePublicationRepository,
  createProfilePromptRepository,
  createProfileRepository,
} from '@pro-date/database';

import { createApiApp } from './app.js';
import { registerDatabasePoolErrorHandler } from './database-pool.js';
import { readApiServiceEnvironment } from './env.js';
import { createLogger } from './logger.js';
import { createDiscoveryService } from './discovery/discovery-service.js';
import { createMessagingRealtime } from './messaging/messaging-realtime.js';
import { createMessagingService } from './messaging/messaging-service.js';
import {
  createCloudinaryProfilePhotoClient,
  createProfilePhotoProvider,
} from './media/profile-photo-provider.js';
import { createProfilePhotoService } from './media/profile-photo-service.js';
import { createProfilePromptService } from './profile/profile-prompt-service.js';
import { createProfilePublicationService } from './profile/profile-publication-service.js';

const environment = readApiServiceEnvironment();
const logger = createLogger(environment.logLevel);
const { database, pool } = createDatabaseResources(environment.databaseUrl);
registerDatabasePoolErrorHandler(pool, logger);
const currentUserRepository = createCurrentUserRepository(database);
const profilePhotoRepository = createProfilePhotoRepository(database);
const profilePublicationRepository = createProfilePublicationRepository(database);
const profilePromptRepository = createProfilePromptRepository(database);
const profileRepository = createProfileRepository(database);
const profilePromptService = createProfilePromptService(profilePromptRepository);
const messagingRepository = createMessagingRepository(database);
let notifyMessaging = () => {};
const photoProvider =
  environment.cloudinary === null
    ? undefined
    : createProfilePhotoProvider({
        apiKey: environment.cloudinary.apiKey,
        cloudName: environment.cloudinary.cloudName,
        client: createCloudinaryProfilePhotoClient(environment.cloudinary),
      });
const profilePhotoService =
  environment.cloudinary === null
    ? undefined
    : createProfilePhotoService(photoProvider!, profilePhotoRepository);
const profilePublicationService =
  profilePhotoService === undefined
    ? undefined
    : createProfilePublicationService(
        profilePublicationRepository,
        profilePhotoService,
        profilePromptService,
      );

if (profilePhotoService === undefined) {
  logger.warn('Cloudinary is incomplete; profile photo routes will remain unavailable');
}

const app = createApiApp({
  findCurrentUser: (subject) => currentUserRepository.findByClerkSubject(subject),
  messagingService: createMessagingService(
    messagingRepository,
    (publicId, version) => {
      if (photoProvider === undefined) throw new Error('Photo delivery is not configured.');
      return photoProvider.getDeliveryUrl(publicId, version);
    },
    () => notifyMessaging(),
  ),
  authenticationMiddleware: clerkMiddleware({
    publishableKey: environment.clerkPublishableKey,
    secretKey: environment.clerkSecretKey,
  }),
  findOrCreateCurrentUser: (clerkSubject) =>
    currentUserRepository.findOrCreateByClerkSubject(clerkSubject),
  logger,
  ...(photoProvider === undefined
    ? {}
    : {
        discoveryService: createDiscoveryService(
          createDiscoveryRepository(database),
          (publicId, version) => photoProvider.getDeliveryUrl(publicId, version),
        ),
      }),
  ...(profilePhotoService === undefined ? {} : { profilePhotoService }),
  ...(profilePublicationService === undefined ? {} : { profilePublicationService }),
  profilePromptService,
  readinessCheck: async () => {
    await pool.query('select 1');

    return { application: 'up', database: 'up' };
  },
  resolveClerkSubject: (request) => {
    const auth = getAuth(request);

    return auth.isAuthenticated ? auth.userId : null;
  },
  saveProfileBirthDate: (userId, birthDate) => profileRepository.saveBirthDate(userId, birthDate),
  saveProfileDisplayName: (userId, displayName) =>
    profileRepository.saveDisplayName(userId, displayName),
  saveProfileHeight: (userId, height) => profileRepository.saveHeight(userId, height),
  saveProfileIdentity: (userId, identity) => profileRepository.saveIdentity(userId, identity),
  saveProfileLocation: (userId, location) => profileRepository.saveLocation(userId, location),
  saveProfilePreferences: (userId, preferences) =>
    profileRepository.savePreferences(userId, preferences),
});

const server = createServer(app);
const messagingRealtime = createMessagingRealtime(server, {
  repository: messagingRepository,
  logger,
  authenticate: async (token) => {
    // A socket handshake carries a token rather than an Express Request.
    // Source: https://clerk.com/docs/reference/backend/verify-token
    const verification = await verifyToken(token, { secretKey: environment.clerkSecretKey });
    const claims = z
      .object({ sub: z.string().min(1), sid: z.string().min(1), exp: z.number().int().positive() })
      .parse(verification.data);
    const user = await currentUserRepository.findByClerkSubject(claims.sub);
    if (user === null || user.onboardingStatus !== 'COMPLETE')
      throw new Error('A published member is required.');
    return { userId: user.id, expiresAt: claims.exp * 1000 };
  },
});
notifyMessaging = () => {
  void messagingRealtime.flush();
};
server.listen(environment.port, environment.host, () => {
  logger.info(
    {
      environment: environment.nodeEnv,
      host: environment.host,
      port: environment.port,
    },
    'API listening',
  );
});

let shutdownStarted = false;

function shutdown(signal: NodeJS.Signals) {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;
  logger.info({ signal }, 'Graceful shutdown started');

  const forceExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out');
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  void messagingRealtime
    .close()
    .then(() => pool.end())
    .then(() => {
      clearTimeout(forceExitTimer);
      logger.info('Graceful shutdown complete');
      process.exitCode = 0;
    })
    .catch((poolError: unknown) => {
      logger.error(
        { errorType: poolError instanceof Error ? poolError.name : 'UnknownError' },
        'Database pool failed to close',
      );
      process.exitCode = 1;
    });
}

server.on('error', (error) => {
  logger.fatal({ errorType: error.name }, 'HTTP server error');
  process.exitCode = 1;
});

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
