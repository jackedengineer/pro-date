const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const MAX_EMAIL_ADDRESS_LENGTH = 254;

export function normalizeEmailAddress(value: string): string {
  return value.trim();
}

export function isValidEmailAddress(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= MAX_EMAIL_ADDRESS_LENGTH &&
    EMAIL_ADDRESS_PATTERN.test(value)
  );
}

export function maskEmailAddress(emailAddress: string): string {
  const separatorIndex = emailAddress.lastIndexOf('@');

  if (separatorIndex <= 0 || separatorIndex === emailAddress.length - 1) {
    return '•••';
  }

  const localPart = emailAddress.slice(0, separatorIndex);
  const domain = emailAddress.slice(separatorIndex + 1);
  const visibleLocalPart =
    localPart.length === 1 ? `${localPart}•••` : `${localPart[0]}•••${localPart.at(-1)}`;

  return `${visibleLocalPart}@${domain}`;
}

export function maskIndianPhoneNumber(phoneNumber: string): string {
  return `+91 ••••• ••${phoneNumber.slice(-3)}`;
}
