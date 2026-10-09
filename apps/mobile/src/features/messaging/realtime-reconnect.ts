import { realtimeAdmissionErrorSchema } from '@pro-date/contracts';

interface Options {
  connect: () => void;
  disconnect: () => void;
  random?: () => number;
}
// Socket.IO owns transport failures; this policy owns only namespace admission/expiry retries.
export class RealtimeReconnect {
  private available = false;
  private disposed = false;
  private failures = 0;
  private halted = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(private options: Options) {}
  setAvailable(value: boolean) {
    if (this.disposed || value === this.available) return;
    this.available = value;
    this.cancel();
    if (!value) {
      this.options.disconnect();
      return;
    }
    this.failures = 0;
    this.halted = false;
    this.options.connect();
  }
  connected() {
    this.cancel();
    this.failures = 0;
    this.halted = false;
  }
  rejected(error: unknown, transportWillRetry: boolean) {
    if (transportWillRetry) return;
    const data =
      typeof error === 'object' && error !== null && 'data' in error ? error.data : undefined;
    const parsed = realtimeAdmissionErrorSchema.safeParse(data);
    if (!parsed.success || parsed.data.code === 'AUTH_REQUIRED') {
      this.cancel();
      this.halted = true;
      return;
    }
    this.retry(parsed.data.retryAfterMs ?? 0);
  }
  expired() {
    this.retry(0);
  }
  dispose() {
    this.disposed = true;
    this.available = false;
    this.cancel();
  }
  private retry(retryAfterMs: number) {
    this.cancel();
    if (!this.available || this.disposed || this.halted) return;
    this.failures += 1;
    if (this.failures >= 8) {
      this.halted = true;
      return;
    }
    const base = Math.min(30_000, 1000 * 2 ** (this.failures - 1));
    const delay = Math.max(
      retryAfterMs,
      Math.round(base * (0.5 + (this.options.random ?? Math.random)() * 0.5)),
    );
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (this.available && !this.disposed && !this.halted) this.options.connect();
    }, delay);
  }
  private cancel() {
    clearTimeout(this.timer);
    this.timer = undefined;
  }
}
