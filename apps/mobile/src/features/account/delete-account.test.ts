import { runAccountDeletion, type AccountDeletionPorts } from './delete-account';

function ports(overrides: Partial<AccountDeletionPorts> = {}) {
  return {
    confirm: jest.fn().mockResolvedValue(true),
    requestDeletion: jest.fn().mockResolvedValue({ signInRemoved: true }),
    endSession: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('runAccountDeletion', () => {
  it('does nothing when the member keeps their account', async () => {
    const p = ports({ confirm: jest.fn().mockResolvedValue(false) });

    await expect(runAccountDeletion(p)).resolves.toEqual({ status: 'CANCELLED' });
    expect(p.requestDeletion).not.toHaveBeenCalled();
    expect(p.endSession).not.toHaveBeenCalled();
  });

  it('ends the session only after the server confirms the deletion', async () => {
    const order: string[] = [];
    const p = ports({
      requestDeletion: jest.fn(() => {
        order.push('delete');
        return Promise.resolve({ signInRemoved: true });
      }),
      endSession: jest.fn(() => {
        order.push('end');
        return Promise.resolve();
      }),
    });

    await expect(runAccountDeletion(p)).resolves.toEqual({
      status: 'DELETED',
      signInRemoved: true,
    });
    expect(order).toEqual(['delete', 'end']);
  });

  it('keeps the member signed in when the server could not delete', async () => {
    const p = ports({ requestDeletion: jest.fn().mockRejectedValue(new Error('Offline.')) });

    await expect(runAccountDeletion(p)).resolves.toEqual({ status: 'FAILED', message: 'Offline.' });
    expect(p.endSession).not.toHaveBeenCalled();
  });

  it('still counts as deleted when the dead session cannot be ended cleanly', async () => {
    const p = ports({
      requestDeletion: jest.fn().mockResolvedValue({ signInRemoved: false }),
      endSession: jest.fn().mockRejectedValue(new Error('session not found')),
    });

    await expect(runAccountDeletion(p)).resolves.toEqual({
      status: 'DELETED',
      signInRemoved: false,
    });
  });
});
