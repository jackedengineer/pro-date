import { runSignOut, type SignOutPorts, type UnconfirmedRevocationChoice } from './sign-out';

function ports(overrides: Partial<SignOutPorts> = {}) {
  const calls: string[] = [];
  const value: SignOutPorts = {
    confirm: jest.fn(() => {
      calls.push('confirm');
      return Promise.resolve(true);
    }),
    canRevokeDevice: true,
    revokeDevice: jest.fn(() => {
      calls.push('revoke');
      return Promise.resolve(true);
    }),
    onUnconfirmedRevocation: jest.fn(() => Promise.resolve<UnconfirmedRevocationChoice>('cancel')),
    endSession: jest.fn(() => {
      calls.push('endSession');
      return Promise.resolve();
    }),
    ...overrides,
  };
  return { value, calls };
}

describe('sign-out orchestration', () => {
  it('revokes this phone’s push binding while the session can still authenticate it', async () => {
    const { value, calls } = ports();
    await expect(runSignOut(value)).resolves.toBe('SIGNED_OUT');
    expect(calls).toEqual(['confirm', 'revoke', 'endSession']);
  });

  it('does nothing when the member keeps their session', async () => {
    const { value } = ports({ confirm: () => Promise.resolve(false) });
    await expect(runSignOut(value)).resolves.toBe('CANCELLED');
    expect(value.revokeDevice).not.toHaveBeenCalled();
    expect(value.endSession).not.toHaveBeenCalled();
  });

  it('never treats an unconfirmed revocation as done: retry, then proceed only by choice', async () => {
    const revokeDevice = jest
      .fn<Promise<boolean>, []>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const onUnconfirmedRevocation = jest
      .fn<Promise<UnconfirmedRevocationChoice>, []>()
      .mockResolvedValue('retry');
    const { value } = ports({ revokeDevice, onUnconfirmedRevocation });
    await expect(runSignOut(value)).resolves.toBe('SIGNED_OUT');
    expect(revokeDevice).toHaveBeenCalledTimes(3);
    expect(onUnconfirmedRevocation).toHaveBeenCalledTimes(2);

    const anyway = ports({
      revokeDevice: () => Promise.resolve(false),
      onUnconfirmedRevocation: () => Promise.resolve('proceed'),
    });
    await expect(runSignOut(anyway.value)).resolves.toBe('SIGNED_OUT');
    expect(anyway.value.endSession).toHaveBeenCalledTimes(1);
  });

  it('keeps the session when the member cancels after an unconfirmed revocation', async () => {
    const { value } = ports({ revokeDevice: () => Promise.resolve(false) });
    await expect(runSignOut(value)).resolves.toBe('CANCELLED');
    expect(value.endSession).not.toHaveBeenCalled();
  });

  it('skips revocation when this session never had a notification lifecycle', async () => {
    const { value, calls } = ports({ canRevokeDevice: false });
    await expect(runSignOut(value)).resolves.toBe('SIGNED_OUT');
    expect(calls).toEqual(['confirm', 'endSession']);
  });

  it('reports a failed session end instead of navigating as if signed out', async () => {
    const { value } = ports({ endSession: () => Promise.reject(new Error('offline')) });
    await expect(runSignOut(value)).resolves.toBe('FAILED');
  });
});
