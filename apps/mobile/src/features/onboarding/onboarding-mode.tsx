import X from 'lucide-react-native/icons/x';
import { createContext, useContext } from 'react';

import { BackIcon } from '../../components/back-icon';

/**
 * The same step screens serve two jobs. In `setup` they are a guided sequence with progress.
 * In `edit` one of them is opened on its own from the member's profile to change a single thing.
 */
export type OnboardingMode = 'setup' | 'edit';

export const OnboardingModeContext = createContext<OnboardingMode>('setup');
export const useOnboardingMode = () => useContext(OnboardingModeContext);

/** What the step's main button says, and how a screen reader should hear it. */
export function useStepAction(setupAccessibilityLabel: string) {
  const editing = useOnboardingMode() === 'edit';
  return {
    label: editing ? 'Save' : 'Continue',
    accessibilityLabel: editing
      ? setupAccessibilityLabel.replace(/ and continue$/, '')
      : setupAccessibilityLabel,
  };
}

/** A lone edit screen is dismissed, not stepped back through. */
export function useStepBack(setupLabel: string) {
  const editing = useOnboardingMode() === 'edit';
  return {
    icon: editing ? X : BackIcon,
    label: editing ? 'Close without saving' : setupLabel,
  };
}
