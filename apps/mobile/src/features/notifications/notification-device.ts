import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { DevicePushToken } from 'expo-notifications';
import { Platform } from 'react-native';
import {
  notificationDeviceRegisterSchema,
  type NotificationDeviceRegister,
} from '@pro-date/contracts';
import { z } from 'zod';

export type NativeNotifications = Pick<
  typeof import('expo-notifications'),
  | 'getPermissionsAsync'
  | 'requestPermissionsAsync'
  | 'setNotificationChannelAsync'
  | 'getExpoPushTokenAsync'
  | 'addPushTokenListener'
  | 'AndroidImportance'
  | 'AndroidNotificationVisibility'
  | 'IosAuthorizationStatus'
  | 'PermissionStatus'
>;
type Registration = Pick<NotificationDeviceRegister, 'token' | 'platform' | 'projectId'>;
export type DeviceResult =
  | { status: 'READY'; registration: Registration }
  | { status: 'SETUP_PENDING' | 'PERMISSION_REQUIRED' | 'DENIED' | 'UNAVAILABLE' };
const registrationSchema = notificationDeviceRegisterSchema.pick({
  token: true,
  platform: true,
  projectId: true,
});

export function createNotificationDevice(options: {
  platform: string;
  isExpoGo: boolean;
  projectId: unknown;
  load: () => Promise<NativeNotifications>;
}) {
  const project = z.uuid().safeParse(options.projectId);
  const supported =
    !options.isExpoGo &&
    (options.platform === 'ios' || options.platform === 'android') &&
    project.success;
  // Native token acquisition is not cancellable. Retain its slot after a UI deadline instead of
  // starting unbounded work on retries. The default adapter is shared across account remounts.
  let tokenWork: Promise<{ data: string }> | null = null;
  const assertCurrent = (current: () => boolean) => {
    if (!current()) throw new Error('Notification session changed. Reopen settings.');
  };
  return {
    supported,
    async prepare(
      this: void,
      requestPermission: boolean,
      current = () => true,
      nativeToken?: DevicePushToken,
    ): Promise<DeviceResult> {
      if (!supported || !project.success) return { status: 'SETUP_PENDING' };
      try {
        assertCurrent(current);
        const sdk = await options.load();
        assertCurrent(current);
        let permission = await sdk.getPermissionsAsync();
        assertCurrent(current);
        const allowed = () =>
          permission.granted || permission.ios?.status === sdk.IosAuthorizationStatus.PROVISIONAL;
        if (
          !allowed() &&
          (permission.status === sdk.PermissionStatus.DENIED || !permission.canAskAgain)
        )
          return { status: 'DENIED' };
        if (!allowed() && !requestPermission) return { status: 'PERMISSION_REQUIRED' };
        // Android 13 requires a channel before the permission dialog. No custom/background channel.
        // https://docs.expo.dev/versions/v57.0.0/sdk/notifications/#permissions
        if (options.platform === 'android') {
          await sdk.setNotificationChannelAsync('messages', {
            name: 'Selected chats',
            importance: sdk.AndroidImportance.DEFAULT,
            sound: 'default',
            lockscreenVisibility: sdk.AndroidNotificationVisibility.PRIVATE,
          });
          assertCurrent(current);
        }
        if (!allowed()) {
          permission = await sdk.requestPermissionsAsync({
            ios: { allowAlert: true, allowBadge: false, allowSound: true, allowProvisional: false },
          });
          assertCurrent(current);
          if (!allowed()) return { status: 'DENIED' };
        }
        if (tokenWork === null) {
          const work = sdk.getExpoPushTokenAsync({
            projectId: project.data,
            ...(nativeToken === undefined ? {} : { devicePushToken: nativeToken }),
          });
          tokenWork = work;
          void work.then(
            () => {
              if (tokenWork === work) tokenWork = null;
            },
            () => {
              if (tokenWork === work) tokenWork = null;
            },
          );
        }
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const token = await Promise.race([
            tokenWork,
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new Error('Token deadline')), 15_000);
            }),
          ]);
          assertCurrent(current);
          return {
            status: 'READY',
            registration: registrationSchema.parse({
              token: token.data,
              platform: options.platform,
              projectId: project.data,
            }),
          };
        } finally {
          clearTimeout(timer);
        }
      } catch {
        assertCurrent(current);
        // Native errors may contain provider responses/tokens. Never forward them to UI or logs.
        return { status: 'UNAVAILABLE' };
      }
    },
    async listenTokens(this: void, listener: (token: DevicePushToken) => void) {
      if (!supported) return () => {};
      const sdk = await options.load();
      const subscription = sdk.addPushTokenListener(listener);
      return () => subscription.remove();
    },
  };
}

let sdk: Promise<NativeNotifications> | undefined;
const projectSchema = z.object({ projectId: z.uuid() });
const eas = projectSchema.safeParse(Constants.easConfig);
const config = z
  .object({ extra: z.object({ eas: projectSchema }) })
  .safeParse(Constants.expoConfig);
export const notificationDevice = createNotificationDevice({
  platform: Platform.OS,
  isExpoGo: Constants.executionEnvironment === ExecutionEnvironment.StoreClient,
  projectId: eas.success
    ? eas.data.projectId
    : config.success
      ? config.data.extra.eas.projectId
      : null,
  // Do not evaluate expo-notifications in Expo Go: unsupported native APIs can warn on import.
  load: () => (sdk ??= import('expo-notifications')),
});
export type NotificationDevice = ReturnType<typeof createNotificationDevice>;
