import * as Haptics from 'expo-haptics';

// Feedback is optional: suppressed hardware must never reject the user's action.
// https://docs.expo.dev/versions/v57.0.0/sdk/haptics/
export function triggerFeedback(kind: 'selection' | 'success'): void {
  try {
    const feedback =
      kind === 'selection'
        ? Haptics.selectionAsync()
        : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void feedback.catch(() => {});
  } catch {
    // Some runtimes have no native haptic implementation.
  }
}
