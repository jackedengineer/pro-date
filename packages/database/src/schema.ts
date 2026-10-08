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
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('matches_pair_unique').on(table.firstUserId, table.secondUserId),
    index('matches_second_user_idx').on(table.secondUserId, table.createdAt, table.id),
    check('matches_ordered_pair_check', sql`${table.firstUserId} < ${table.secondUserId}`),
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
