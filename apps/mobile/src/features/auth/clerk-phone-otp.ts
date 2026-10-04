type ClerkOperationResult = Promise<{ error: unknown }>;

export interface ClerkSignInOtp {
  create: (params: { identifier: string; signUpIfMissing: true }) => ClerkOperationResult;
  finalize: () => ClerkOperationResult;
  phoneCode: {
    sendCode: (params?: { channel: 'sms' }) => ClerkOperationResult;
    verifyCode: (params: { code: string }) => ClerkOperationResult;
  };
  reset: () => ClerkOperationResult;
  readonly status: string | null;
}

export interface ClerkSignUpTransfer {
  create: (params: { transfer: true }) => ClerkOperationResult;
  finalize: () => ClerkOperationResult;
  readonly status: string | null;
}

type AuthAction = 'request' | 'verify';

const INDIAN_E164_PATTERN = /^\+91[6-9]\d{9}$/;

type AuthResult =
  | { ok: true }
  | { error: unknown; ok: false }
  | { kind: 'missing_requirements' | 'unsupported_state'; ok: false };

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isIndianE164PhoneNumber(value: unknown): value is string {
  return typeof value === 'string' && INDIAN_E164_PATTERN.test(value);
}

function getClerkErrorCode(error: unknown): string | null {
  if (!isUnknownRecord(error)) {
    return null;
  }

  const errors = error['errors'];

  if (!Array.isArray(errors) || errors.length === 0) {
    return null;
  }

  const firstError: unknown = errors[0];

  if (!isUnknownRecord(firstError)) {
    return null;
  }

  const code = firstError['code'];

  return typeof code === 'string' ? code : null;
}

export function getSafeAuthErrorMessage(error: unknown, action: AuthAction): string {
  switch (getClerkErrorCode(error)) {
    case 'form_code_incorrect':
    case 'form_code_pwned':
      return 'That code is not correct. Try again.';
    case 'verification_expired':
      return 'That code has expired. Send a new one.';
    case 'form_phone_number_invalid':
      return 'Enter a valid mobile number and try again.';
    case 'too_many_requests':
      return 'Too many attempts. Wait a moment and try again.';
    default:
      return action === 'request'
        ? 'We couldn’t send a code right now. Check your connection and try again.'
        : 'We couldn’t verify that code. Try again.';
  }
}

export async function requestPhoneCode(
  signIn: ClerkSignInOtp,
  phoneNumber: string,
): Promise<AuthResult> {
  try {
    const createResult = await signIn.create({
      identifier: phoneNumber,
      signUpIfMissing: true,
    });

    if (createResult.error !== null) {
      return { error: createResult.error, ok: false };
    }

    const sendResult = await signIn.phoneCode.sendCode({ channel: 'sms' });

    return sendResult.error === null ? { ok: true } : { error: sendResult.error, ok: false };
  } catch (error) {
    return { error, ok: false };
  }
}

export async function resendPhoneCode(signIn: ClerkSignInOtp): Promise<AuthResult> {
  try {
    const sendResult = await signIn.phoneCode.sendCode({ channel: 'sms' });

    return sendResult.error === null ? { ok: true } : { error: sendResult.error, ok: false };
  } catch (error) {
    return { error, ok: false };
  }
}

export async function verifyPhoneCode(
  signIn: ClerkSignInOtp,
  signUp: ClerkSignUpTransfer,
  code: string,
): Promise<AuthResult> {
  try {
    const verificationResult = await signIn.phoneCode.verifyCode({ code });

    if (getClerkErrorCode(verificationResult.error) === 'sign_up_if_missing_transfer') {
      const transferResult = await signUp.create({ transfer: true });

      if (transferResult.error !== null) {
        return { error: transferResult.error, ok: false };
      }

      if (signUp.status === 'missing_requirements') {
        return { kind: 'missing_requirements', ok: false };
      }

      if (signUp.status !== 'complete') {
        return { kind: 'unsupported_state', ok: false };
      }

      const finalizeResult = await signUp.finalize();

      return finalizeResult.error === null
        ? { ok: true }
        : { error: finalizeResult.error, ok: false };
    }

    if (verificationResult.error !== null) {
      return { error: verificationResult.error, ok: false };
    }

    if (signIn.status !== 'complete') {
      return { kind: 'unsupported_state', ok: false };
    }

    const finalizeResult = await signIn.finalize();

    return finalizeResult.error === null
      ? { ok: true }
      : { error: finalizeResult.error, ok: false };
  } catch (error) {
    return { error, ok: false };
  }
}
