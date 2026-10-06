import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { onboardingStatus, onboardingStep, profilePhotos, profiles, users } from '../src/schema.js';

describe('users schema', () => {
  it('uses an internal UUID and a unique Clerk subject', () => {
    const table = getTableConfig(users);
    const id = table.columns.find((column) => column.name === 'id');
    const clerkSubject = table.columns.find((column) => column.name === 'clerk_subject');

    expect(id).toMatchObject({ hasDefault: true, notNull: true, primary: true });
    expect(clerkSubject).toMatchObject({ isUnique: true, notNull: true });
  });

  it('keeps the persisted onboarding states aligned with the API contract', () => {
    expect(onboardingStatus.enumValues).toEqual(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE']);
    expect(onboardingStep.enumValues).toEqual([
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
  });

  it('does not duplicate provider-managed email or phone data', () => {
    const columnNames = getTableConfig(users).columns.map((column) => column.name);

    expect(columnNames).not.toContain('email_address');
    expect(columnNames).not.toContain('phone_number');
  });
});

describe('profiles schema', () => {
  it('stores one normalized profile draft per internal user', () => {
    const table = getTableConfig(profiles);
    const userId = table.columns.find((column) => column.name === 'user_id');
    const birthDate = table.columns.find((column) => column.name === 'birth_date');
    const displayName = table.columns.find((column) => column.name === 'display_name');
    const genderIdentity = table.columns.find((column) => column.name === 'gender_identity');
    const pronouns = table.columns.find((column) => column.name === 'pronouns');
    const interestedIn = table.columns.find((column) => column.name === 'interested_in');
    const relationshipIntent = table.columns.find(
      (column) => column.name === 'relationship_intent',
    );
    const location = table.columns.find((column) => column.name === 'location');
    const heightCm = table.columns.find((column) => column.name === 'height_cm');

    expect(userId).toMatchObject({ notNull: true, primary: true });
    expect(birthDate).toMatchObject({ dataType: 'string', notNull: false });
    expect(displayName).toMatchObject({ notNull: false });
    expect(genderIdentity).toMatchObject({ notNull: false });
    expect(pronouns).toMatchObject({ notNull: false });
    expect(interestedIn?.getSQLType()).toBe('varchar(24)[]');
    expect(relationshipIntent).toMatchObject({ notNull: false });
    expect(location?.getSQLType()).toBe('geography(point, 4326)');
    expect(heightCm).toMatchObject({ dataType: 'number', notNull: false });
    expect(table.indexes.some((index) => index.config.name === 'profiles_location_gist')).toBe(
      true,
    );
    expect(table.foreignKeys).toHaveLength(1);
  });

  it('uses relational PostgreSQL columns rather than document storage', () => {
    const sqlTypes = getTableConfig(profiles).columns.map((column) => column.getSQLType());

    expect(sqlTypes).not.toContain('json');
    expect(sqlTypes).not.toContain('jsonb');
  });
});

describe('profile photos schema', () => {
  it('stores provider identity and presentation order relationally', () => {
    const table = getTableConfig(profilePhotos);
    const id = table.columns.find((column) => column.name === 'id');
    const userId = table.columns.find((column) => column.name === 'user_id');
    const providerAssetId = table.columns.find((column) => column.name === 'provider_asset_id');
    const providerPublicId = table.columns.find((column) => column.name === 'provider_public_id');
    const position = table.columns.find((column) => column.name === 'position');

    expect(id).toMatchObject({ hasDefault: true, notNull: true, primary: true });
    expect(userId).toMatchObject({ notNull: true });
    expect(providerAssetId).toMatchObject({ isUnique: true, notNull: true });
    expect(providerPublicId).toMatchObject({ isUnique: true, notNull: true });
    expect(position).toMatchObject({ dataType: 'number', notNull: true });
    expect(table.foreignKeys).toHaveLength(1);
    expect(table.uniqueConstraints.some((constraint) => constraint.name === 'profile_photos_user_position_unique')).toBe(true);
    expect(table.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        'profile_photos_bytes_check',
        'profile_photos_dimensions_check',
        'profile_photos_format_check',
        'profile_photos_position_check',
      ]),
    );
  });
});
