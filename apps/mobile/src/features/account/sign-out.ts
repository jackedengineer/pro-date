export type UnconfirmedRevocationChoice = 'retry' | 'proceed' | 'cancel';
export type SignOutOutcome = 'SIGNED_OUT' | 'CANCELLED' | 'FAILED';

export interface SignOutPorts {
  /** Plain-language confirmation; resolves false when the member keeps their session. */
  confirm: () => Promise<boolean>;
  /** False when no notification lifecycle exists in this session, so nothing can be revoked. */
  canRevokeDevice: boolean;
  /** Bounded server revocation; true only when the server confirmed this phone gets no alerts. */
  revokeDevice: () => Promise<boolean>;
  /** Asked when revocation is unconfirmed. Never reported to the member as completed. */
  onUnconfirmedRevocation: () => Promise<UnconfirmedRevocationChoice>;
  /** Ends the Clerk session. The messaging provider then purges this owner's cache and queue. */
  endSession: () => Promise<void>;
}

/**
 * Order matters: the device is revoked while the session can still authenticate the request.
 * Ending the session first would leave this phone bound to the previous member, so the next
 * person to sign in on it could receive that member's chat alerts.
 */
export async function runSignOut(ports: SignOutPorts): Promise<SignOutOutcome> {
  if (!(await ports.confirm())) return 'CANCELLED';

  if (ports.canRevokeDevice) {
    for (;;) {
      if (await ports.revokeDevice()) break;
      const choice = await ports.onUnconfirmedRevocation();
      if (choice === 'cancel') return 'CANCELLED';
      if (choice === 'proceed') break;
    }
  }

  try {
    await ports.endSession();
    return 'SIGNED_OUT';
  } catch {
    return 'FAILED';
  }
}
