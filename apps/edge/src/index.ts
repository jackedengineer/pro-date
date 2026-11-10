import { DurableObject } from 'cloudflare:workers';

import {
  CONTAINER_PORT,
  configFingerprint,
  containerEnvironment,
  describeFailure,
  logEvent,
  readContainerSettings,
  toContainerRequest,
  unavailableResponse,
  withClientAddress,
} from './gateway';

const READY_TIMEOUT_MS = 45_000;
const HEALTH_INTERVAL_MS = 60_000;
const DRAIN_TIMEOUT_MS = 20_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function waitUntilHealthy(port: Fetcher, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await port.fetch('http://container/health/live', {
        signal: AbortSignal.timeout(2_000),
      });
      await response.body?.cancel();
      if (response.ok) return;
      lastError = new Error(`Health check returned ${response.status}`);
    } catch (error: unknown) {
      lastError = error;
    }
    await sleep(250);
  }
  throw new Error('The API container did not become healthy in time.', { cause: lastError });
}

/**
 * Owns the single API container. The API keeps Socket.IO rooms and its outbox dispatcher in
 * process memory, so exactly one instance runs, matching the app's one-replica design.
 */
export class ApiContainer extends DurableObject<Env> {
  private ready: Promise<void> | null = null;
  private generation = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const container = ctx.container;
    if (container?.running) {
      // A deploy restarts this object but not its container; resume supervising it.
      void ctx.blockConcurrencyWhile(async () => {
        await container.setInactivityTimeout(readContainerSettings(env).idleMs);
        this.watch(container);
      });
    }
  }

  override async fetch(request: Request): Promise<Response> {
    const container = this.ctx.container;
    if (container === undefined) return unavailableResponse();
    try {
      await this.ensureReady(container);
    } catch (error: unknown) {
      logEvent('api_container_unavailable', describeFailure(error));
      return unavailableResponse();
    }
    try {
      // Returned directly so WebSocket upgrades (Socket.IO) pass through intact.
      return await container.getTcpPort(CONTAINER_PORT).fetch(toContainerRequest(request));
    } catch (error: unknown) {
      this.ready = null;
      logEvent('api_container_request_failed', describeFailure(error));
      return unavailableResponse();
    }
  }

  /** always-on mode only: keeps the container warm and restarts it if it has stopped. */
  override async alarm(): Promise<void> {
    if (readContainerSettings(this.env).mode !== 'always-on') return;
    const container = this.ctx.container;
    try {
      if (container === undefined) return;
      await this.ensureReady(container);
      const response = await container
        .getTcpPort(CONTAINER_PORT)
        .fetch('http://container/health/ready', { signal: AbortSignal.timeout(5_000) });
      await response.body?.cancel();
      if (!response.ok) logEvent('api_container_degraded', { status: response.status });
    } catch (error: unknown) {
      logEvent('api_container_health_failed', describeFailure(error));
    } finally {
      await this.ctx.storage.setAlarm(Date.now() + HEALTH_INTERVAL_MS);
    }
  }

  private ensureReady(container: Container): Promise<void> {
    // Concurrent requests share one startup and readiness check.
    this.ready ??= this.start(container).catch((error: unknown) => {
      this.ready = null;
      throw error;
    });
    return this.ready;
  }

  private async start(container: Container): Promise<void> {
    const settings = readContainerSettings(this.env);
    const image = container.images.api;
    if (image === undefined) throw new Error('The api image is missing from this deployment.');
    const environment = containerEnvironment(this.env);
    const fingerprint = await configFingerprint(image, settings.instance, environment);

    if (container.running) {
      const current = (await container.inspect())?.labels.config;
      if (current !== fingerprint) {
        logEvent('api_container_rollout', { from: current ?? null, to: fingerprint });
        await this.drain(container);
      }
    }
    if (!container.running) {
      container.start({
        image,
        instance: settings.instance,
        // Neon, Clerk and Cloudinary are reached over the public internet.
        enableInternet: true,
        env: environment,
        labels: { config: fingerprint },
      });
      this.watch(container);
      logEvent('api_container_started', { instance: settings.instance, config: fingerprint });
    }
    await container.setInactivityTimeout(settings.idleMs);
    await waitUntilHealthy(container.getTcpPort(CONTAINER_PORT), READY_TIMEOUT_MS);
    if (settings.mode === 'always-on' && (await this.ctx.storage.getAlarm()) === null)
      await this.ctx.storage.setAlarm(Date.now() + HEALTH_INTERVAL_MS);
  }

  /** SIGTERM lets the API close sockets and its database pool before the replacement starts. */
  private async drain(container: Container): Promise<void> {
    container.signal(15);
    const deadline = Date.now() + DRAIN_TIMEOUT_MS;
    while (container.running && Date.now() < deadline) await sleep(250);
    if (container.running) await container.destroy();
  }

  private watch(container: Container): void {
    const generation = ++this.generation;
    container
      .monitor()
      .then(() => logEvent('api_container_exited'))
      .catch((error: unknown) => logEvent('api_container_crashed', describeFailure(error)))
      .finally(() => {
        // Only forget readiness for the container this watcher was attached to.
        if (generation === this.generation) this.ready = null;
      });
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    // Edge liveness, answered without waking the container (useful for uptime monitors).
    if (url.pathname === '/health/edge') return Response.json({ service: 'edge', status: 'ok' });

    // One named instance placed near the Neon database in Singapore. The hint applies when the
    // object is first created; later requests reach it wherever they enter Cloudflare.
    const api = env.API_CONTAINER.getByName('primary', { locationHint: 'apac-se' });
    return api.fetch(withClientAddress(request));
  },
} satisfies ExportedHandler<Env>;
