import { z } from 'zod';

import { onboardingStepSchema } from './current-user';

export const PROFILE_PROMPT_COUNT = 3;
export const PROFILE_PROMPT_ANSWER_MIN_CHARACTERS = 30;
export const PROFILE_PROMPT_ANSWER_MIN_WORDS = 5;
export const PROFILE_PROMPT_ANSWER_MAX_CHARACTERS = 280;

export const PROFILE_PROMPT_IDS = [
  'green_flag_release_notes',
  'weekend_build',
  'founder_mode_off',
  'life_feature_request',
  'hot_take_ship',
  'debug_bad_day',
  'first_date_energy',
  'meet_cute',
  'unexpected_plot_twist',
  'current_side_quest',
  'keynote_hyperfixation',
  'group_chat_role',
  'low_stakes_hill',
  'good_taste_signal',
  'after_hours',
  'cofounder_for_a_day',
  'personal_roadmap',
  'merge_criteria',
  'best_self_offline',
  'personal_user_manual',
] as const;

export const profilePromptIdSchema = z.enum(PROFILE_PROMPT_IDS);
export type ProfilePromptId = z.infer<typeof profilePromptIdSchema>;

export const PROFILE_PROMPT_CATALOGUE = [
  {
    category: 'Connection',
    id: 'green_flag_release_notes',
    text: 'My green flags, according to the release notes, are…',
  },
  {
    category: 'Build mode',
    id: 'weekend_build',
    text: 'The thing I would happily spend a weekend building is…',
  },
  {
    category: 'Off the clock',
    id: 'founder_mode_off',
    text: 'When founder mode is off, you will find me…',
  },
  {
    category: 'Playful',
    id: 'life_feature_request',
    text: 'My most unreasonable feature request for life is…',
  },
  {
    category: 'Hot take',
    id: 'hot_take_ship',
    text: 'A hot take I am fully willing to ship is…',
  },
  {
    category: 'Care',
    id: 'debug_bad_day',
    text: 'The fastest way to debug my bad day is…',
  },
  {
    category: 'Dating',
    id: 'first_date_energy',
    text: 'My perfect first date has this exact energy…',
  },
  {
    category: 'Dating',
    id: 'meet_cute',
    text: 'Our meet-cute should probably start with…',
  },
  {
    category: 'Story',
    id: 'unexpected_plot_twist',
    text: 'The plot twist people never expect about me is…',
  },
  {
    category: 'Off the clock',
    id: 'current_side_quest',
    text: 'My current side quest outside work is…',
  },
  {
    category: 'Curiosity',
    id: 'keynote_hyperfixation',
    text: 'The hyperfixation I could give a keynote on is…',
  },
  {
    category: 'Social',
    id: 'group_chat_role',
    text: 'My official role in the group chat is…',
  },
  {
    category: 'Hot take',
    id: 'low_stakes_hill',
    text: 'A low-stakes hill I will absolutely die on is…',
  },
  {
    category: 'Taste',
    id: 'good_taste_signal',
    text: 'A tiny detail that instantly signals good taste is…',
  },
  {
    category: 'Off the clock',
    id: 'after_hours',
    text: 'After hours, my personality usually switches to…',
  },
  {
    category: 'Playful',
    id: 'cofounder_for_a_day',
    text: 'If we were co-founders for a day, we would build…',
  },
  {
    category: 'Growth',
    id: 'personal_roadmap',
    text: 'The next thing on my personal roadmap is…',
  },
  {
    category: 'Connection',
    id: 'merge_criteria',
    text: 'A connection gets merged when both people…',
  },
  {
    category: 'Lifestyle',
    id: 'best_self_offline',
    text: 'The best version of me is offline doing…',
  },
  {
    category: 'Story',
    id: 'personal_user_manual',
    text: 'The one thing my user manual should mention is…',
  },
] as const satisfies readonly {
  category: string;
  id: ProfilePromptId;
  text: string;
}[];

export const profilePromptAnswerTextSchema = z
  .string()
  .trim()
  .max(PROFILE_PROMPT_ANSWER_MAX_CHARACTERS)
  .refine(
    (answer) =>
      answer.length >= PROFILE_PROMPT_ANSWER_MIN_CHARACTERS ||
      answer.split(/\s+/).filter(Boolean).length >= PROFILE_PROMPT_ANSWER_MIN_WORDS,
    {
      message: `Write at least ${PROFILE_PROMPT_ANSWER_MIN_WORDS} words or ${PROFILE_PROMPT_ANSWER_MIN_CHARACTERS} characters.`,
    },
  );

export const profilePromptPositionSchema = z
  .number()
  .int()
  .min(0)
  .max(PROFILE_PROMPT_COUNT - 1);

export const profilePromptAnswerInputSchema = z.strictObject({
  answer: profilePromptAnswerTextSchema,
  position: profilePromptPositionSchema,
  promptId: profilePromptIdSchema,
});

export const profilePromptAnswerSchema = profilePromptAnswerInputSchema.extend({
  id: z.uuid(),
});

export const completeProfilePromptsRequestSchema = z
  .strictObject({
    prompts: z.array(profilePromptAnswerInputSchema).length(PROFILE_PROMPT_COUNT),
  })
  .refine(
    (value) =>
      new Set(value.prompts.map((prompt) => prompt.promptId)).size === value.prompts.length,
    {
      message: 'Choose three different prompts.',
      path: ['prompts'],
    },
  )
  .refine(
    (value) =>
      new Set(value.prompts.map((prompt) => prompt.position)).size === value.prompts.length,
    {
      message: 'Choose each prompt position once.',
      path: ['prompts'],
    },
  );

export const profilePromptListResponseSchema = z.strictObject({
  data: z.array(profilePromptAnswerSchema).max(PROFILE_PROMPT_COUNT),
  onboardingStep: onboardingStepSchema,
  requestId: z.uuid(),
});

export type CompleteProfilePromptsRequest = z.infer<typeof completeProfilePromptsRequestSchema>;
export type ProfilePromptAnswer = z.infer<typeof profilePromptAnswerSchema>;
export type ProfilePromptAnswerInput = z.infer<typeof profilePromptAnswerInputSchema>;
export type ProfilePromptListResponse = z.infer<typeof profilePromptListResponseSchema>;
