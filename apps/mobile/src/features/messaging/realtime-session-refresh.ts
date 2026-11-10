import { realtimeAuthRefreshAckSchema } from '@pro-date/contracts';

/** Reads a JWT's `exp` claim without verifying it; the server remains the authority. */
export function tokenExpiresAt(token: string): number | null {
  const payload = token.split('.')[1];
  if (payload === undefined || payload.length === 0) return null;
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(
      atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')),
    ) as unknown;
    const exp =
      typeof claims === 'object' && claims !== null && 'exp' in claims ? claims.exp : undefined;
    return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : null;
  } catch {
    return null;
  }
}

interface Options {
  /** A newly minted session token, or null once the session has ended. */
  getFreshToken: () => Promise<string | null>;
  /** Sends the token over the socket and resolves with the server's acknowledgement. */
  send: (token: string) => Promise<unknown>;
  now?: () => number;
  /** How long before expiry to refresh. */
  leadMs?: number;
  /** Used when the current expiry is unknown. */
  fallbackMs?: number;
  /** Floor between attempts, so a failing refresh can never spin. */
  minDelayMs?: number;
}

/**
 * Keeps one connected socket's session alive. The API closes a socket when its token expires;
 * refreshing first avoids a reconnect, and the inbox refetch that follows it, every minute.
 * If a refresh fails, the socket closes at expiry and the normal reconnect path takes over.
 */
export class RealtimeSessionRefresher {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;
  private expiresAt: number | null = null;
  private readonly now: () => number;
  private readonly leadMs: number;
  private readonly fallbackMs: number;
  private readonly minDelayMs: number;

  constructor(private readonly options: Options) {
    this.now = options.now ?? Date.now;
    this.leadMs = options.leadMs ?? 20_000;
    this.fallbackMs = options.fallbackMs ?? 30_000;
    this.minDelayMs = options.minDelayMs ?? 5000;
  }

  /** Call on every connect with the expiry of the token the handshake used. */
  start(expiresAt: number | null) {
    this.stop();
    this.expiresAt = expiresAt;
    this.schedule();
  }

  stop() {
    this.generation += 1;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private schedule() {
    const delay =
      this.expiresAt === null
        ? this.fallbackMs
        : Math.max(this.minDelayMs, this.expiresAt - this.leadMs - this.now());
    const generation = this.generation;
    this.timer = setTimeout(() => void this.refresh(generation), delay);
  }

  private async refresh(generation: number) {
    this.timer = undefined;
    try {
      const token = await this.options.getFreshToken();
      if (generation !== this.generation || token === null) return;
      const ack = realtimeAuthRefreshAckSchema.safeParse(await this.options.send(token));
      if (generation !== this.generation) return;
      if (ack.success) {
        if (ack.data.ok) {
          this.expiresAt = ack.data.expiresAt;
          this.schedule();
          return;
        }
        // The server rejected this session; let the socket close and reconnect normally.
        if (ack.data.code === 'AUTH_REQUIRED') return;
      }
    } catch {
      if (generation !== this.generation) return;
    }
    // A transient failure: try again while the current token still has time left.
    if (this.expiresAt === null || this.expiresAt - this.now() > this.minDelayMs) this.schedule();
  }
}
