import type { ReactionKind } from '@pro-date/contracts';
export const reactionOptions: readonly { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: 'HEART', emoji: '❤️', label: 'Heart' },
  { kind: 'LAUGH', emoji: '😂', label: 'Laugh' },
  { kind: 'LOVE', emoji: '🥰', label: 'Love' },
  { kind: 'FIRE', emoji: '🔥', label: 'Fire' },
  { kind: 'CLAP', emoji: '👏', label: 'Clap' },
  { kind: 'LIKE', emoji: '👍', label: 'Thumbs up' },
];
