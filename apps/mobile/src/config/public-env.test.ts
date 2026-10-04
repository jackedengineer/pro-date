import { parseClerkPublishableKey } from './public-env';

describe('parseClerkPublishableKey', () => {
  it('accepts trimmed Clerk test and live publishable keys', () => {
    expect(parseClerkPublishableKey('  pk_test_example  ')).toBe('pk_test_example');
    expect(parseClerkPublishableKey('pk_live_example')).toBe('pk_live_example');
  });

  it.each([undefined, '', 'YOUR_PUBLISHABLE_KEY', 'sk_test_secret', 'pk_unknown_example'])(
    'rejects an absent or invalid public key: %s',
    (value) => {
      expect(parseClerkPublishableKey(value)).toBeNull();
    },
  );
});
