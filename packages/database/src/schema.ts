import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

const geographyPoint = customType<{ data: string }>({
  dataType() {
    return 'geography(point, 4326)';
  },
});

export const onboardingStatus = pgEnum('onboarding_status', [
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETE',
]);

export const onboardingStep = pgEnum('onboarding_step', [
  'NAME',
  'BIRTHDAY',
  'IDENTITY',
  'PREFERENCES',
  'LOCATION',
  'DETAILS',
  'PHOTOS',
  'PROMPTS',
  'REVIEW',
  'COMPLETE',
]);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerkSubject: varchar('clerk_subject', { length: 255 }).notNull().unique(),
  onboardingStatus: onboardingStatus('onboarding_status').default('NOT_STARTED').notNull(),
  onboardingStep: onboardingStep('onboarding_step').default('NAME').notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
});

export const profiles = pgTable(
  'profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    birthDate: date('birth_date'),
    displayName: varchar('display_name', { length: 40 }),
    genderIdentity: varchar('gender_identity', { length: 40 }),
    pronouns: varchar('pronouns', { length: 30 }),
    isGenderVisible: boolean('is_gender_visible').default(true).notNull(),
    arePronounsVisible: boolean('are_pronouns_visible').default(true).notNull(),
    interestedIn: varchar('interested_in', { length: 24 })
      .array()
      .default(sql`ARRAY[]::varchar(24)[]`)
      .notNull(),
    relationshipIntent: varchar('relationship_intent', { length: 32 }),
    location: geographyPoint('location'),
    locationLocality: varchar('location_locality', { length: 80 }),
    locationRegion: varchar('location_region', { length: 80 }),
    locationCountryCode: varchar('location_country_code', { length: 2 }),
    heightCm: smallint('height_cm'),
    isHeightVisible: boolean('is_height_visible').default(true).notNull(),
    publishedAt: timestamp('published_at', { mode: 'date', withTimezone: true }),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('profiles_location_gist').using('gist', table.location)],
);

export const profilePhotos = pgTable(
  'profile_photos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    providerAssetId: varchar('provider_asset_id', { length: 255 }).notNull().unique(),
    providerPublicId: varchar('provider_public_id', { length: 255 }).notNull().unique(),
    providerVersion: bigint('provider_version', { mode: 'number' }).notNull(),
    format: varchar('format', { length: 10 }).notNull(),
    bytes: integer('bytes').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    position: smallint('position').notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('profile_photos_user_position_unique').on(table.userId, table.position),
    check('profile_photos_position_check', sql`${table.position} >= 0 and ${table.position} < 6`),
    check('profile_photos_bytes_check', sql`${table.bytes} > 0 and ${table.bytes} <= 10485760`),
    check('profile_photos_dimensions_check', sql`${table.width} >= 600 and ${table.height} >= 600`),
    check('profile_photos_format_check', sql`${table.format} in ('jpg', 'jpeg')`),
  ],
);

export const profilePromptAnswers = pgTable(
  'profile_prompt_answers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    promptId: varchar('prompt_id', { length: 64 }).notNull(),
    answer: varchar('answer', { length: 280 }).notNull(),
    position: smallint('position').notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('profile_prompt_answers_user_prompt_unique').on(table.userId, table.promptId),
    unique('profile_prompt_answers_user_position_unique').on(table.userId, table.position),
    check(
      'profile_prompt_answers_position_check',
      sql`${table.position} >= 0 and ${table.position} < 3`,
    ),
    check(
      'profile_prompt_answers_prompt_id_check',
      sql`${table.promptId} in ('green_flag_release_notes', 'weekend_build', 'founder_mode_off', 'life_feature_request', 'hot_take_ship', 'debug_bad_day', 'first_date_energy', 'meet_cute', 'unexpected_plot_twist', 'current_side_quest', 'keynote_hyperfixation', 'group_chat_role', 'low_stakes_hill', 'good_taste_signal', 'after_hours', 'cofounder_for_a_day', 'personal_roadmap', 'merge_criteria', 'best_self_offline', 'personal_user_manual')`,
    ),
    check(
      'profile_prompt_answers_answer_shape_check',
      sql`char_length(btrim(${table.answer})) >= 30 or array_length(regexp_split_to_array(btrim(${table.answer}), '[[:space:]]+'), 1) >= 5`,
    ),
  ],
);

export type NewUser = typeof users.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type ProfilePhoto = typeof profilePhotos.$inferSelect;
export type ProfilePromptAnswer = typeof profilePromptAnswers.$inferSelect;
export type User = typeof users.$inferSelect;

