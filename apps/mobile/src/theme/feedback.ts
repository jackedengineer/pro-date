import * as Haptics from 'expo-haptics';

/**
 * - `selection`: a value ticked to a new step.
 * - `impact`: something the member did has landed (a like is on its way).
 * - `success`: a rare, good outcome (a merge).
 */
export type FeedbackKind = 'selection' | 'impact' | 'success';

// Feedback is optional: suppressed hardware must never reject the user's action.
// https://docs.expo.dev/versions/latest/sdk/haptics/
export function triggerFeedback(kind: FeedbackKind): void {
  try {
    const feedback =
      kind === 'selection'
        ? Haptics.selectionAsync()
        : kind === 'impact'
          ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void feedback.catch(() => {});
  } catch {
    // Some runtimes have no native haptic implementation.
  }
}
