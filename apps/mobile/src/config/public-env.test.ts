import { parseApiBaseUrl, parseClerkPublishableKey } from './public-env';

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

describe('parseApiBaseUrl', () => {
  it('accepts HTTP and HTTPS URLs and removes trailing slashes', () => {
    expect(parseApiBaseUrl(' http://192.168.0.100:3000/ ')).toBe('http://192.168.0.100:3000');
    expect(parseApiBaseUrl('https://api.prodate.example///')).toBe('https://api.prodate.example');
  });

  it.each([
    undefined,
    '',
    'YOUR_API_BASE_URL',
    'ftp://api.prodate.example',
    'https://user:password@api.prodate.example',
  ])('rejects an absent or unsafe API URL: %s', (value) => {
    expect(parseApiBaseUrl(value)).toBeNull();
  });
});
