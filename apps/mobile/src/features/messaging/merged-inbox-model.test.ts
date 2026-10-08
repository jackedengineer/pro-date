import type { Conversation } from '@pro-date/contracts';
import { buildMergedInboxRows } from './merged-inbox-model';

const owner = '10000000-0000-4000-8000-000000000001';
const member = '10000000-0000-4000-8000-000000000002';
const untouched: Conversation = {
  id: '10000000-0000-4000-8000-000000000003',
  member: { userId: member, displayName: 'Avery', photoUrl: null },
  createdAt: '2026-10-08T00:00:00.000Z',
  activityAt: '2026-10-08T00:00:00.000Z',
  lastMessage: null,
};
function withMessage(senderId: string, sequence = 1): Conversation {
  return {
    ...untouched,
    activityAt: '2026-10-08T01:00:00.000Z',
    lastMessage: {
      id: owner,
      clientId: member,
      conversationId: untouched.id,
      senderId,
      sequence,
      body: 'What are you building outside work?',
      createdAt: '2026-10-08T01:00:00.000Z',
    },
  };
}
const entries = (conversations: Conversation[], viewer = owner) =>
  buildMergedInboxRows(conversations, viewer).filter((row) => row.type === 'conversation');

describe('Merged inbox turn rules', () => {
  it('preserves PostgreSQL microsecond activity order rather than rounding to milliseconds', () => {
    const older = { ...untouched, id: member, activityAt: '2026-10-08T01:00:00.123001Z' };
    const newer = { ...untouched, id: owner, activityAt: '2026-10-08T01:00:00.123999Z' };
    expect(entries([older, newer]).map((row) => row.conversation.id)).toEqual([owner, member]);
  });
  it('puts untouched matches in Your turn for both members', () => {
    expect(entries([untouched], owner)[0]?.turn).toBe('YOUR_TURN');
    expect(
      entries([{ ...untouched, member: { ...untouched.member, userId: owner } }], member)[0]?.turn,
    ).toBe('YOUR_TURN');
  });
  it('uses the latest confirmed sender, not message count or read status', () => {
    expect(entries([withMessage(member, 5)])[0]?.turn).toBe('YOUR_TURN');
    expect(entries([withMessage(owner, 6)])[0]?.turn).toBe('THEIR_TURN');
    expect(entries([withMessage(owner, 7)])[0]?.turn).toBe('THEIR_TURN');
    expect(entries([withMessage(member, 8)])[0]?.turn).toBe('YOUR_TURN');
  });
  it('orders Your turn first and sorts activity newest-first within each section', () => {
    const mine = { ...withMessage(owner), id: '10000000-0000-4000-8000-000000000004' };
    const reply = { ...withMessage(member), id: member };
    const rows = buildMergedInboxRows([mine, untouched, reply], owner);
    expect(rows.map((row) => (row.type === 'header' ? row.turn : row.conversation.id))).toEqual([
      'YOUR_TURN',
      member,
      untouched.id,
      'THEIR_TURN',
      mine.id,
    ]);
  });
  it('deduplicates overlapping pages using the highest persisted message sequence', () => {
    const stale = withMessage(member, 1);
    const latest = withMessage(owner, 2);
    expect(entries([latest, stale, untouched])).toHaveLength(1);
    expect(entries([latest, stale, untouched])[0]?.turn).toBe('THEIR_TURN');
    expect(entries([stale, latest])[0]?.conversation).toEqual(latest);
  });
  it('keeps conversation keys stable when a reply changes the section', () => {
    expect(entries([withMessage(owner)])[0]?.key).toBe(entries([withMessage(member)])[0]?.key);
  });
  it('omits empty sections and returns no artificial rows for an empty inbox', () => {
    expect(buildMergedInboxRows([], owner)).toEqual([]);
    expect(buildMergedInboxRows([untouched], owner).filter((row) => row.type === 'header')).toEqual(
      [{ type: 'header', key: 'YOUR_TURN', turn: 'YOUR_TURN', count: 1 }],
    );
  });
  it('does not mutate input order and uses a deterministic ID tie-break', () => {
    const first = { ...untouched, id: owner };
    const second = { ...untouched, id: member };
    const input = [first, second];
    expect(entries(input).map((row) => row.conversation.id)).toEqual([member, owner]);
    expect(input).toEqual([first, second]);
  });
});
