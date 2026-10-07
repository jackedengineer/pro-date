import {
  apiErrorResponseSchema,
  completeProfilePromptsRequestSchema,
  profilePromptListResponseSchema,
  type OnboardingStep,
  type ProfilePromptAnswer,
  type ProfilePromptAnswerInput,
} from '@pro-date/contracts';

import type { GetSessionToken } from './current-user';

interface ProfilePromptApiOptions {
  apiBaseUrl: string;
  fetchImplementation?: typeof fetch;
  getToken: GetSessionToken;
}

interface CompleteProfilePromptsOptions extends ProfilePromptApiOptions {
  prompts: ProfilePromptAnswerInput[];
}

export interface CompletedProfilePrompts {
  answers: ProfilePromptAnswer[];
  onboardingStep: OnboardingStep;
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

async function getRequiredToken(getToken: GetSessionToken): Promise<string> {
  const token = await getToken();

  if (token === null) throw new Error('Your session expired. Please sign in again.');

  return token;
}

function parseResponse(responseBody: unknown): CompletedProfilePrompts {
  const parsed = profilePromptListResponseSchema.safeParse(responseBody);

  if (!parsed.success) throw new Error('The server returned an unexpected prompt response.');

  return { answers: parsed.data.data, onboardingStep: parsed.data.onboardingStep };
}

function throwApiError(responseBody: unknown, fallback: string): never {
  const parsed = apiErrorResponseSchema.safeParse(responseBody);

  throw new Error(parsed.success ? parsed.data.error.message : fallback);
}

export async function listProfilePrompts({
  apiBaseUrl,
  fetchImplementation = fetch,
  getToken,
}: ProfilePromptApiOptions): Promise<ProfilePromptAnswer[]> {
  const token = await getRequiredToken(getToken);
  const response = await fetchImplementation(`${apiBaseUrl}/v1/users/me/profile-prompts`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    method: 'GET',
  });
  const responseBody = await readJsonResponse(response);

  if (!response.ok) {
    throwApiError(responseBody, 'We could not load your prompt draft. Please try again.');
  }

  return parseResponse(responseBody).answers;
}

export async function completeProfilePrompts({
  apiBaseUrl,
  fetchImplementation = fetch,
  getToken,
  prompts,
}: CompleteProfilePromptsOptions): Promise<CompletedProfilePrompts> {
  const input = completeProfilePromptsRequestSchema.safeParse({ prompts });

  if (!input.success) {
    throw new Error('Write three distinct answers with at least five words or 30 characters each.');
  }

  const token = await getRequiredToken(getToken);
  const response = await fetchImplementation(`${apiBaseUrl}/v1/users/me/profile-prompts`, {
    body: JSON.stringify(input.data),
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    method: 'PUT',
  });
  const responseBody = await readJsonResponse(response);

  if (!response.ok) {
    throwApiError(responseBody, 'We could not save your prompts. Please try again.');
  }

  return parseResponse(responseBody);
}
