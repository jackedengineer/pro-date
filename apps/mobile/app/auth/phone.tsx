import { router } from 'expo-router';
import { Alert } from 'react-native';

import { PhoneEntryScreen } from '../../src/features/auth/phone-entry-screen';

export default function PhoneRoute() {
  return (
    <PhoneEntryScreen
      onBack={() => router.back()}
      onContinue={() => {
        Alert.alert(
          'Phone number ready',
          'Live OTP delivery will be enabled in the Clerk authentication slice.',
        );
      }}
    />
  );
}
