import {
  isValidEmailAddress,
  maskEmailAddress,
  maskIndianPhoneNumber,
  normalizeEmailAddress,
} from './auth-identifiers';

describe('email address helpers', () => {
  it('trims a valid email address without changing its identity', () => {
    expect(normalizeEmailAddress('  Priya+date@example.com  ')).toBe('Priya+date@example.com');
    expect(isValidEmailAddress('Priya+date@example.com')).toBe(true);
  });

  it('rejects malformed or excessively long email addresses', () => {
    expect(isValidEmailAddress('priya@example')).toBe(false);
    expect(isValidEmailAddress('priya @example.com')).toBe(false);
    expect(isValidEmailAddress(`p@${'a'.repeat(250)}.com`)).toBe(false);
  });

  it('masks the local part while retaining enough context to identify the inbox', () => {
    expect(maskEmailAddress('priya@example.com')).toBe('p•••a@example.com');
    expect(maskEmailAddress('a@example.com')).toBe('a•••@example.com');
  });
});

describe('phone number helpers', () => {
  it('masks an Indian mobile number except for its country code and final digits', () => {
    expect(maskIndianPhoneNumber('+919876543210')).toBe('+91 ••••• ••210');
  });
});
