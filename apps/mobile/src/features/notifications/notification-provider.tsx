import { onlineManager } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';
import { useMessaging } from '../messaging/messaging-provider';
import { createSecureInstallationRegistration } from './installation-registration';
import { NotificationLifecycle, type NotificationStatus } from './notification-lifecycle';
import { notificationDevice } from './notification-device';
import { NotificationEvents } from './notification-events';

const pending = (): Promise<NotificationStatus> => Promise.resolve('SETUP_PENDING');
const fallback = {
  status: 'SETUP_PENDING' as NotificationStatus,
  enable: pending,
  beforeSignOut: () => Promise.resolve(false),
};
const Context = createContext(fallback);
export const useNotificationDevice = () => useContext(Context);
const subscribeNone = () => () => {};
const pendingSnapshot = () => 'SETUP_PENDING' as const;

export function NotificationProvider({ children }: PropsWithChildren) {
  const { runtime } = useMessaging();
  const lifecycle = useMemo(() => {
    if (runtime === null) return null;
    const currentOwner = () => (runtime.isCurrent() ? runtime.ownerId : null);
    return new NotificationLifecycle({
      ownerId: runtime.ownerId,
      currentOwner,
      settings: runtime.notifications.settings,
      device: notificationDevice,
      registration: createSecureInstallationRegistration({
        currentOwner,
        api: () => runtime.notificationDevices,
      }),
    });
  }, [runtime]);
  const status = useSyncExternalStore(
    lifecycle?.subscribe ?? subscribeNone,
    lifecycle?.getSnapshot ?? pendingSnapshot,
  );
  useEffect(() => {
    if (lifecycle === null) return;
    lifecycle.activate();
    let closed = false;
    const refresh = () => {
      if (!closed && AppState.currentState === 'active' && onlineManager.isOnline())
        void lifecycle.refresh();
    };
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const online = onlineManager.subscribe((connected) => {
      if (connected) refresh();
    });
    let removeToken = () => {};
    void notificationDevice
      .listenTokens((token) => {
        if (!closed && AppState.currentState === 'active' && onlineManager.isOnline())
          void lifecycle.refresh(token);
      })
      .then((remove) => {
        if (closed) remove();
        else removeToken = remove;
      })
      .catch(() => {});
    refresh();
    return () => {
      closed = true;
      lifecycle.dispose();
      app.remove();
      online();
      removeToken();
    };
  }, [lifecycle]);
  return (
    <Context.Provider
      value={{
        status,
        enable: lifecycle?.enable ?? pending,
        beforeSignOut:
          lifecycle === null ? fallback.beforeSignOut : () => lifecycle.beforeSignOut(),
      }}
    >
      <NotificationEvents />
      {children}
    </Context.Provider>
  );
}
