import * as Haptics from 'expo-haptics';
import { triggerFeedback } from './feedback';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success' },
  ImpactFeedbackStyle: { Light: 'light' },
}));

describe('optional tactile feedback', () => {
  it('uses one selection signal for a deliberate action', () => {
    triggerFeedback('selection');
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('marks a landed action with a light impact and a merge with a success signal', () => {
    triggerFeedback('impact');
    triggerFeedback('success');
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  });

  it('does not turn unavailable hardware into an action failure', async () => {
    jest.mocked(Haptics.selectionAsync).mockRejectedValueOnce(new Error('Unavailable'));
    expect(() => triggerFeedback('selection')).not.toThrow();
    await Promise.resolve();
  });

  it('also tolerates synchronous native failures', () => {
    jest.mocked(Haptics.selectionAsync).mockImplementationOnce(() => {
      throw new Error('Native module unavailable');
    });
    expect(() => triggerFeedback('selection')).not.toThrow();
  });
});
