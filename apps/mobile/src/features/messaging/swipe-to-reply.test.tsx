import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SwipeToReply } from './swipe-to-reply';
const mockReset = jest.fn();
const mockClose = jest.fn();
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return React.forwardRef(function Swipe(props: { children: React.ReactNode }, ref) {
    React.useImperativeHandle(ref, () => ({ reset: mockReset, close: mockClose }));
    return <View {...props} testID="swipe" />;
  });
});
jest.mock('../../theme/feedback', () => ({ triggerFeedback: jest.fn() }));
describe('reply gesture boundary', () => {
  beforeEach(() => jest.clearAllMocks());
  it('bounds right swipes and resets reused cells without changing message identity', async () => {
    const reply = jest.fn();
    const view = await render(
      <SwipeToReply messageId="first" onReply={reply} reducedMotion={false}>
        <Text>hello</Text>
      </SwipeToReply>,
    );
    expect(view.getByTestId('swipe').props).toMatchObject({
      overshootLeft: false,
      leftThreshold: 44,
      dragOffsetFromLeftEdge: 24,
    });
    await fireEvent(view.getByTestId('swipe'), 'swipeableOpen', 'left');
    expect(reply).toHaveBeenCalledWith('first');
    expect(mockClose).toHaveBeenCalledTimes(1);
    await view.rerender(
      <SwipeToReply messageId="second" onReply={reply} reducedMotion>
        <Text>next</Text>
      </SwipeToReply>,
    );
    expect(mockReset).toHaveBeenCalledTimes(2);
    await fireEvent(view.getByTestId('swipe'), 'swipeableOpen', 'left');
    expect(reply).toHaveBeenLastCalledWith('second');
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
