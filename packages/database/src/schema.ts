import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  date,
  index,
  pgEnum,
  pgTable,
  smallint,
  timestamp,
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
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('profiles_location_gist').using('gist', table.location)],
);

export type NewUser = typeof users.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type User = typeof users.$inferSelect;
