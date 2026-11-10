import { z } from 'zod';

/**
 * The result of deleting an account. `deleted` means every Merge record for the member is gone.
 * `signInRemoved` is false only when the sign-in provider could not be reached afterwards; the
 * member's Merge data is still deleted, and the client must say what is left.
 */
export const accountDeletionResponseSchema = z.object({
  data: z.object({ deleted: z.literal(true), signInRemoved: z.boolean() }),
  requestId: z.uuid(),
});

export type AccountDeletionResponse = z.infer<typeof accountDeletionResponseSchema>;
