import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';

import { createDatabaseResources } from '../src/client.js';
import { createDiscoveryRepository } from '../src/discovery-repository.js';
import {
  matches,
  profilePhotos,
  profilePromptAnswers,
  profileReports,
  profiles,
  users,
} from '../src/schema.js';

// Explicit development integration check. All fictional records are rolled back, including on failure.
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined)
  throw new Error('Configure the development DATABASE_URL before this check.');
const { database, pool } = createDatabaseResources(databaseUrl);
const rolledBack = new Error('Verification complete; roll back fictional fixtures.');
const ids: string[] = Array.from({ length: 8 }, () => randomUUID());
const [viewerId, firstId, secondId, incompatibleId, , , , declinedId] = ids as [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];
try {
  await database.transaction(async (transaction) => {
    const repository = createDiscoveryRepository(transaction);
    for (const [index, id] of ids.entries()) {
      await transaction.insert(users).values({
        id,
        clerkSubject: `integration-${id}`,
        onboardingStatus: 'COMPLETE',
        onboardingStep: 'COMPLETE',
      });
      await transaction.insert(profiles).values({
        userId: id,
        displayName: `Test ${index}`,
        birthDate: index === 5 ? '2015-01-01' : '1998-01-01',
        genderIdentity: index === 0 || index === 3 ? 'Man' : 'Woman',
        pronouns: 'ask me',
        interestedIn: index === 0 ? ['WOMEN'] : ['MEN'],
        relationshipIntent: 'LONG_TERM',
        location: index === 4 ? 'SRID=4326;POINT(0 0)' : 'SRID=4326;POINT(77.5946 12.9716)',
        locationLocality: 'Fixture City',
        heightCm: 175,
        isGenderVisible: false,
        arePronounsVisible: false,
        isHeightVisible: false,
        publishedAt: index === 6 ? null : new Date('2026-01-01T12:00:00.000Z'),
      });
      for (let position = 0; position < 4; position++)
        await transaction.insert(profilePhotos).values({
          userId: id,
          providerAssetId: `${id}-${position}`,
          providerPublicId: `pro-date/users/${id}/profile/${randomUUID()}`,
          providerVersion: 1,
          format: 'jpg',
          bytes: 1000,
          width: 1200,
          height: 1600,
          position,
        });
      for (const [position, promptId] of [
        'weekend_build',
        'debug_bad_day',
        'merge_criteria',
      ].entries())
        await transaction.insert(profilePromptAnswers).values({
          userId: id,
          promptId,
          position,
          answer: 'I enjoy building thoughtful products with kind people.',
        });
    }
    const query = { limit: 1, radiusKm: 50, minAge: 18, maxAge: 99 };
    const page = await repository.browse(viewerId, query, { ceiling: '2099-01-01T00:00:00.000Z' });
    assert.equal(page.length, 2, 'fetches one extra row for the next cursor');
    assert.equal(page[0]!.genderIdentity, null);
    assert.equal(page[0]!.heightCm, null);
    assert.equal(page[0]!.pronouns, null);
    assert.equal('birthDate' in page[0]!, false);
    const next = await repository.browse(viewerId, query, {
      ceiling: '2099-01-01T00:00:00.000Z',
      at: page[0]!.cursorAt,
      id: page[0]!.userId,
    });
    assert.ok(
      next.every((row) => row.userId !== page[0]!.userId),
      'keyset does not repeat first profile',
    );
    const all = await repository.browse(
      viewerId,
      { ...query, limit: 20 },
      { ceiling: '2099-01-01T00:00:00.000Z' },
    );
    const fixtureCandidates = all.filter((row) => ids.includes(row.userId));
    assert.deepEqual(
      new Set(fixtureCandidates.map((row) => row.userId)),
      new Set([firstId, secondId, declinedId]),
      'excludes self, incompatible, distant, underage, and unpublished members',
    );
    const prompt = (await repository.media([firstId])).prompts[0]!;
    const input = {
      recipientUserId: firstId,
      targetType: 'PROMPT' as const,
      targetId: prompt.id,
      comment: 'What would you build next?',
    };
    const sent = await repository.send(viewerId, input);
    await assert.rejects(
      repository.send(viewerId, {
        recipientUserId: secondId,
        targetType: 'PROMPT',
        targetId: prompt.id,
        comment: '',
      }),
      { name: 'DiscoveryError' },
      'an item owned by someone else cannot be targeted',
    );
    assert.deepEqual(
      await repository.send(viewerId, input),
      sent,
      'same intent replays its receipt',
    );
    await assert.rejects(repository.send(viewerId, { ...input, targetId: randomUUID() }), {
      name: 'DiscoveryError',
    });
    await assert.rejects(
      repository.respond(secondId, sent.id, 'MERGED'),
      { name: 'DiscoveryError' },
      'only recipient can respond',
    );
    await transaction
      .update(profilePromptAnswers)
      .set({ answer: 'This answer changed after the original like.' })
      .where(eq(profilePromptAnswers.id, prompt.id));
    const inbox = await repository.inbox(
      firstId,
      { limit: 10 },
      { ceiling: '2099-01-01T00:00:00.000Z' },
    );
    assert.equal(inbox[0]!.promptAnswer, prompt.answer, 'preserves originally liked answer');
    const merged = await repository.respond(firstId, sent.id, 'MERGED');
    assert.ok(merged.matchId);
    assert.deepEqual(await repository.respond(firstId, sent.id, 'MERGED'), merged);
    await assert.rejects(repository.respond(firstId, sent.id, 'DECLINED'), {
      name: 'DiscoveryError',
    });
    const persisted = await transaction
      .select()
      .from(matches)
      .where(eq(matches.id, merged.matchId));
    assert.equal(persisted.length, 1);
    assert.equal(
      (
        await repository.listMatches(
          viewerId,
          { limit: 10 },
          { ceiling: '2099-01-01T00:00:00.000Z' },
        )
      ).length,
      1,
    );
    const photo = (await repository.media([declinedId])).photos[0]!;
    const photoRequest = await repository.send(viewerId, {
      recipientUserId: declinedId,
      targetType: 'PHOTO',
      targetId: photo.id,
      comment: '',
    });
    assert.equal((await repository.respond(declinedId, photoRequest.id, 'DECLINED')).matchId, null);
    await repository.pass(viewerId, secondId);
    assert.ok(
      !(
        await repository.browse(
          viewerId,
          { ...query, limit: 20 },
          { ceiling: '2099-01-01T00:00:00.000Z' },
        )
      ).some((row) => row.userId === secondId),
    );
    await repository.report(viewerId, {
      userId: firstId,
      reason: 'SPAM',
      details: 'Integration fixture report.',
    });
    await repository.report(viewerId, {
      userId: firstId,
      reason: 'SPAM',
      details: 'Integration fixture report.',
    });
    assert.equal(
      (
        await transaction
          .select()
          .from(profileReports)
          .where(eq(profileReports.reporterUserId, viewerId))
      ).length,
      1,
    );
    assert.equal(
      (
        await repository.listMatches(
          viewerId,
          { limit: 10 },
          { ceiling: '2099-01-01T00:00:00.000Z' },
        )
      ).length,
      0,
    );
    assert.equal(
      (
        await repository.listMatches(
          firstId,
          { limit: 10 },
          { ceiling: '2099-01-01T00:00:00.000Z' },
        )
      ).length,
      0,
    );
    await assert.rejects(
      repository.send(viewerId, input),
      { name: 'DiscoveryError' },
      'blocking prevents replay/new interaction',
    );
    const photoProof = await transaction.execute(
      sql`select count(*)::int as count from profile_photos where user_id = ${incompatibleId}::uuid`,
    );
    assert.equal(photoProof.rows.length, 1);
    throw rolledBack;
  });
} catch (error) {
  if (error !== rolledBack) {
    console.error('Discovery database integration failed.', {
      errorType: error instanceof Error ? error.name : 'UnknownError',
      message:
        error instanceof assert.AssertionError
          ? error.message
          : 'Inspect the development database configuration and query checks.',
    });
    process.exitCode = 1;
  } else {
    console.log(
      'Discovery integration passed: PostGIS, keyset pages, visibility, item ownership, retries, recipient authorization, prompt snapshot, merge/decline, passes, bidirectional blocking, report persistence. All fictional fixtures rolled back.',
    );
  }
} finally {
  await pool.end();
}
