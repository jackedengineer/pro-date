import { router } from 'expo-router';

import { WelcomeScreen } from '../src/features/welcome/welcome-screen';

export default function WelcomeRoute() {
  return <WelcomeScreen onGetStarted={() => router.push('/auth/phone')} />;
}
