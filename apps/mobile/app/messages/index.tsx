import { MessagingGate } from '../../src/features/messaging/messaging-gate';
import { MessagingInbox } from '../../src/features/messaging/messaging-inbox';
export default function MessagesRoute() {
  return (
    <MessagingGate>
      <MessagingInbox />
    </MessagingGate>
  );
}
