export {
  createDatabaseResources,
  createPostgresPoolConfig,
  type DatabaseResources,
  type ProDateDatabase,
} from './client.js';
export {
  buildCurrentUserUpsertQuery,
  createCurrentUserRepository,
  type CurrentUserRecord,
} from './current-user-repository.js';
export {
  buildOnboardingProgressQuery,
  buildHeightUpsertQuery,
  buildIdentityUpsertQuery,
  buildLocationUpsertQuery,
  buildPreferencesUpsertQuery,
  buildProfileUpsertQuery,
  createProfileRepository,
  type ProfileCheckpointRecord,
} from './profile-repository.js';
export { onboardingStatus, onboardingStep, profilePhotos, profiles, users } from './schema.js';
export type { NewUser, Profile, ProfilePhoto, User } from './schema.js';
