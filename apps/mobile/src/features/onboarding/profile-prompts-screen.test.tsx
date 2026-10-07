import type { ProfilePromptAnswer } from '@pro-date/contracts';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Keyboard } from 'react-native';

import { ProfilePromptsScreen } from './profile-prompts-screen';

const savedPrompts: ProfilePromptAnswer[] = [
  {
    answer: 'I build tiny tools that make creative work feel lighter.',
    id: '00000000-0000-4000-8000-000000000001',
    position: 0,
    promptId: 'weekend_build',
  },
  {
    answer: 'Coffee, a long walk, and one wildly specific playlist.',
    id: '00000000-0000-4000-8000-000000000002',
    position: 1,
    promptId: 'debug_bad_day',
  },
  {
    answer: 'Curious questions, kind reviews, and excellent snack choices.',
    id: '00000000-0000-4000-8000-000000000003',
    position: 2,
    promptId: 'merge_criteria',
  },
];

describe('ProfilePromptsScreen', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('offers the focused catalogue and prevents duplicate selections', async () => {
    const view = await render(
      <ProfilePromptsScreen
        completePrompts={jest.fn()}
        loadPrompts={jest.fn().mockResolvedValue(savedPrompts)}
      />,
    );

    await waitFor(() => expect(view.getByText('3 / 3 ready')).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Change prompt 1' }));

    expect(view.getByText('Choose prompt 1')).toBeTruthy();
    expect(
      view.getByRole('button', {
        name: 'My most unreasonable feature request for life is…',
      }),
    ).toBeTruthy();
    expect(
      view.getByRole('button', {
        name: 'The fastest way to debug my bad day is…',
      }),
    ).toBeDisabled();
  });

  it('keeps commit disabled for a one-word answer and shows live guidance', async () => {
    const view = await render(
      <ProfilePromptsScreen
        completePrompts={jest.fn()}
        loadPrompts={jest.fn().mockResolvedValue(savedPrompts)}
      />,
    );

    await waitFor(() => expect(view.getByLabelText('Answer prompt 1')).toBeTruthy());
    await fireEvent.changeText(view.getByLabelText('Answer prompt 1'), 'Coffee.');

    expect(view.getByText('1 / 5 words or 7 / 30 characters · 7 / 280 max')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Commit prompts and continue' })).toBeDisabled();
  });

  it('lets a new user select three prompts and continue with five-word answers', async () => {
    const view = await render(
      <ProfilePromptsScreen
        completePrompts={jest.fn()}
        loadPrompts={jest.fn().mockResolvedValue([])}
      />,
    );

    await fireEvent.press(await view.findByRole('button', { name: 'Choose prompt 1' }));
    await fireEvent.press(
      view.getByRole('button', {
        name: 'The fastest way to debug my bad day is…',
      }),
    );
    await fireEvent.changeText(view.getByLabelText('Answer prompt 1'), 'I like tea and dogs.');

    await fireEvent.press(view.getByRole('button', { name: 'Choose prompt 2' }));
    await fireEvent.press(
      view.getByRole('button', {
        name: 'The thing I would happily spend a weekend building is…',
      }),
    );
    await fireEvent.changeText(
      view.getByLabelText('Answer prompt 2'),
      'Small tools make creative work lighter.',
    );

    await fireEvent.press(view.getByRole('button', { name: 'Choose prompt 3' }));
    await fireEvent.press(
      view.getByRole('button', {
        name: 'A connection gets merged when both people…',
      }),
    );
    await fireEvent.changeText(
      view.getByLabelText('Answer prompt 3'),
      'Both people stay curious and kind.',
    );

    expect(view.getByText('3 / 3 ready')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Commit prompts and continue' })).toBeEnabled();
  });

  it('counts a thirty-character answer as ready even with fewer than five words', async () => {
    const longAnswer = 'Delightfully overengineered weekends.';
    const view = await render(
      <ProfilePromptsScreen
        completePrompts={jest.fn()}
        loadPrompts={jest
          .fn()
          .mockResolvedValue([
            { ...savedPrompts[0], answer: longAnswer },
            savedPrompts[1],
            savedPrompts[2],
          ])}
      />,
    );

    expect(longAnswer.length).toBeGreaterThanOrEqual(30);
    await waitFor(() => expect(view.getByText('3 / 3 ready')).toBeTruthy());
    expect(view.getByRole('button', { name: 'Commit prompts and continue' })).toBeEnabled();
  });

  it('dismisses the keyboard from the prompt answer Done key', async () => {
    const dismissKeyboard = jest.spyOn(Keyboard, 'dismiss').mockImplementation();
    const view = await render(
      <ProfilePromptsScreen
        completePrompts={jest.fn()}
        loadPrompts={jest.fn().mockResolvedValue(savedPrompts)}
      />,
    );
    const thirdAnswer = await view.findByLabelText('Answer prompt 3');

    expect(thirdAnswer.props.returnKeyType).toBe('done');
    expect(thirdAnswer.props.submitBehavior).toBe('blurAndSubmit');
    await fireEvent(thirdAnswer, 'submitEditing');
    expect(dismissKeyboard).toHaveBeenCalledTimes(1);
  });

  it('commits the trimmed visible answers in order', async () => {
    const completePrompts = jest.fn().mockResolvedValue(undefined);
    const view = await render(
      <ProfilePromptsScreen
        completePrompts={completePrompts}
        loadPrompts={jest.fn().mockResolvedValue(savedPrompts)}
      />,
    );

    await waitFor(() =>
      expect(view.getByRole('button', { name: 'Commit prompts and continue' })).toBeEnabled(),
    );
    await fireEvent.changeText(
      view.getByLabelText('Answer prompt 1'),
      '  I build tiny tools that make creative work feel lighter.  ',
    );
    await fireEvent.press(view.getByRole('button', { name: 'Commit prompts and continue' }));

    expect(completePrompts).toHaveBeenCalledWith([
      {
        answer: 'I build tiny tools that make creative work feel lighter.',
        position: 0,
        promptId: 'weekend_build',
      },
      {
        answer: savedPrompts[1]?.answer,
        position: 1,
        promptId: 'debug_bad_day',
      },
      {
        answer: savedPrompts[2]?.answer,
        position: 2,
        promptId: 'merge_criteria',
      },
    ]);
  });

  it('shows a recoverable load error', async () => {
    const loadPrompts = jest.fn().mockRejectedValue(new Error('The API is unavailable.'));
    const view = await render(
      <ProfilePromptsScreen completePrompts={jest.fn()} loadPrompts={loadPrompts} />,
    );

    await waitFor(() => expect(view.getByText('The API is unavailable.')).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Retry loading prompts' }));
    expect(loadPrompts).toHaveBeenCalledTimes(2);
  });
});
