import { render } from '@testing-library/react-native';
import { Platform, type ScrollViewProps, StyleSheet, Text } from 'react-native';

import { OnboardingStepLayout } from './onboarding-step-layout';

describe('OnboardingStepLayout', () => {
  it('keeps lower form fields reachable when the keyboard opens', async () => {
    const view = await render(
      <OnboardingStepLayout current={8} footer={<Text>Continue</Text>}>
        <Text>Prompt fields</Text>
      </OnboardingStepLayout>,
    );
    const [scrollView] = view.container.queryAll(
      (instance) => instance.props.keyboardDismissMode !== undefined,
    );
    if (scrollView === undefined) throw new Error('Expected onboarding scroll view.');
    const scrollViewProps = scrollView.props as ScrollViewProps;
    const contentStyle = StyleSheet.flatten(scrollViewProps.contentContainerStyle);

    expect(scrollViewProps.automaticallyAdjustKeyboardInsets).toBe(true);
    expect(scrollViewProps.keyboardDismissMode).toBe(
      Platform.OS === 'ios' ? 'interactive' : 'on-drag',
    );
    expect(contentStyle?.paddingBottom).toBeGreaterThan(0);
  });
});
