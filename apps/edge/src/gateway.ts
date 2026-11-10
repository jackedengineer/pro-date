// Pure gateway logic, free of `cloudflare:*` imports so it runs under plain Vitest.

export const CONTAINER_PORT = 8080;
/** Overwritten on every request at the edge; the API trusts it only behind this gateway. */
export const CLIENT_IP_HEADER = 'x-merge-client-ip';

const instanceTypes = ['lite', 'standard-1', 'standard-2', 'standard-3', 'standard-4'] as const;
export type InstanceType = (typeof instanceTypes)[number];
export type ContainerMode = 'on-demand' | 'always-on';

export interface ContainerSettings {
  mode: ContainerMode;
  instance: InstanceType;
  idleMs: number;
}

export interface GatewayEnv {
  CONTAINER_MODE: string;
  CONTAINER_INSTANCE: string;
  CONTAINER_IDLE_MINUTES: string;
  API_LOG_LEVEL: string;
  CHAT_REPLIES_ENABLED: string;
  CHAT_REACTIONS_ENABLED: string;
  NOTIFICATIONS_ENABLED: string;
  PUSH_ENABLED: string;
  CLERK_PUBLISHABLE_KEY: string;
  CLERK_SECRET_KEY: string;
  DATABASE_URL: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
}

/** Fails closed on a misconfigured deploy instead of starting an unintended instance size. */
export function readContainerSettings(env: GatewayEnv): ContainerSettings {
  const mode = env.CONTAINER_MODE;
  if (mode !== 'on-demand' && mode !== 'always-on')
    throw new Error('CONTAINER_MODE must be on-demand or always-on.');
  const instance = instanceTypes.find((type) => type === env.CONTAINER_INSTANCE);
  if (instance === undefined)
    throw new Error(`CONTAINER_INSTANCE must be one of ${instanceTypes.join(', ')}.`);
  const minutes = Number(env.CONTAINER_IDLE_MINUTES);
  // The platform accepts an inactivity timeout of at most six hours.
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 360)
    throw new Error('CONTAINER_IDLE_MINUTES must be a whole number from 1 to 360.');
  return { mode, instance, idleMs: minutes * 60_000 };
}

/** The API process environment. Secrets travel only in memory, at container start. */
export function containerEnvironment(env: GatewayEnv): Record<string, string> {
  return {
    NODE_ENV: 'production',
    HOST: '0.0.0.0',
    PORT: String(CONTAINER_PORT),
    LOG_LEVEL: env.API_LOG_LEVEL,
    TRUSTED_CLIENT_IP_HEADER: CLIENT_IP_HEADER,
    CLERK_TELEMETRY_DISABLED: '1',
    CHAT_REPLIES_ENABLED: env.CHAT_REPLIES_ENABLED,
    CHAT_REACTIONS_ENABLED: env.CHAT_REACTIONS_ENABLED,
    NOTIFICATIONS_ENABLED: env.NOTIFICATIONS_ENABLED,
    PUSH_ENABLED: env.PUSH_ENABLED,
    CLERK_PUBLISHABLE_KEY: env.CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: env.CLERK_SECRET_KEY,
    DATABASE_URL: env.DATABASE_URL,
    CLOUDINARY_CLOUD_NAME: env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: env.CLOUDINARY_API_SECRET,
  };
}

/**
 * Identifies what a running container was started with. Durable Object-managed containers keep
 * running across deploys, so a changed image, size, variable or rotated secret must replace it.
 * Only this one-way hash is stored on the container label; secret values never are.
 */
export async function configFingerprint(
  image: string,
  instance: InstanceType,
  environment: Record<string, string>,
): Promise<string> {
  const material = JSON.stringify([
    image,
    instance,
    Object.entries(environment).sort(([a], [b]) => (a < b ? -1 : 1)),
  ]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material));
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Replaces any client-supplied copy of the trusted header with the address Cloudflare observed.
 * Without it every socket would share the gateway's address and one client could exhaust the
 * API's per-peer realtime budget for everyone.
 */
export function withClientAddress(request: Request): Request {
  const forwarded = new Request(request);
  forwarded.headers.delete(CLIENT_IP_HEADER);
  const address = request.headers.get('cf-connecting-ip');
  if (address !== null) forwarded.headers.set(CLIENT_IP_HEADER, address);
  return forwarded;
}

/** Targets the container port while keeping method, headers, body and WebSocket upgrade. */
export function toContainerRequest(request: Request): Request {
  const url = new URL(request.url);
  url.protocol = 'http:';
  url.host = 'container';
  const forwarded = new Request(url, request);
  forwarded.headers.delete('host');
  return forwarded;
}

/** Matches the API's error contract so the app's retry logic treats it as a transient 503. */
export function unavailableResponse(): Response {
  return Response.json(
    {
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Merge is starting up. Try again in a moment.',
      },
      requestId: crypto.randomUUID(),
    },
    { status: 503, headers: { 'cache-control': 'no-store', 'retry-after': '5' } },
  );
}

export function logEvent(event: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ event, ...fields }));
}

/** Platform error text only; requests and secrets are never passed in here. */
export function describeFailure(error: unknown): { errorType: string; errorMessage: string } {
  return error instanceof Error
    ? { errorType: error.name, errorMessage: error.message.slice(0, 300) }
    : { errorType: typeof error, errorMessage: '' };
}
