import {
  getSafeAuthErrorDiagnostic,
  getSafeAuthErrorMessage,
  isIndianE164PhoneNumber,
  requestEmailCode,
  requestPhoneCode,
  resendEmailCode,
  resendPhoneCode,
  verifyEmailCode,
  verifyPhoneCode,
} from './clerk-otp';

function clerkError(code: string): unknown {
  return { errors: [{ code }] };
}

describe('isIndianE164PhoneNumber', () => {
  it('accepts only normalized Indian mobile numbers', () => {
    expect(isIndianE164PhoneNumber('+919876543210')).toBe(true);
    expect(isIndianE164PhoneNumber('+911123456789')).toBe(false);
    expect(isIndianE164PhoneNumber('9876543210')).toBe(false);
    expect(isIndianE164PhoneNumber(undefined)).toBe(false);
  });
});

describe('requestPhoneCode', () => {
  it('requests a privacy-preserving sign-in-or-sign-up SMS code', async () => {
    const signIn = {
      create: jest.fn().mockResolvedValue({ error: null }),
      phoneCode: {
        sendCode: jest.fn().mockResolvedValue({ error: null }),
        verifyCode: jest.fn(),
      },
      status: 'needs_first_factor',
      finalize: jest.fn(),
      reset: jest.fn(),
    };

    await expect(requestPhoneCode(signIn, '+919876543210')).resolves.toEqual({ ok: true });
    expect(signIn.create).toHaveBeenCalledWith({
      identifier: '+919876543210',
      signUpIfMissing: true,
    });
    expect(signIn.phoneCode.sendCode).toHaveBeenCalledWith({ channel: 'sms' });
  });

  it('does not send an SMS when Clerk rejects the sign-in attempt', async () => {
    const error = clerkError('form_phone_number_invalid');
    const signIn = {
      create: jest.fn().mockResolvedValue({ error }),
      phoneCode: {
        sendCode: jest.fn(),
        verifyCode: jest.fn(),
      },
      status: null,
      finalize: jest.fn(),
      reset: jest.fn(),
    };

    await expect(requestPhoneCode(signIn, '+919876543210')).resolves.toEqual({
      error,
      ok: false,
    });
    expect(signIn.phoneCode.sendCode).not.toHaveBeenCalled();
  });
});

describe('requestEmailCode', () => {
  it('requests a privacy-preserving sign-in-or-sign-up email code', async () => {
    const signIn = {
      create: jest.fn().mockResolvedValue({ error: null }),
      emailCode: {
        sendCode: jest.fn().mockResolvedValue({ error: null }),
        verifyCode: jest.fn(),
      },
      status: 'needs_first_factor',
      finalize: jest.fn(),
      reset: jest.fn(),
    };

    await expect(requestEmailCode(signIn, 'priya@example.com')).resolves.toEqual({ ok: true });
    expect(signIn.create).toHaveBeenCalledWith({
      identifier: 'priya@example.com',
      signUpIfMissing: true,
    });
    expect(signIn.emailCode.sendCode).toHaveBeenCalledWith();
  });

  it('does not send an email when Clerk rejects the sign-in attempt', async () => {
    const error = clerkError('form_identifier_invalid');
    const signIn = {
      create: jest.fn().mockResolvedValue({ error }),
      emailCode: {
        sendCode: jest.fn(),
        verifyCode: jest.fn(),
      },
      status: null,
      finalize: jest.fn(),
      reset: jest.fn(),
    };

    await expect(requestEmailCode(signIn, 'priya@example.com')).resolves.toEqual({
      error,
      ok: false,
    });
    expect(signIn.emailCode.sendCode).not.toHaveBeenCalled();
  });
});

describe('resendPhoneCode', () => {
  it('reuses the active verification attempt instead of recreating the sign-in', async () => {
    const signIn = {
      create: jest.fn(),
      phoneCode: {
        sendCode: jest.fn().mockResolvedValue({ error: null }),
        verifyCode: jest.fn(),
      },
      status: 'needs_first_factor',
      finalize: jest.fn(),
      reset: jest.fn(),
    };

    await expect(resendPhoneCode(signIn)).resolves.toEqual({ ok: true });
    expect(signIn.phoneCode.sendCode).toHaveBeenCalledWith({ channel: 'sms' });
    expect(signIn.create).not.toHaveBeenCalled();
  });
});

