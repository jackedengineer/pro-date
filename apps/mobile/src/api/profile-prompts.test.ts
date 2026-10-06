import type { ProfilePromptAnswer, ProfilePromptAnswerInput } from '@pro-date/contracts';

import type { GetSessionToken } from './current-user';
import { completeProfilePrompts, listProfilePrompts } from './profile-prompts';

const apiBaseUrl = 'https://api.prodate.example';
const requestId = '59a2c4a6-110e-470e-bcab-c762c18dec45';
const prompts: ProfilePromptAnswerInput[] = [
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
];
const savedPrompts: ProfilePromptAnswer[] = prompts.map((prompt, index) => ({
  ...prompt,
  id: `00000000-0000-4000-8000-${(index + 1).toString().padStart(12, '0')}`,
}));

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('profile prompt API', () => {
  const getToken = jest.fn().mockResolvedValue('session-token') as GetSessionToken;

  it('loads the authenticated prompt draft', async () => {
    const fetchImplementation = jest
      .fn()
      .mockResolvedValue(response({ data: savedPrompts, onboardingStep: 'PROMPTS', requestId }));

    await expect(
      listProfilePrompts({ apiBaseUrl, fetchImplementation, getToken }),
    ).resolves.toEqual(savedPrompts);
    expect(fetchImplementation).toHaveBeenCalledWith(`${apiBaseUrl}/v1/users/me/profile-prompts`, {
      headers: { Accept: 'application/json', Authorization: 'Bearer session-token' },
      method: 'GET',
    });
  });

  it('validates and commits three answers in presentation order', async () => {
    const fetchImplementation = jest
      .fn()
      .mockResolvedValue(response({ data: savedPrompts, onboardingStep: 'REVIEW', requestId }));

    await expect(
      completeProfilePrompts({ apiBaseUrl, fetchImplementation, getToken, prompts }),
    ).resolves.toEqual({ answers: savedPrompts, onboardingStep: 'REVIEW' });
    expect(fetchImplementation).toHaveBeenCalledWith(`${apiBaseUrl}/v1/users/me/profile-prompts`, {
      body: JSON.stringify({ prompts }),
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
      },
      method: 'PUT',
    });
  });

  it('rejects a weak answer before making a network request', async () => {
    const fetchImplementation = jest.fn();

    await expect(
      completeProfilePrompts({
        apiBaseUrl,
        fetchImplementation,
        getToken,
        prompts: prompts.map((prompt, index) =>
          index === 0 ? { ...prompt, answer: 'Coffee.' } : prompt,
        ),
      }),
    ).rejects.toThrow('Write three distinct answers with at least five words each.');
    expect(fetchImplementation).not.toHaveBeenCalled();
  });
});
