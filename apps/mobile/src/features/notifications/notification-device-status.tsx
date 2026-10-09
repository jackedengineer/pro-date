import { useState } from 'react';
import { Linking, View } from 'react-native';
import { AppText } from '../../components/app-text';
import { ErrorNotice, QuietButton, sharedStyles } from '../discovery/discovery-shared';
import { useNotificationDevice } from './notification-provider';

export function NotificationDeviceStatus({ canEnable }: { canEnable: boolean }) {
  const device = useNotificationDevice();
  const [error, setError] = useState<string | null>(null);
  const text = {
    SETUP_PENDING: 'This device needs a development build and push setup. Messaging still works.',
    PERMISSION_REQUIRED: 'Choose a chat to enable private alerts on this device.',
    CHECKING: 'Checking this device’s notification setup…',
    READY:
      'This device is registered for selected-chat alerts. Account pause and OS settings still apply.',
    DENIED:
      'Notifications are off in your device settings. Chat preferences apply to your other devices.',
    UNAVAILABLE: 'Couldn’t confirm alerts on this device. Your messages are unaffected.',
  }[device.status];
  return (
    <View style={sharedStyles.stack}>
      <AppText variant="caption" accessibilityLiveRegion="polite">
        {text}
      </AppText>
      {device.status === 'DENIED' ? (
        <QuietButton
          label="Open device notification settings"
          onPress={() => {
            void Linking.openSettings().catch(() =>
              setError('Couldn’t open device settings. Open them from your home screen.'),
            );
          }}
        />
      ) : canEnable &&
        (device.status === 'PERMISSION_REQUIRED' || device.status === 'UNAVAILABLE') ? (
        <QuietButton
          label="Enable alerts on this device"
          onPress={() => {
            void device.enable();
          }}
        />
      ) : null}
      <ErrorNotice message={error} />
    </View>
  );
}
