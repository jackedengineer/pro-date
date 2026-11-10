import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { replyActionStyle, SwipeToReply } from './swipe-to-reply';
const mockReset = jest.fn();
const mockClose = jest.fn();
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return React.forwardRef(function Swipe(
    props: {
      children: React.ReactNode;
      renderLeftActions?: (progress: { value: number }) => React.ReactNode;
    },
    ref,
  ) {
    React.useImperativeHandle(ref, () => ({ reset: mockReset, close: mockClose }));
    // Like Gesture Handler 3, the left actions stay mounted behind the row at rest (progress 0).
    return (
      <View {...props} testID="swipe">
        {props.renderLeftActions?.({ value: 0 })}
        {props.children}
      </View>
    );
  });
});
jest.mock('../../theme/feedback', () => ({ triggerFeedback: jest.fn() }));
// The real module needs the native worklets runtime; animated styles are computed directly.
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: { View },
    useAnimatedStyle: (factory: () => object) => factory(),
  };
});
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
      dragOffsetFromLeft: 24,
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

  it('renders the mounted reply icon fully transparent while the row is at rest', async () => {
    const view = await render(
      <SwipeToReply messageId="first" onReply={jest.fn()} reducedMotion={false}>
        <Text>hello</Text>
      </SwipeToReply>,
    );
    const action = view.getByTestId('swipe-reply-action', {
      // The decorative action is hidden from assistive technology, like the native row.
      includeHiddenElements: true,
    });
    expect(StyleSheet.flatten(action.props.style as object)).toMatchObject({ opacity: 0 });
  });

  it('reveals the reply icon only as a right swipe progresses', () => {
    // At rest every outgoing row would otherwise show the icon beside its bubble.
    expect(replyActionStyle(0)).toMatchObject({ opacity: 0 });
    expect(replyActionStyle(-0.5)).toMatchObject({ opacity: 0 });
    expect(replyActionStyle(0.5).opacity).toBeCloseTo(0.5);
    expect(replyActionStyle(1)).toEqual({ opacity: 1, transform: [{ scale: 1 }] });
    expect(replyActionStyle(3)).toEqual({ opacity: 1, transform: [{ scale: 1 }] });
  });
});
