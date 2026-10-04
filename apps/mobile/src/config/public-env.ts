const CLERK_PUBLISHABLE_KEY_PATTERN = /^pk_(?:test|live)_[A-Za-z0-9_-]+$/;

export function parseClerkPublishableKey(value: string | undefined): string | null {
  const normalizedValue = value?.trim();

  if (!normalizedValue || !CLERK_PUBLISHABLE_KEY_PATTERN.test(normalizedValue)) {
    return null;
  }

  return normalizedValue;
}

export const clerkPublishableKey = parseClerkPublishableKey(
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

export const isClerkConfigured = clerkPublishableKey !== null;
