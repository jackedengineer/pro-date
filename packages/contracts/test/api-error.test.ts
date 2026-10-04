import { describe, expect, it } from 'vitest';

import { apiErrorResponseSchema } from '../src/api-error.js';

describe('apiErrorResponseSchema', () => {
  it('accepts a safe machine-readable error', () => {
    const response = {
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
      },
      requestId: 'a537e843-0100-489f-9719-fc2123a53810',
    };

    expect(apiErrorResponseSchema.parse(response)).toEqual(response);
  });

  it('accepts bounded field validation details', () => {
    const response = {
      error: {
        code: 'VALIDATION_FAILED',
        details: [
          {
            code: 'invalid_format',
            message: 'Enter a valid phone number.',
            path: 'phoneNumber',
          },
        ],
        message: 'Check the highlighted fields.',
      },
      requestId: 'a537e843-0100-489f-9719-fc2123a53810',
    };

    expect(apiErrorResponseSchema.parse(response)).toEqual(response);
  });

  it.each([
    { field: 'code', value: 'not found' },
    { field: 'message', value: '' },
  ])('rejects an invalid error $field', ({ field, value }) => {
    const response = {
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
        [field]: value,
      },
      requestId: 'a537e843-0100-489f-9719-fc2123a53810',
    };

    expect(apiErrorResponseSchema.safeParse(response).success).toBe(false);
  });

  it('rejects internal diagnostics', () => {
    const response = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong.',
        stack: 'Error at database.ts:42',
      },
      requestId: 'a537e843-0100-489f-9719-fc2123a53810',
    };

    expect(apiErrorResponseSchema.safeParse(response).success).toBe(false);
  });
});
