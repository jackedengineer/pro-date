import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import type { PropsWithChildren } from 'react';

import { clerkPublishableKey } from '../config/public-env';

export function ClerkAuthProvider({ children }: PropsWithChildren) {
  if (clerkPublishableKey === null) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      prefetchUI={false}
      publishableKey={clerkPublishableKey}
      {...(tokenCache === undefined ? {} : { tokenCache })}
    >
      {children}
    </ClerkProvider>
  );
}
