import { describe, expect, it, vi } from 'vitest';

import { createAccountDeletionService } from '../src/account/account-deletion-service.js';

const subject = 'user_clerk_subject';
const userId = '729438da-99b3-4d3d-b566-bfe94401829b';

function dependencies() {
  const order: string[] = [];
  return {
    order,
    deleteUserData: vi.fn(() => {
      order.push('data');
      return Promise.resolve<string | null>(userId);
    }),
    deleteMedia: vi.fn(() => {
      order.push('media');
      return Promise.resolve();
    }),
    deleteIdentity: vi.fn(() => {
      order.push('identity');
      return Promise.resolve();
    }),
    onDeleted: vi.fn(),
    onStepFailure: vi.fn(),
  };
}

describe('account deletion', () => {
  it('deletes the data first, then media, then the sign-in identity', async () => {
    const deps = dependencies();
    const service = createAccountDeletionService(deps);

    await expect(service.deleteAccount(subject)).resolves.toEqual({
      deleted: true,
      signInRemoved: true,
    });
    expect(deps.order).toEqual(['data', 'media', 'identity']);
    expect(deps.deleteMedia).toHaveBeenCalledWith(userId);
    expect(deps.onDeleted).toHaveBeenCalledWith(userId);
    expect(deps.onStepFailure).not.toHaveBeenCalled();
  });

  it('changes nothing else when the data cannot be deleted', async () => {
    const deps = dependencies();
    deps.deleteUserData.mockRejectedValueOnce(new Error('database down'));
    const service = createAccountDeletionService(deps);

    await expect(service.deleteAccount(subject)).rejects.toThrow('database down');
    expect(deps.deleteMedia).not.toHaveBeenCalled();
    expect(deps.deleteIdentity).not.toHaveBeenCalled();
  });

  it('still removes the sign-in when the member never created a profile', async () => {
    const deps = dependencies();
    deps.deleteUserData.mockResolvedValueOnce(null);
    const service = createAccountDeletionService(deps);

    await expect(service.deleteAccount(subject)).resolves.toMatchObject({ signInRemoved: true });
    expect(deps.deleteMedia).not.toHaveBeenCalled();
    expect(deps.onDeleted).not.toHaveBeenCalled();
    expect(deps.deleteIdentity).toHaveBeenCalledWith(subject);
  });

  it('retries a failing step, then reports honestly what is left', async () => {
    const deps = dependencies();
    deps.deleteMedia.mockRejectedValueOnce(new Error('timeout'));
    deps.deleteIdentity.mockRejectedValue(new Error('provider unavailable'));
    const service = createAccountDeletionService(deps);

    await expect(service.deleteAccount(subject)).resolves.toEqual({
      deleted: true,
      signInRemoved: false,
    });
    expect(deps.deleteMedia).toHaveBeenCalledTimes(2);
    expect(deps.deleteIdentity).toHaveBeenCalledTimes(3);
    expect(deps.onStepFailure).toHaveBeenCalledTimes(1);
    expect(deps.onStepFailure).toHaveBeenCalledWith('identity', expect.any(Error));
  });

  it('works without media storage configured', async () => {
    const deps = dependencies();
    const service = createAccountDeletionService({ ...deps, deleteMedia: null });

    await expect(service.deleteAccount(subject)).resolves.toMatchObject({ deleted: true });
    expect(deps.order).toEqual(['data', 'identity']);
  });
});