describe('resendEmailCode', () => {
  it('reuses the active verification attempt instead of recreating the sign-in', async () => {
    const signIn = {
      create: jest.fn(),
      emailCode: {
        sendCode: jest.fn().mockResolvedValue({ error: null }),
        verifyCode: jest.fn(),
      },
      status: 'needs_first_factor',
      finalize: jest.fn(),
      reset: jest.fn(),
    };

    await expect(resendEmailCode(signIn)).resolves.toEqual({ ok: true });
    expect(signIn.emailCode.sendCode).toHaveBeenCalledWith();
    expect(signIn.create).not.toHaveBeenCalled();
  });
});

describe('verifyPhoneCode', () => {
  it('finalizes an existing user sign-in after successful verification', async () => {
    const signIn = {
      create: jest.fn(),
      phoneCode: {
        sendCode: jest.fn(),
        verifyCode: jest.fn().mockImplementation(() => {
          signIn.status = 'complete';
          return Promise.resolve({ error: null });
        }),
      },
      status: 'needs_first_factor',
      finalize: jest.fn().mockResolvedValue({ error: null }),
      reset: jest.fn(),
    };
    const signUp = {
      create: jest.fn(),
      finalize: jest.fn(),
      status: null,
    };

    await expect(verifyPhoneCode(signIn, signUp, '123456')).resolves.toEqual({ ok: true });
    expect(signIn.finalize).toHaveBeenCalledTimes(1);
    expect(signUp.create).not.toHaveBeenCalled();
  });

  it('transfers a verified unknown number to sign-up and finalizes its session', async () => {
    const transferRequired = { code: 'sign_up_if_missing_transfer' };
    const signIn = {
      create: jest.fn(),
      phoneCode: {
        sendCode: jest.fn(),
        verifyCode: jest.fn().mockResolvedValue({ error: transferRequired }),
      },
      status: 'needs_first_factor',
      finalize: jest.fn(),
      reset: jest.fn(),
    };
    const signUp = {
      create: jest.fn().mockImplementation(() => {
        signUp.status = 'complete';
        return Promise.resolve({ error: null });
      }),
      finalize: jest.fn().mockResolvedValue({ error: null }),
      status: 'missing_requirements',
    };

    await expect(verifyPhoneCode(signIn, signUp, '123456')).resolves.toEqual({ ok: true });
    expect(signUp.create).toHaveBeenCalledWith({ transfer: true });
    expect(signUp.finalize).toHaveBeenCalledTimes(1);
  });

  it('returns a recoverable state when Clerk requires account fields not owned by auth', async () => {
    const transferRequired = clerkError('sign_up_if_missing_transfer');
    const signIn = {
      create: jest.fn(),
      phoneCode: {
        sendCode: jest.fn(),
        verifyCode: jest.fn().mockResolvedValue({ error: transferRequired }),
      },
      status: 'needs_first_factor',
      finalize: jest.fn(),
      reset: jest.fn(),
    };
    const signUp = {
      create: jest.fn().mockResolvedValue({ error: null }),
      finalize: jest.fn(),
      status: 'missing_requirements',
    };

    await expect(verifyPhoneCode(signIn, signUp, '123456')).resolves.toEqual({
      kind: 'missing_requirements',
      ok: false,
    });
    expect(signUp.finalize).not.toHaveBeenCalled();
  });
});

