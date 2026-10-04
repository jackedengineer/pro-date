import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { onboardingStatus, users } from '../src/schema.js';

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
  });

  it('does not duplicate provider-managed email or phone data', () => {
    const columnNames = getTableConfig(users).columns.map((column) => column.name);

    expect(columnNames).not.toContain('email_address');
    expect(columnNames).not.toContain('phone_number');
  });
});
