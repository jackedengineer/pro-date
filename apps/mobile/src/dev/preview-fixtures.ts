import type {
  Conversation,
  DiscoveryProfile,
  IncomingPullRequest,
  Message,
} from '@pro-date/contracts';

import type { DiscoveryActions } from '../api/discovery';
import type { ChatRow, ThreadSnapshot } from '../features/messaging/chat-thread';

/** Design-time data for `/preview`. Never bundled into a screen the app ships. */
export type PreviewData = 'demo' | 'worst';

const uuid = (n: number) => `10000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
export const previewOwnerId = uuid(1);
const photo = (seed: number, position: number) => ({
  id: uuid(1000 + seed * 10 + position),
  deliveryUrl: `https://i.pravatar.cc/900?img=${seed + position}`,
  width: 900,
  height: 900,
  position,
});

const LONG =
  'Honestly it depends on the week, the weather, whether the bakery on 12th Main still has the cardamom buns, and a truly unreasonable number of other variables I will happily explain at length over a second coffee if you let me, which you should.';

function profile(data: PreviewData, n: number): DiscoveryProfile {
  const worst = data === 'worst';
  const names = ['Aanya', 'Kabir', 'Meera', 'Dev'];
  return {
    userId: uuid(10 + n),
    displayName: worst
      ? ['Wolfeschlegelsteinhausenbergerdorff', 'X', 'Алекса́ндра Константи́новна', '李'][n % 4]!
      : names[n % 4]!,
    age: worst ? 104 : 27 + n,
    locationLabel: worst
      ? 'Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch, Wales · 12,480 km away'
      : 'Indiranagar, Bengaluru · 3 km away',
    genderIdentity: worst ? 'Genderqueer / non-conforming / still deciding' : 'Woman',
    pronouns: worst ? 'she/they/ze/hir' : 'she/her',
    heightCm: worst ? 251 : 168,
    relationshipIntent: worst ? 'LONG_TERM_OPEN_TO_SHORT' : 'LONG_TERM',
    photos: [0, 1, 2, 3].map((position) => photo(20 + n * 5, position)),
    prompts: [
      {
        id: uuid(200 + n),
        promptId: 'first_date_energy',
        answer: worst ? LONG : 'Long walk, good coffee, and nobody checking their phone.',
      },
      {
        id: uuid(210 + n),
        promptId: 'weekend_build',
        answer: worst ? 'x' : 'A bookshelf that finally fits the corner. Third attempt.',
      },
      {
        id: uuid(220 + n),
        promptId: 'debug_bad_day',
        answer: worst ? `${LONG} ${LONG}`.slice(0, 280) : 'Filter coffee, then a very long run.',
      },
    ],
  } as DiscoveryProfile;
}

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

function requests(data: PreviewData): IncomingPullRequest[] {
  const kabir = profile(data, 1);
  const meera = profile(data, 2);
  return [
    {
      id: uuid(300),
      sender: kabir,
      target: {
        type: 'PROMPT',
        id: uuid(301),
        promptId: 'meet_cute',
        answer: data === 'worst' ? LONG : 'Reaching for the same book at Blossom.',
      },
      comment: data === 'worst' ? LONG : 'Which book? This matters.',
      createdAt: hoursAgo(2),
    },
    {
      id: uuid(310),
      sender: meera,
      target: { type: 'PHOTO', id: uuid(311), deliveryUrl: 'https://i.pravatar.cc/900?img=12' },
      comment: '',
      createdAt: hoursAgo(30),
    },
  ] as IncomingPullRequest[];
}

export function previewActions(data: PreviewData, empty = false): DiscoveryActions {
  const never = () => new Promise<never>(() => {});
  return {
    browse: () =>
      Promise.resolve({
        data: empty ? [] : [profile(data, 0), profile(data, 3)],
        nextCursor: null,
      }),
    inbox: () => Promise.resolve({ data: empty ? [] : requests(data), nextCursor: null }),
    listMatches: () => Promise.resolve({ data: [], nextCursor: null }),
    send: never,
    respond: never,
    pass: () => Promise.resolve(),
    block: () => Promise.resolve(),
    report: () => Promise.resolve(),
  };
}

function message(n: number, mine: boolean, body: string, minutesAgo: number): Message {
  return {
    id: uuid(500 + n),
    conversationId: uuid(400),
    senderId: mine ? previewOwnerId : uuid(10),
    clientId: uuid(600 + n),
    sequence: n,
    body,
    createdAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  };
}

export function previewConversations(data: PreviewData): Conversation[] {
  const worst = data === 'worst';
  const member = (n: number, name: string, withPhoto = true) => ({
    userId: uuid(10 + n),
    displayName: worst && n === 0 ? 'Wolfeschlegelsteinhausenbergerdorff the Third' : name,
    photoUrl: withPhoto ? `https://i.pravatar.cc/300?img=${20 + n * 5}` : null,
  });
  return [
    {
      id: uuid(400),
      member: member(0, 'Aanya'),
      createdAt: hoursAgo(50),
      activityAt: hoursAgo(1),
      lastMessage: message(4, false, worst ? LONG : 'Third Wave, Indiranagar. Saturday?', 60),
    },
    {
      id: uuid(401),
      member: member(1, 'Kabir', false),
      createdAt: hoursAgo(20),
      activityAt: hoursAgo(20),
      lastMessage: null,
    },
    {
      id: uuid(402),
      member: member(2, 'Meera'),
      createdAt: hoursAgo(90),
      activityAt: hoursAgo(26),
      lastMessage: message(9, true, 'Okay, the trek is on. I’ll bring the snacks.', 1500),
    },
  ] as Conversation[];
}

export function previewThread(data: PreviewData, empty = false): ThreadSnapshot {
  const worst = data === 'worst';
  const row = (
    n: number,
    mine: boolean,
    body: string,
    minutesAgo: number,
    extra: Partial<ChatRow> = {},
  ): ChatRow => {
    const { id, sequence, ...rest } = message(n, mine, body, minutesAgo);
    return {
      ...rest,
      key: id,
      sequence,
      status: 'sent',
      failure: null,
      messageId: id,
      context: null,
      replyTo: null,
      reactionPending: false,
      reactionError: null,
      ...extra,
    };
  };
  const rows = empty
    ? []
    : [
        row(1, false, 'You liked my first-date answer. Bold.', 190),
        row(2, true, worst ? LONG : 'Guilty. Where’s the good coffee, then?', 180, {
          context: {
            messageId: uuid(502),
            revision: 1,
            replyTo: null,
            reactions: [{ userId: uuid(10), reaction: 'LAUGH', revision: 1 }],
          },
        }),
        row(3, false, 'Third Wave, Indiranagar. Saturday?', 60, {
          replyTo: {
            messageId: uuid(502),
            senderId: previewOwnerId,
            excerpt: 'Guilty. Where’s the good coffee, then?',
          },
        }),
        row(4, true, 'Saturday works. 11?', 58),
        row(
          5,
          true,
          worst ? 'https://example.com/' + 'a'.repeat(120) : 'I’ll find us a table.',
          2,
          {
            status: 'failed',
            failure: 'Merge couldn’t send this message. Tap Retry to try again.',
            sequence: null,
            messageId: null,
          },
        ),
      ];
  return {
    conversation: previewConversations(data)[0]!,
    rows,
    loading: false,
    loadingOlder: false,
    hasOlder: false,
    error: null,
    unavailable: false,
    online: true,
    capabilities: { replies: true, reactions: true },
    replyTo: null,
    contextError: null,
  };
}
