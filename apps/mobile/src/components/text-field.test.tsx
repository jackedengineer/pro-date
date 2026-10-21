import { createRef } from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { TextInput } from 'react-native';
import { TextField } from './text-field';

describe('TextField', () => {
  it('forwards focus, text and ref without owning form values', async () => {
    const ref = createRef<TextInput>();
    const onFocus = jest.fn();
    const onChangeText = jest.fn();
    const view = await render(
      <TextField
        ref={ref}
        accessibilityLabel="Name"
        value="Sam"
        onFocus={onFocus}
        onChangeText={onChangeText}
      />,
    );
    await fireEvent(view.getByLabelText('Name'), 'focus', {});
    await fireEvent.changeText(view.getByLabelText('Name'), 'Riya');
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onChangeText).toHaveBeenCalledWith('Riya');
    expect(ref.current).not.toBeNull();
  });
});
