import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { MotionProvider, useReducedMotionPreference, type MotionSource } from './motion';

function Probe() {
  return <Text>{useReducedMotionPreference() ? 'Static feedback' : 'Motion enabled'}</Text>;
}

describe('motion preferences', () => {
  afterEach(() => jest.restoreAllMocks());

  it('defaults to static feedback without a provider', async () => {
    const view = await render(<Probe />);
    expect(view.getByText('Static feedback')).toBeTruthy();
  });

  it('reacts to system changes and cleans up its single listener', async () => {
    let change = (_value: boolean) => {};
    const remove = jest.fn();
    const source: MotionSource = {
      isReduceMotionEnabled: () => Promise.resolve(false),
      addEventListener: (_event, listener) => {
        change = listener;
        return { remove };
      },
    };
    const view = await render(
      <MotionProvider source={source}>
        <Probe />
      </MotionProvider>,
    );
    expect(await view.findByText('Motion enabled')).toBeTruthy();
    await act(() => change(true));
    expect(view.getByText('Static feedback')).toBeTruthy();
    await view.unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('does not let a late startup query override a newer system event', async () => {
    let resolve = (_value: boolean) => {};
    let change = (_value: boolean) => {};
    const source: MotionSource = {
      isReduceMotionEnabled: () =>
        new Promise<boolean>((done) => {
          resolve = done;
        }),
      addEventListener: (_event, listener) => {
        change = listener;
        return { remove: jest.fn() };
      },
    };
    const view = await render(
      <MotionProvider source={source}>
        <Probe />
      </MotionProvider>,
    );
    await act(() => change(true));
    await act(() => resolve(false));
    expect(view.getByText('Static feedback')).toBeTruthy();
  });
});
