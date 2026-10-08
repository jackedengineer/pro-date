import type { Conversation } from '@pro-date/contracts';

export type ConversationTurn = 'YOUR_TURN' | 'THEIR_TURN';
export type MergedInboxRow =
  | { type: 'header'; key: ConversationTurn; turn: ConversationTurn; count: number }
  | { type: 'conversation'; key: string; turn: ConversationTurn; conversation: Conversation };

export function buildMergedInboxRows(
  conversations: readonly Conversation[],
  ownerId: string,
): MergedInboxRow[] {
  const unique = new Map<string, Conversation>();
  for (const conversation of conversations) {
    const current = unique.get(conversation.id);
    // An older overlapping cursor page must not move a newly replied thread back a turn.
    if (
      current === undefined ||
      (conversation.lastMessage?.sequence ?? 0) > (current.lastMessage?.sequence ?? 0)
    )
      unique.set(conversation.id, conversation);
  }
  // The API and device cache use fixed-width UTC timestamps; retain PostgreSQL microseconds.
  const ordered = [...unique.values()].sort(
    (left, right) =>
      right.activityAt.localeCompare(left.activityAt) || right.id.localeCompare(left.id),
  );
  const groups: Record<ConversationTurn, MergedInboxRow[]> = { YOUR_TURN: [], THEIR_TURN: [] };
  for (const conversation of ordered) {
    const turn =
      conversation.lastMessage === null || conversation.lastMessage.senderId !== ownerId
        ? 'YOUR_TURN'
        : 'THEIR_TURN';
    groups[turn].push({ type: 'conversation', key: conversation.id, turn, conversation });
  }
  return (['YOUR_TURN', 'THEIR_TURN'] as const).flatMap((turn) =>
    groups[turn].length === 0
      ? []
      : [{ type: 'header' as const, key: turn, turn, count: groups[turn].length }, ...groups[turn]],
  );
}
