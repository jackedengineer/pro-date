import { render } from '@testing-library/react-native';
import { Text, type ScrollViewProps } from 'react-native';
import { FormScrollView } from './form-scroll-view';

it('keeps forms scrollable with native keyboard insets and handled taps', async () => {
  const view = await render(
    <FormScrollView>
      <Text>Form content</Text>
    </FormScrollView>,
  );
  const scroll = view.container.queryAll((node) => node.props.keyboardDismissMode !== undefined)[0];
  const props = scroll?.props as ScrollViewProps;
  expect(props.automaticallyAdjustKeyboardInsets).toBe(true);
  expect(props.keyboardShouldPersistTaps).toBe('handled');
});
