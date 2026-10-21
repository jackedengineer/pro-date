import { fireEvent, render } from '@testing-library/react-native';
import { Text, type ModalProps } from 'react-native';
import { DiscoverySheet } from './discovery-sheet';

it('keeps busy sheets open through the close control and Android back request', async () => {
  const onClose = jest.fn();
  const view = await render(
    <DiscoverySheet title="Preferences" onClose={onClose} busy>
      <Text>Saving</Text>
    </DiscoverySheet>,
  );
  const modal = view.container.queryAll((node) => node.props.onRequestClose !== undefined)[0];
  if (modal === undefined) throw new Error('Expected native modal.');
  const props = modal.props as ModalProps;
  await fireEvent.press(view.getByRole('button', { name: 'Close' }));
  await fireEvent(modal, 'requestClose');
  expect(onClose).not.toHaveBeenCalled();
  expect(props.animationType).toBe('none');
  await view.rerender(
    <DiscoverySheet title="Preferences" onClose={onClose}>
      <Text>Saved</Text>
    </DiscoverySheet>,
  );
  await fireEvent.press(view.getByRole('button', { name: 'Close' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});
