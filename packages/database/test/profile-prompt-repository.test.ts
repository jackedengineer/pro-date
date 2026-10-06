import { drizzle } from 'drizzle-orm/node-postgres';
import { describe, expect, it } from 'vitest';

import {
  buildProfilePromptDeleteQuery,
  buildProfilePromptInsertQuery,
  buildProfilePromptListQuery,
} from '../src/profile-prompt-repository.js';
import * as schema from '../src/schema.js';

const userId = '729438da-99b3-4d3d-b566-bfe94401829b';
const prompts = [
  {
    answer: 'I build tiny tools that make creative work feel lighter.',
    position: 0,
    promptId: 'weekend_build' as const,
  },
  {
    answer: 'Coffee, a long walk, and one wildly specific playlist.',
    position: 1,
    promptId: 'debug_bad_day' as const,
  },
  {
    answer: 'Curious questions, kind reviews, and excellent snack choices.',
    position: 2,
    promptId: 'merge_criteria' as const,
  },
];

describe('profile prompt repository', () => {
  it('replaces a prompt set with relational rows owned by the internal user', () => {
    const database = drizzle.mock({ schema });
    const deletion = buildProfilePromptDeleteQuery(database, userId).toSQL();
    const insertion = buildProfilePromptInsertQuery(database, userId, prompts).toSQL();

    expect(deletion.sql).toContain('delete from "profile_prompt_answers"');
    expect(deletion.params).toEqual([userId]);
    expect(insertion.sql).toContain('insert into "profile_prompt_answers"');
    expect(insertion.params).toEqual(expect.arrayContaining([userId, 'weekend_build', 0]));
  });

  it('lists only the owner answers in presentation order', () => {
    const database = drizzle.mock({ schema });
    const query = buildProfilePromptListQuery(database, userId).toSQL();

    expect(query.sql).toContain('from "profile_prompt_answers"');
    expect(query.sql).toContain('where "profile_prompt_answers"."user_id" = $1');
    expect(query.sql).toContain('order by "profile_prompt_answers"."position" asc');
    expect(query.params).toEqual([userId]);
  });
});
