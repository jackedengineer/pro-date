import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { createDatabaseResources } from '../src/client.js';
import { createMessagingRepository } from '../src/messaging-repository.js';
import { matches, messageOutbox, messages, profiles, userBlocks, users } from '../src/schema.js';

// Fictional records and messages never survive this rollback-only development check.
const url = process.env.DATABASE_URL;
if (url === undefined) throw new Error('Configure development DATABASE_URL.');
const { database, pool } = createDatabaseResources(url);
const rollback = new Error('Intentional fixture rollback.');
try {
  await database.transaction(async (tx) => {
    const ids = [randomUUID(), randomUUID(), randomUUID()].sort();
    const [first, second, outsider] = ids as [string, string, string];
    for (const id of ids) {
      await tx.insert(users).values({
        id,
        clerkSubject: `messaging-fixture-${id}`,
        onboardingStatus: 'COMPLETE',
        onboardingStep: 'COMPLETE',
      });
      await tx.insert(profiles).values({ userId: id, displayName: 'Fictional builder' });
    }
    const [match] = await tx
      .insert(matches)
      .values({ firstUserId: first, secondUserId: second })
      .returning();
    assert.ok(match);
    const repository = createMessagingRepository(tx);
    await assert.rejects(repository.history(outsider, match.id, { limit: 50 }), {
      name: 'DiscoveryError',
    });
    await assert.rejects(
      repository.send(outsider, match.id, { clientId: randomUUID(), body: 'Unauthorized' }),
      { name: 'DiscoveryError' },
    );
    const input = { clientId: randomUUID(), body: 'Hello from a fictional builder.' };
    const one = await repository.send(first, match.id, input);
    assert.equal(one.sequence, 1);
    assert.equal((await repository.send(first, match.id, input)).id, one.id);
    await assert.rejects(repository.send(first, match.id, { ...input, body: 'Changed payload.' }), {
      name: 'DiscoveryError',
    });
    const two = await repository.send(second, match.id, {
      clientId: randomUUID(),
      body: 'A fictional response.',
    });
    assert.equal(two.sequence, 2);
    const history = await repository.history(first, match.id, { limit: 1 });
    assert.deepEqual(
      history.rows.map((row) => row.sequence),
      [2, 1],
    );
    assert.equal(history.latestSequence, 2);
    assert.deepEqual(
      (await repository.history(second, match.id, { limit: 50, afterSequence: 1 })).rows.map(
        (row) => row.sequence,
      ),
      [2],
    );
    assert.equal((await repository.conversation(second, match.id)).lastMessage?.id, two.id);
    assert.equal(
      (await repository.conversations(first, 20)).some((row) => row.id === match.id),
      true,
    );
    assert.equal(
      (await tx.select().from(messages).where(eq(messages.conversationId, match.id))).length,
      2,
    );
    assert.equal(
      (
        await tx
          .select()
          .from(messageOutbox)
          .where(sql`${messageOutbox.messageId} in (${one.id}::uuid, ${two.id}::uuid)`)
      ).length,
      2,
    );
    await tx.insert(userBlocks).values({ userId: second, blockedUserId: first });
    for (const id of [first, second]) {
      await assert.rejects(repository.history(id, match.id, { limit: 50 }), {
        name: 'DiscoveryError',
      });
      await assert.rejects(
        repository.send(id, match.id, { clientId: randomUUID(), body: 'Blocked' }),
        { name: 'DiscoveryError' },
      );
      assert.equal(await repository.canAccess(id, match.id), false);
    }
    await tx.delete(userBlocks).where(eq(userBlocks.userId, second));
    await repository.unmatch(first, match.id);
    await assert.rejects(repository.history(second, match.id, { limit: 50 }), {
      name: 'DiscoveryError',
    });
    console.log(
      'Messaging integration passed: membership, guarded retry, sequence/history, atomic outbox, block, unmatch; fixtures rolled back.',
    );
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
} finally {
  await pool.end();
}
