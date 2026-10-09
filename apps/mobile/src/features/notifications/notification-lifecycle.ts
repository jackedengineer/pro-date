import type { DevicePushToken } from 'expo-notifications';
import type { NotificationsApi } from '../../api/notifications';
import type { createInstallationRegistration } from './installation-registration';
import type { NotificationDevice } from './notification-device';

export type NotificationStatus =
  'SETUP_PENDING' | 'PERMISSION_REQUIRED' | 'DENIED' | 'UNAVAILABLE' | 'CHECKING' | 'READY';
interface Ports {
  ownerId: string;
  currentOwner: () => string | null;
  settings: NotificationsApi['settings'];
  device: NotificationDevice;
  registration: ReturnType<typeof createInstallationRegistration>;
}

/** Independent of message sync: failures affect only this device's notification availability. */
export class NotificationLifecycle {
  private status: NotificationStatus = 'SETUP_PENDING';
  private listeners = new Set<() => void>();
  private flight: Promise<NotificationStatus> | null = null;
  private disposed = false;
  private suspended = false;
  private nativeToken: DevicePushToken | undefined;
  constructor(private readonly ports: Ports) {}
  getSnapshot = () => this.status;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private current = () =>
    !this.disposed && !this.suspended && this.ports.currentOwner() === this.ports.ownerId;
  private publish(status: NotificationStatus) {
    if (!this.current()) return;
    this.status = status;
    for (const listener of this.listeners) listener();
  }
  enable = () => this.run(true);
  refresh = (token?: DevicePushToken) => {
    if (token !== undefined) this.nativeToken = token;
    return this.run(false);
  };
  private run(explicit: boolean): Promise<NotificationStatus> {
    if (!this.current()) return Promise.resolve('UNAVAILABLE');
    if (this.flight !== null)
      return explicit ? this.flight.then(() => this.run(true)) : this.flight;
    const token = this.nativeToken;
    this.nativeToken = undefined;
    const work = this.check(explicit, token).finally(() => {
      this.flight = null;
      // A native rotation that arrived during an in-flight operation must not be lost.
      if (this.nativeToken !== undefined && this.current()) void this.run(false);
    });
    this.flight = work;
    return work;
  }
  private async check(explicit: boolean, token?: DevicePushToken): Promise<NotificationStatus> {
    this.publish('CHECKING');
    try {
      if (!this.ports.device.supported) {
        this.publish('SETUP_PENDING');
        return 'SETUP_PENDING';
      }
      const settings = await this.ports.settings();
      if (!this.current()) return 'UNAVAILABLE';
      if (!settings.isAvailable || !settings.isDeliveryReady) {
        this.publish('SETUP_PENDING');
        return 'SETUP_PENDING';
      }
      if (!explicit && !(await this.ports.registration.hasConsent(this.ports.ownerId))) {
        this.publish('PERMISSION_REQUIRED');
        return 'PERMISSION_REQUIRED';
      }
      if (!this.current()) return 'UNAVAILABLE';
      const result = await this.ports.device.prepare(explicit, this.current, token);
      if (!this.current()) return 'UNAVAILABLE';
      if (result.status !== 'READY') {
        if (result.status === 'DENIED' || result.status === 'PERMISSION_REQUIRED')
          await this.ports.registration.revoke(this.ports.ownerId);
        this.publish(result.status);
        return result.status;
      }
      const receipt = await this.ports.registration.register(
        this.ports.ownerId,
        result.registration,
      );
      if (!this.current()) return 'UNAVAILABLE';
      const status = receipt.isRegistered ? 'READY' : 'UNAVAILABLE';
      this.publish(status);
      return status;
    } catch {
      this.publish('UNAVAILABLE');
      return 'UNAVAILABLE';
    }
  }
  async beforeSignOut(): Promise<boolean> {
    this.suspended = true;
    this.status = 'UNAVAILABLE';
    for (const listener of this.listeners) listener();
    const revoke = async () => {
      await this.flight;
      if (this.disposed || this.ports.currentOwner() !== this.ports.ownerId) return false;
      try {
        const receipt = await this.ports.registration.revoke(this.ports.ownerId);
        return (
          !this.disposed &&
          this.ports.currentOwner() === this.ports.ownerId &&
          (receipt === null || !receipt.isRegistered)
        );
      } catch {
        return false;
      }
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        revoke(),
        new Promise<false>((resolve) => {
          timer = setTimeout(() => resolve(false), 3_000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  dispose() {
    this.disposed = true;
    this.listeners.clear();
  }
  // Strict Mode replays effects for the same runtime. Never clear sign-out suspension or
  // create another in-flight request; an actual account transition gets a new controller.
  activate() {
    this.disposed = false;
  }
}
