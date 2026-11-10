import { ClerkProvider } from '@clerk/expo';
import { resourceCache } from '@clerk/expo/resource-cache';
import { tokenCache } from '@clerk/expo/token-cache';
import type { PropsWithChildren } from 'react';

import { clerkPublishableKey } from '../config/public-env';

export function ClerkAuthProvider({ children }: PropsWithChildren) {
  if (clerkPublishableKey === null) {
    return <>{children}</>;
  }

  // The resource cache lets Clerk restore the signed-in session from secure storage when
  // the device starts offline; without it `isLoaded` waits for the network indefinitely.
  return (
    <ClerkProvider
      __experimental_resourceCache={resourceCache}
      prefetchUI={false}
      publishableKey={clerkPublishableKey}
      {...(tokenCache === undefined ? {} : { tokenCache })}
    >
      {children}
    </ClerkProvider>
  );
}
