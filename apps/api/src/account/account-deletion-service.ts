export interface AccountDeletionResult {
  deleted: true;
  /** False when the sign-in provider could not be reached after the member's data was deleted. */
  signInRemoved: boolean;
}

export interface AccountDeletionDependencies {
  /** Deletes the member's rows and returns their internal id, or null if they had none. */
  deleteUserData: (clerkSubject: string) => Promise<string | null>;
  /** Deletes every image the member uploaded. Null when media is not configured. */
  deleteMedia: ((userId: string) => Promise<void>) | null;
  /** Deletes the sign-in identity held by the authentication provider. */
  deleteIdentity: (clerkSubject: string) => Promise<void>;
  /** Called once the member's data is gone, for example to close their live connections. */
  onDeleted?: (userId: string) => void;
  /** Reports a step that failed after its retries. Never receives personal data. */
  onStepFailure?: (step: 'media' | 'identity', error: unknown) => void;
  attempts?: number;
}

async function withRetries(attempts: number, action: () => Promise<void>): Promise<unknown> {
  let failure: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      await action();
      return undefined;
    } catch (error: unknown) {
      failure = error;
    }
  }
  return failure ?? new Error('The step failed.');
}

/**
 * Permanently deletes an account, in the order that leaves the least behind if a step fails:
 *
 * 1. The member's Merge data. If this fails, nothing has changed and the request fails.
 * 2. Their uploaded images. A failure is reported; unreferenced images are also swept later.
 * 3. Their sign-in identity. A failure is reported to the caller so the member is told the
 *    truth: their Merge data is gone, their sign-in is not yet.
 *
 * Deleting the identity first would lock a member out while their data still existed, with no
 * way for them to ask again.
 */
export function createAccountDeletionService({
  deleteUserData,
  deleteMedia,
  deleteIdentity,
  onDeleted,
  onStepFailure,
  attempts = 3,
}: AccountDeletionDependencies) {
  return {
    async deleteAccount(clerkSubject: string): Promise<AccountDeletionResult> {
      const userId = await deleteUserData(clerkSubject);

      if (userId !== null) {
        onDeleted?.(userId);
        if (deleteMedia !== null) {
          const mediaFailure = await withRetries(attempts, () => deleteMedia(userId));
          if (mediaFailure !== undefined) onStepFailure?.('media', mediaFailure);
        }
      }

      const identityFailure = await withRetries(attempts, () => deleteIdentity(clerkSubject));
      if (identityFailure !== undefined) onStepFailure?.('identity', identityFailure);

      return { deleted: true, signInRemoved: identityFailure === undefined };
    },
  };
}

export type AccountDeletionService = ReturnType<typeof createAccountDeletionService>;
