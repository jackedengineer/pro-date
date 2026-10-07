import { clerkMiddleware, getAuth } from '@clerk/express';
import {
  createCurrentUserRepository,
  createDatabaseResources,
  createProfilePhotoRepository,
  createProfilePublicationRepository,
  createProfilePromptRepository,
  createProfileRepository,
} from '@pro-date/database';

import { createApiApp } from './app.js';
import { registerDatabasePoolErrorHandler } from './database-pool.js';
import { readApiServiceEnvironment } from './env.js';
import { createLogger } from './logger.js';
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
const profilePhotoService =
  environment.cloudinary === null
    ? undefined
    : createProfilePhotoService(
        createProfilePhotoProvider({
          apiKey: environment.cloudinary.apiKey,
          cloudName: environment.cloudinary.cloudName,
          client: createCloudinaryProfilePhotoClient(environment.cloudinary),
        }),
        profilePhotoRepository,
      );
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
  authenticationMiddleware: clerkMiddleware({
    publishableKey: environment.clerkPublishableKey,
    secretKey: environment.clerkSecretKey,
  }),
  findOrCreateCurrentUser: (clerkSubject) =>
    currentUserRepository.findOrCreateByClerkSubject(clerkSubject),
  logger,
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

const server = app.listen(environment.port, environment.host, () => {
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

  server.close((error) => {
    clearTimeout(forceExitTimer);

    if (error !== undefined) {
      logger.error({ errorType: error.name }, 'HTTP server failed to close');
      process.exitCode = 1;
      return;
    }

    void pool
      .end()
      .then(() => {
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
  });
}

server.on('error', (error) => {
  logger.fatal({ errorType: error.name }, 'HTTP server error');
  process.exitCode = 1;
});

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
