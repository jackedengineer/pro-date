import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ClerkAuthProvider } from './clerk-auth-provider';

const mockProviderProps = jest.fn();
jest.mock('@clerk/expo', () => ({
  ClerkProvider: (props: { children: unknown }) => {
    mockProviderProps(props);
    return props.children;
  },
}));
jest.mock('@clerk/expo/resource-cache', () => ({ resourceCache: jest.fn() }));
jest.mock('@clerk/expo/token-cache', () => ({ tokenCache: { getToken: jest.fn() } }));
jest.mock('../config/public-env', () => ({ clerkPublishableKey: 'pk_test_example' }));

describe('ClerkAuthProvider', () => {
  it('restores sessions offline from the secure resource cache', async () => {
    const { resourceCache } = jest.requireMock<{ resourceCache: unknown }>(
      '@clerk/expo/resource-cache',
    );
    const screen = await render(
      <ClerkAuthProvider>
        <Text>App</Text>
      </ClerkAuthProvider>,
    );

    expect(screen.getByText('App')).toBeTruthy();
    expect(mockProviderProps).toHaveBeenCalledWith(
      expect.objectContaining({
        __experimental_resourceCache: resourceCache,
        publishableKey: 'pk_test_example',
        tokenCache: expect.objectContaining({
          getToken: expect.any(Function) as unknown,
        }) as unknown,
      }),
    );
  });
});
