const CLERK_PUBLISHABLE_KEY_PATTERN = /^pk_(?:test|live)_[A-Za-z0-9_-]+$/;

export function parseApiBaseUrl(value: string | undefined): string | null {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return null;
  }

  try {
    const url = new URL(normalizedValue);
    const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
    const hasCredentials = url.username.length > 0 || url.password.length > 0;
    const hasUnexpectedSuffix =
      !/^\/*$/.test(url.pathname) || url.search.length > 0 || url.hash.length > 0;

    if (!isHttp || hasCredentials || hasUnexpectedSuffix) {
      return null;
    }

    return normalizedValue.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

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

export const apiBaseUrl = parseApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);

export const isClerkConfigured = clerkPublishableKey !== null;
