import { pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

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

export const profiles = pgTable('profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  displayName: varchar('display_name', { length: 40 }),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
});

export type NewUser = typeof users.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type User = typeof users.$inferSelect;
