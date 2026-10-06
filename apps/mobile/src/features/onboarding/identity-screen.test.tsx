import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { IdentityScreen } from './identity-screen';

describe('IdentityScreen', () => {
  it('supports self-described identity and pronouns', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const view = await render(<IdentityScreen onSave={onSave} />);

    await fireEvent.press(view.getByRole('radio', { name: 'Self-describe' }));
    await fireEvent.changeText(view.getByLabelText('Describe your gender identity'), 'Demigirl');
    await fireEvent.press(view.getByRole('radio', { name: 'Self-describe pronouns' }));
    await fireEvent.changeText(view.getByLabelText('Describe your pronouns'), 'xe/xem');
    await fireEvent.press(view.getByRole('button', { name: 'Save identity and continue' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        arePronounsVisible: true,
        genderIdentity: 'Demigirl',
        isGenderVisible: true,
        pronouns: 'xe/xem',
      }),
    );
  });
});