describe('verifyEmailCode', () => {
  it('finalizes an existing user sign-in after successful verification', async () => {
    const signIn = {
      create: jest.fn(),
      emailCode: {
        sendCode: jest.fn(),
        verifyCode: jest.fn().mockImplementation(() => {
          signIn.status = 'complete';
          return Promise.resolve({ error: null });
        }),
      },
      status: 'needs_first_factor',
      finalize: jest.fn().mockResolvedValue({ error: null }),
      reset: jest.fn(),
    };
    const signUp = {
      create: jest.fn(),
      finalize: jest.fn(),
      status: null,
    };

    await expect(verifyEmailCode(signIn, signUp, '123456')).resolves.toEqual({ ok: true });
    expect(signIn.finalize).toHaveBeenCalledTimes(1);
    expect(signUp.create).not.toHaveBeenCalled();
  });

  it('transfers a verified unknown email to sign-up and finalizes its session', async () => {
    const signIn = {
      create: jest.fn(),
      emailCode: {
        sendCode: jest.fn(),
        verifyCode: jest.fn().mockResolvedValue({ error: { code: 'sign_up_if_missing_transfer' } }),
      },
      status: 'needs_first_factor',
      finalize: jest.fn(),
      reset: jest.fn(),
    };
    const signUp = {
      create: jest.fn().mockImplementation(() => {
        signUp.status = 'complete';
        return Promise.resolve({ error: null });
      }),
      finalize: jest.fn().mockResolvedValue({ error: null }),
      status: 'missing_requirements',
    };

    await expect(verifyEmailCode(signIn, signUp, '123456')).resolves.toEqual({ ok: true });
    expect(signUp.create).toHaveBeenCalledWith({ transfer: true });
    expect(signUp.finalize).toHaveBeenCalledTimes(1);
  });
});

describe('getSafeAuthErrorMessage', () => {
  it('maps known provider failures without exposing raw provider content', () => {
    expect(getSafeAuthErrorMessage(clerkError('form_code_incorrect'), 'verify')).toBe(
      'That code is not correct. Try again.',
    );
    expect(getSafeAuthErrorMessage(clerkError('verification_expired'), 'verify')).toBe(
      'That code has expired. Send a new one.',
    );
    expect(getSafeAuthErrorMessage(clerkError('too_many_requests'), 'request')).toBe(
      'Too many attempts. Wait a moment and try again.',
    );
    expect(
      getSafeAuthErrorMessage(clerkError('form_email_address_invalid'), 'request', 'email'),
    ).toBe('Enter a valid email address and try again.');
    expect(
      getSafeAuthErrorMessage(clerkError('dev_monthly_email_limit_exceeded'), 'request', 'email'),
    ).toBe('The development email limit has been reached. Use a Clerk test email instead.');
    expect(getSafeAuthErrorMessage(clerkError('verification_failed'), 'verify', 'email')).toBe(
      'Too many failed attempts. Send a new code and try again.',
    );
    expect(
      getSafeAuthErrorMessage(clerkError('verification_code_too_many_attempts'), 'verify', 'email'),
    ).toBe('Too many failed attempts. Wait a moment, then send a new code.');
    expect(
      getSafeAuthErrorMessage(clerkError('verification_code_not_sent'), 'verify', 'email'),
    ).toBe('That code was not issued. Send a new code and try again.');
    expect(
      getSafeAuthErrorMessage(
        clerkError('verification_code_too_many_requests'),
        'request',
        'email',
      ),
    ).toBe('Too many code requests. Wait a moment and try again.');
  });

  it('uses action-specific fallback copy for unknown errors', () => {
    expect(getSafeAuthErrorMessage(new Error('private provider detail'), 'request')).toBe(
      'We couldn’t send a code right now. Check your connection and try again.',
    );
    expect(getSafeAuthErrorMessage(new Error('private provider detail'), 'verify')).toBe(
      'We couldn’t verify that code. Try again.',
    );
  });
});

describe('getSafeAuthErrorDiagnostic', () => {
  it('returns only non-sensitive provider metadata for development diagnostics', () => {
    expect(
      getSafeAuthErrorDiagnostic({
        errors: [
          {
            code: 'verification_failed',
            longMessage: 'private provider detail',
            message: 'private provider detail',
          },
        ],
        message: 'private response detail',
        name: 'ClerkAPIResponseError',
        status: 400,
      }),
    ).toEqual({
      code: 'verification_failed',
      name: 'ClerkAPIResponseError',
      status: 400,
    });
  });

  it('uses neutral placeholders when an error has no safe provider metadata', () => {
    expect(getSafeAuthErrorDiagnostic(new Error('private provider detail'))).toEqual({
      code: 'unclassified',
      name: 'Error',
      status: null,
    });
  });
});