export const pullRequestStatus = pgEnum('pull_request_status', ['PENDING', 'MERGED', 'DECLINED']);

export const pullRequests = pgTable(
  'pull_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    senderUserId: uuid('sender_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recipientUserId: uuid('recipient_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetType: varchar('target_type', { length: 6 }).notNull(),
    targetId: uuid('target_id').notNull(),
    // Preserve the item that was liked even when prompt answers are subsequently edited.
    photoPublicId: varchar('photo_public_id', { length: 255 }),
    photoVersion: bigint('photo_version', { mode: 'number' }),
    promptId: varchar('prompt_id', { length: 64 }),
    promptAnswer: varchar('prompt_answer', { length: 280 }),
    comment: varchar('comment', { length: 280 }).default('').notNull(),
    status: pullRequestStatus('status').default('PENDING').notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
    respondedAt: timestamp('responded_at', { mode: 'date', withTimezone: true }),
  },
  (table) => [
    unique('pull_requests_sender_recipient_unique').on(table.senderUserId, table.recipientUserId),
    index('pull_requests_inbox_idx').on(
      table.recipientUserId,
      table.status,
      table.createdAt,
      table.id,
    ),
    check('pull_requests_no_self_check', sql`${table.senderUserId} <> ${table.recipientUserId}`),
    check(
      'pull_requests_target_check',
      sql`(${table.targetType} = 'PHOTO' and ${table.photoPublicId} is not null and ${table.photoVersion} is not null and ${table.photoVersion} > 0 and ${table.promptId} is null and ${table.promptAnswer} is null) or (${table.targetType} = 'PROMPT' and ${table.promptId} is not null and ${table.promptAnswer} is not null and ${table.photoPublicId} is null and ${table.photoVersion} is null)`,
    ),
  ],
);

export const matches = pgTable(
  'matches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    firstUserId: uuid('first_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    secondUserId: uuid('second_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lastMessageSequence: integer('last_message_sequence').default(0).notNull(),
    unmatchedAt: timestamp('unmatched_at', { mode: 'date', withTimezone: true }),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('matches_pair_unique').on(table.firstUserId, table.secondUserId),
    index('matches_second_user_idx').on(table.secondUserId, table.createdAt, table.id),
    check('matches_ordered_pair_check', sql`${table.firstUserId} < ${table.secondUserId}`),
  ],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').notNull(),
    sequence: integer('sequence').notNull(),
    body: varchar('body', { length: 2000 }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => [
    unique('messages_sender_intent_unique').on(table.senderId, table.clientId),
    unique('messages_conversation_sequence_unique').on(table.conversationId, table.sequence),
    check('messages_body_check', sql`char_length(btrim(${table.body})) between 1 and 2000`),
    check('messages_sequence_check', sql`${table.sequence} > 0`),
    index('messages_sender_created_idx').on(table.senderId, table.createdAt),
  ],
);

export const messageOutbox = pgTable(
  'message_outbox',
  {
    messageId: uuid('message_id')
      .primaryKey()
      .references(() => messages.id, { onDelete: 'cascade' }),
    leasedUntil: timestamp('leased_until', { mode: 'date', withTimezone: true }),
    publishedAt: timestamp('published_at', { mode: 'date', withTimezone: true }),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('message_outbox_pending_idx').on(table.publishedAt, table.leasedUntil)],
);

export const notificationSettings = pgTable(
  'notification_settings',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    isPaused: boolean('is_paused').default(false).notNull(),
    revision: integer('revision').default(1).notNull(),
  },
  (table) => [check('notification_settings_revision_check', sql`${table.revision} > 0`)],
);

export const conversationNotificationPreferences = pgTable(
  'conversation_notification_preferences',
  {
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    isEnabled: boolean('is_enabled').default(false).notNull(),
    revision: integer('revision').default(1).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.userId] }),
    check('conversation_notification_revision_check', sql`${table.revision} > 0`),
  ],
);

