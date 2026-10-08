import { useLocalSearchParams } from 'expo-router';
import { z } from 'zod';
import { AppText } from '../../src/components/app-text';
import { Screen } from '../../src/components/screen';
import { ConversationScreen } from '../../src/features/messaging/conversation-screen';
import { MessagingGate } from '../../src/features/messaging/messaging-gate';
export default function ConversationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const parsed = z.uuid().safeParse(id);
  return parsed.success ? (
    <MessagingGate>
      <ConversationScreen id={parsed.data} />
    </MessagingGate>
  ) : (
    <Screen>
      <AppText>This conversation could not be found.</AppText>
    </Screen>
  );
}
