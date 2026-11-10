export type AccountDeletionOutcome =
  | { status: 'CANCELLED' }
  | { status: 'DELETED'; signInRemoved: boolean }
  | { status: 'FAILED'; message: string };

export interface AccountDeletionPorts {
  /** A plain statement of what will be lost; resolves false when the member keeps the account. */
  confirm: () => Promise<boolean>;
  /** Asks the server to delete the account. */
  requestDeletion: () => Promise<{ signInRemoved: boolean }>;
  /** Ends the local session. The messaging provider then purges this owner's cache and queue. */
  endSession: () => Promise<void>;
}

/**
 * The server deletes first; the session ends only after it confirms. If ending the session then
 * fails (the account it belonged to no longer exists), the deletion still stands.
 */
export async function runAccountDeletion(
  ports: AccountDeletionPorts,
): Promise<AccountDeletionOutcome> {
  if (!(await ports.confirm())) return { status: 'CANCELLED' };

  let signInRemoved: boolean;
  try {
    ({ signInRemoved } = await ports.requestDeletion());
  } catch (failure: unknown) {
    return {
      status: 'FAILED',
      message:
        failure instanceof Error ? failure.message : 'Couldn’t delete your account. Try again.',
    };
  }

  await ports.endSession().catch(() => {});
  return { status: 'DELETED', signInRemoved };
}