export const notificationDevices = pgTable(
  'notification_devices',
  {
    installationId: uuid('installation_id').primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    secretHash: varchar('secret_hash', { length: 64 }).notNull(),
    generation: integer('generation').default(1).notNull(),
    token: varchar('token', { length: 256 }),
    platform: varchar('platform', { length: 7 }).notNull(),
    projectId: uuid('project_id').notNull(),
    expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { mode: 'date', withTimezone: true }),
    lastOperationId: uuid('last_operation_id').notNull(),
    lastRequestHash: varchar('last_request_hash', { length: 64 }).notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('notification_devices_active_token_unique')
      .on(table.token)
      .where(sql`${table.token} is not null`),
    index('notification_devices_owner_idx').on(table.ownerId, table.expiresAt),
    check('notification_devices_generation_check', sql`${table.generation} > 0`),
    check('notification_devices_platform_check', sql`${table.platform} in ('ios', 'android')`),
    check(
      'notification_devices_hash_check',
      sql`${table.secretHash} ~ '^[a-f0-9]{64}$' and ${table.lastRequestHash} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      'notification_devices_revocation_check',
      sql`${table.revokedAt} is null or ${table.token} is null`,
    ),
  ],
);

export const messageNotificationJobs = pgTable(
  'message_notification_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => notificationDevices.installationId, { onDelete: 'cascade' }),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    settingsRevision: integer('settings_revision').notNull(),
    preferenceRevision: integer('preference_revision').notNull(),
    deviceGeneration: integer('device_generation').notNull(),
    status: varchar('status', { length: 12 }).default('PENDING').notNull(),
    attemptCount: smallint('attempt_count').default(0).notNull(),
    claimId: uuid('claim_id'),
    leasedUntil: timestamp('leased_until', { mode: 'date', withTimezone: true }),
    nextAttemptAt: timestamp('next_attempt_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }).notNull(),
    terminalAt: timestamp('terminal_at', { mode: 'date', withTimezone: true }),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('notification_jobs_message_device_unique').on(table.messageId, table.deviceId),
    index('notification_jobs_pending_idx').on(table.status, table.nextAttemptAt, table.leasedUntil),
    index('notification_jobs_recipient_idx').on(table.recipientId, table.status),
    check(
      'notification_jobs_status_check',
      sql`${table.status} in ('PENDING', 'LEASED', 'ACCEPTED', 'CANCELLED', 'EXPIRED', 'FAILED')`,
    ),
    check('notification_jobs_attempt_check', sql`${table.attemptCount} between 0 and 8`),
    check(
      'notification_jobs_revision_check',
      sql`${table.settingsRevision} >= 0 and ${table.preferenceRevision} > 0 and ${table.deviceGeneration} > 0`,
    ),
  ],
);

export const notificationAttempts = pgTable(
  'notification_attempts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => messageNotificationJobs.id, { onDelete: 'cascade' }),
    attemptNumber: smallint('attempt_number').notNull(),
    outcome: varchar('outcome', { length: 16 }).default('STARTED').notNull(),
    errorCode: varchar('error_code', { length: 40 }),
    ticketId: varchar('ticket_id', { length: 128 }),
    receiptStatus: varchar('receipt_status', { length: 12 }),
    receiptDueAt: timestamp('receipt_due_at', { mode: 'date', withTimezone: true }),
    receiptExpiresAt: timestamp('receipt_expires_at', { mode: 'date', withTimezone: true }),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('notification_attempts_job_number_unique').on(table.jobId, table.attemptNumber),
    index('notification_attempts_receipt_idx').on(table.receiptStatus, table.receiptDueAt),
    check('notification_attempts_number_check', sql`${table.attemptNumber} between 1 and 8`),
    check(
      'notification_attempts_outcome_check',
      sql`${table.outcome} in ('STARTED', 'ACCEPTED', 'RETRYABLE', 'UNKNOWN', 'FAILED')`,
    ),
    check(
      'notification_attempts_receipt_check',
      sql`${table.receiptStatus} is null or ${table.receiptStatus} in ('PENDING', 'OK', 'ERROR', 'EXPIRED')`,
    ),
  ],
);

export const profilePasses = pgTable(
  'profile_passes',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    passedUserId: uuid('passed_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.passedUserId] }),
    check('profile_passes_no_self_check', sql`${table.userId} <> ${table.passedUserId}`),
  ],
);

export const userBlocks = pgTable(
  'user_blocks',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockedUserId: uuid('blocked_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.blockedUserId] }),
    index('user_blocks_reverse_idx').on(table.blockedUserId, table.userId),
    check('user_blocks_no_self_check', sql`${table.userId} <> ${table.blockedUserId}`),
  ],
);

export const profileReports = pgTable(
  'profile_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reporterUserId: uuid('reporter_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reportedUserId: uuid('reported_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reason: varchar('reason', { length: 24 }).notNull(),
    details: varchar('details', { length: 1000 }).default('').notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('profile_reports_reporter_target_unique').on(table.reporterUserId, table.reportedUserId),
    check(
      'profile_reports_reason_check',
      sql`${table.reason} in ('HARASSMENT', 'INAPPROPRIATE_CONTENT', 'SPAM', 'UNDERAGE', 'OTHER')`,
    ),
    check('profile_reports_no_self_check', sql`${table.reporterUserId} <> ${table.reportedUserId}`),
  ],
);
