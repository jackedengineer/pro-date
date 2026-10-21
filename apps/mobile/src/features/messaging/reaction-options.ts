import type { ReactionKind } from '@pro-date/contracts';
import type { ChatRow } from './chat-thread';
export const reactionOptions: readonly { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: 'HEART', emoji: '❤️', label: 'Heart' },
  { kind: 'LAUGH', emoji: '😂', label: 'Laugh' },
  { kind: 'LOVE', emoji: '🥰', label: 'Love' },
  { kind: 'FIRE', emoji: '🔥', label: 'Fire' },
  { kind: 'CLAP', emoji: '👏', label: 'Clap' },
  { kind: 'LIKE', emoji: '👍', label: 'Thumbs up' },
];

// Never mutate/persist MessageContext with speculative state or an invented revision.
export function displayedReactions(
  row: ChatRow,
  ownerId: string,
): readonly { userId: string; reaction: ReactionKind | null }[] {
  const saved = row.context?.reactions ?? [];
  if (row.pendingReaction === undefined) return saved;
  return [
    ...saved.filter((state) => state.userId !== ownerId),
    { userId: ownerId, reaction: row.pendingReaction },
  ];
}
