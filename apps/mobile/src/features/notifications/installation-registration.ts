import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';
import {
  notificationDeviceRegisterSchema,
  notificationDeviceRevokeSchema,
  notificationDeviceReceiptSchema,
  type NotificationDeviceReceipt,
} from '@pro-date/contracts';
import type { NotificationDevicesApi } from '../../api/notification-devices';

const key = 'prodate.notification-installation.v1';
const registrationSchema = notificationDeviceRegisterSchema.omit({
  bindingSecret: true,
  expectedVersion: true,
  operationId: true,
});
type Registration = z.infer<typeof registrationSchema>;
const pendingSchema = z.discriminatedUnion('action', [
  z.strictObject({
    action: z.literal('REGISTER'),
    ownerId: z.uuid(),
    input: notificationDeviceRegisterSchema,
  }),
  z.strictObject({
    action: z.literal('REVOKE'),
    ownerId: z.uuid(),
    input: notificationDeviceRevokeSchema,
  }),
]);
const stateSchema = z.strictObject({
  installationId: z.uuid(),
  bindingSecret: z.string().regex(/^[a-f0-9]{64}$/),
  version: z.number().int().min(0).max(2147483647),
  ownerId: z.uuid().nullable(),
  isRegistered: z.boolean(),
  acknowledgedAt: z.number().nonnegative(),
  registration: registrationSchema.nullable(),
  pending: pendingSchema.nullable(),
});
type State = z.infer<typeof stateSchema>;
interface Ports {
  read: () => Promise<string | null>;
  write: (value: string) => Promise<void>;
  uuid: () => string;
  randomBytes: () => Promise<Uint8Array>;
  currentOwner: () => string | null;
  api: (ownerId: string) => NotificationDevicesApi;
  now: () => number;
}
// Shared across provider remounts. An in-flight acknowledgement must settle before account transfer.
let operations: Promise<void> = Promise.resolve();
function serialized<T>(run: () => Promise<T>): Promise<T> {
  const result = operations.then(run);
  operations = result.then(
    () => {},
    () => {},
  );
  return result;
}

/** No OS permission/token collection here; the native lifecycle adapter supplies an explicitly consented token. */
export function createInstallationRegistration(ports: Ports) {
  const assertOwner = (ownerId: string) => {
    if (ports.currentOwner() !== ownerId)
      throw new Error('Notification session changed. Reopen settings in your current account.');
  };
  async function load(): Promise<State | null> {
    const saved = await ports.read();
    if (saved === null) return null;
    try {
      return stateSchema.parse(JSON.parse(saved));
    } catch {
      throw new Error(
        'Couldn’t read notification registration storage. No device changes were sent.',
      );
    }
  }
  const save = (state: State) => ports.write(JSON.stringify(stateSchema.parse(state)));
  async function settle(state: State, ownerId: string): Promise<State> {
    if (state.pending === null) return state;
    // An unknown outcome survives process death. Never retry it using a different account's credentials.
    if (state.pending.ownerId !== ownerId)
      throw new Error(
        'Confirm the pending notification change in your previous account before enabling this device.',
      );
    assertOwner(ownerId);
    const pending = state.pending;
    const api = ports.api(ownerId);
    const result = notificationDeviceReceiptSchema.parse(
      pending.action === 'REGISTER'
        ? await api.register(state.installationId, pending.input)
        : await api.revoke(state.installationId, pending.input),
    );
    if (
      result.installationId !== state.installationId ||
      result.version !== pending.input.expectedVersion + 1 ||
      (pending.action === 'REVOKE' && result.isRegistered)
    )
      throw new Error(
        'Couldn’t confirm this device registration version. Retry the same operation.',
      );
    const confirmed: State = {
      ...state,
      version: result.version,
      ownerId,
      pending: null,
      isRegistered: result.isRegistered,
      acknowledgedAt: ports.now(),
      registration:
        pending.action === 'REGISTER' && result.isRegistered
          ? {
              token: pending.input.token,
              platform: pending.input.platform,
              projectId: pending.input.projectId,
            }
          : null,
    };
    // Save even after an account switch so the next operation has the correct CAS version. Never publish late success to the old UI.
    await save(confirmed);
    assertOwner(ownerId);
    return confirmed;
  }
  const receipt = (state: State): NotificationDeviceReceipt => ({
    installationId: state.installationId,
    version: state.version,
    isRegistered: state.isRegistered,
  });
  return {
    register(ownerId: string, desired: Registration): Promise<NotificationDeviceReceipt> {
      return serialized(async () => {
        z.uuid().parse(ownerId);
        const registration = registrationSchema.parse(desired);
        assertOwner(ownerId);
        let state = await load();
        if (state === null) {
          const bytes = await ports.randomBytes();
          if (bytes.length !== 32)
            throw new Error('Couldn’t generate a secure notification binding.');
          state = {
            installationId: ports.uuid(),
            bindingSecret: Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(''),
            version: 0,
            ownerId: null,
            isRegistered: false,
            acknowledgedAt: 0,
            registration: null,
            pending: null,
          };
          await save(state);
        }
        state = await settle(state, ownerId);
        assertOwner(ownerId);
        if (
          state.ownerId === ownerId &&
          state.isRegistered &&
          state.registration !== null &&
          state.registration.token === registration.token &&
          state.registration.platform === registration.platform &&
          state.registration.projectId === registration.projectId &&
          ports.now() - state.acknowledgedAt < 86400000
        )
          return receipt(state);
        state.pending = {
          action: 'REGISTER',
          ownerId,
          input: notificationDeviceRegisterSchema.parse({
            ...registration,
            bindingSecret: state.bindingSecret,
            expectedVersion: state.version,
            operationId: ports.uuid(),
          }),
        };
        await save(state);
        return receipt(await settle(state, ownerId));
      });
    },
    revoke(ownerId: string): Promise<NotificationDeviceReceipt | null> {
      return serialized(async () => {
        z.uuid().parse(ownerId);
        assertOwner(ownerId);
        let state = await load();
        assertOwner(ownerId);
        if (state === null) return null;
        state = await settle(state, ownerId);
        assertOwner(ownerId);
        if (state.version === 0 || !state.isRegistered) return receipt(state);
        if (state.ownerId !== ownerId)
          throw new Error('This notification device belongs to another account.');
        state.pending = {
          action: 'REVOKE',
          ownerId,
          input: notificationDeviceRevokeSchema.parse({
            bindingSecret: state.bindingSecret,
            expectedVersion: state.version,
            operationId: ports.uuid(),
          }),
        };
        await save(state);
        return receipt(await settle(state, ownerId));
      });
    },
  };
}

/** Uses the existing SDK 57 SecureStore/Crypto packages. Sources:
 * https://docs.expo.dev/versions/latest/sdk/securestore/
 * https://docs.expo.dev/versions/latest/sdk/crypto/
 */
export function createSecureInstallationRegistration(options: Pick<Ports, 'currentOwner' | 'api'>) {
  return createInstallationRegistration({
    ...options,
    now: Date.now,
    uuid: Crypto.randomUUID,
    randomBytes: () => Crypto.getRandomBytesAsync(32),
    read: () => SecureStore.getItemAsync(key),
    write: (value) =>
      SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      }),
  });
}
