import { router, usePathname } from 'expo-router';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import { useMessaging } from '../messaging/messaging-provider';
import { notificationDevice } from './notification-device';
import { createNotificationInteractions } from './notification-interactions';

/** SDK 57 synchronous initial-response APIs avoid deprecated async response helpers.
 * https://docs.expo.dev/versions/v57.0.0/sdk/notifications/#handle-push-notifications-with-navigation
 */
const loadEvents = () => import('expo-notifications');
type NotificationEventsSdk = Pick<
  typeof import('expo-notifications'),
  | 'setNotificationHandler'
  | 'DEFAULT_ACTION_IDENTIFIER'
  | 'clearLastNotificationResponse'
  | 'addNotificationResponseReceivedListener'
  | 'getLastNotificationResponse'
>;
export function NotificationEvents({
  load = loadEvents,
}: { load?: () => Promise<NotificationEventsSdk> } = {}) {
  const { runtime } = useMessaging();
  const pathname = usePathname();
  const state = useRef({ runtime, pathname });
  const controller = useRef<ReturnType<typeof createNotificationInteractions> | null>(null);
  useLayoutEffect(() => {
    state.current = { runtime, pathname };
    controller.current?.refresh();
  }, [runtime, pathname]);
  useEffect(() => {
    if (!notificationDevice.supported) return;
    const interactions = createNotificationInteractions({
      getRuntime: () => state.current.runtime,
      getActiveConversation: () =>
        state.current.pathname.startsWith('/messages/')
          ? state.current.pathname.slice('/messages/'.length)
          : null,
      isForeground: () => AppState.currentState === 'active',
      openConversation: (id) => router.push({ pathname: '/messages/[id]', params: { id } }),
      openInbox: () => {
        router.replace({ pathname: '/discover', params: { tab: 'merged' } });
        Alert.alert(
          'Connection unavailable',
          'We couldn’t open this connection. Open Merged and try again.',
        );
      },
    });
    controller.current = interactions;
    let closed = false;
    let cleanup = () => {};
    void load()
      .then((sdk) => {
        if (closed) return;
        // Expo allows only three seconds for this handler. Policy lookups abort at two seconds.
        sdk.setNotificationHandler({
          handleNotification: async (notification) => {
            const content = notification.request.content;
            const show =
              !closed &&
              content.title === 'ProDate' &&
              content.body === 'New message on ProDate.' &&
              (await interactions.foreground(content.data));
            return {
              shouldShowBanner: show,
              shouldShowList: show,
              shouldPlaySound: show,
              shouldSetBadge: false,
            };
          },
        });
        cleanup = () => sdk.setNotificationHandler(null);
        const receive = (response: import('expo-notifications').NotificationResponse) => {
          if (closed) return;
          if (response.actionIdentifier === sdk.DEFAULT_ACTION_IDENTIFIER)
            interactions.receive(response.notification.request.content.data);
          sdk.clearLastNotificationResponse();
        };
        const subscription = sdk.addNotificationResponseReceivedListener(receive);
        cleanup = () => {
          subscription.remove();
          sdk.setNotificationHandler(null);
        };
        const initial = sdk.getLastNotificationResponse();
        if (initial !== null) receive(initial);
      })
      .catch(() => {});
    return () => {
      closed = true;
      controller.current = null;
      interactions.dispose();
      cleanup();
    };
  }, [load]);
  return null;
}
