import { describe, expect, it } from 'vitest';

import {
  completeProfilePromptsRequestSchema,
  PROFILE_PROMPT_CATALOGUE,
  profilePromptAnswerInputSchema,
} from '../src/profile-prompt';

const validPrompts = [
  {
    answer: 'I build tiny tools that make creative work feel lighter.',
    position: 0,
    promptId: 'weekend_build',
  },
  {
    answer: 'Coffee, a long walk, and one wildly specific playlist.',
    position: 1,
    promptId: 'debug_bad_day',
  },
  {
    answer: 'Curious questions, kind reviews, and excellent snack choices.',
    position: 2,
    promptId: 'merge_criteria',
  },
] as const;

describe('profile prompt contracts', () => {
  it('ships a focused catalogue of twenty distinct conversation starters', () => {
    expect(PROFILE_PROMPT_CATALOGUE).toHaveLength(20);
    expect(new Set(PROFILE_PROMPT_CATALOGUE.map((prompt) => prompt.id)).size).toBe(20);
    expect(PROFILE_PROMPT_CATALOGUE.every((prompt) => prompt.text.split(/\s+/).length >= 6)).toBe(
      true,
    );
  });

  it('requires sentence-shaped answers rather than one-word replies', () => {
    expect(
      profilePromptAnswerInputSchema.safeParse({
        answer: 'Coffee.',
        position: 0,
        promptId: 'debug_bad_day',
      }).success,
    ).toBe(false);
    expect(profilePromptAnswerInputSchema.parse(validPrompts[0])).toEqual(validPrompts[0]);
  });

  it('requires exactly three unique prompts in a unique order', () => {
    expect(completeProfilePromptsRequestSchema.parse({ prompts: validPrompts })).toEqual({
      prompts: validPrompts,
    });
    expect(
      completeProfilePromptsRequestSchema.safeParse({ prompts: validPrompts.slice(0, 2) }).success,
    ).toBe(false);
    expect(
      completeProfilePromptsRequestSchema.safeParse({
        prompts: [
          validPrompts[0],
          { ...validPrompts[1], promptId: 'weekend_build' },
          validPrompts[2],
        ],
      }).success,
    ).toBe(false);
    expect(
      completeProfilePromptsRequestSchema.safeParse({
        prompts: [validPrompts[0], { ...validPrompts[1], position: 0 }, validPrompts[2]],
      }).success,
    ).toBe(false);
  });
});
