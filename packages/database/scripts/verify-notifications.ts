import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { createDatabaseResources } from '../src/client.js';
import { createMessagingRepository } from '../src/messaging-repository.js';
import { createNotificationDeviceRepository } from '../src/notification-device-repository.js';
import { createNotificationJobRepository } from '../src/notification-job-repository.js';
import { createNotificationPreferencesRepository } from '../src/notification-preferences-repository.js';
import { createNotificationReceiptRepository } from '../src/notification-receipt-repository.js';
import { matches, profiles, users } from '../src/schema.js';

// Deliberately never reads DATABASE_URL or loads apps/api/.env. Use only an explicitly
// approved, migrated, isolated test database. No provider call; all fixture writes roll back.
const url = process.env.NOTIFICATION_TEST_DATABASE_URL;
if (!url || process.env.CONFIRM_NOTIFICATION_TEST_DATABASE !== 'true') {
  throw new Error(
    'Provide an isolated NOTIFICATION_TEST_DATABASE_URL and explicit test confirmation.',
  );
}
const { database, pool } = createDatabaseResources(url);
const rollback = new Error('Intentional notification fixture rollback.');
try {
  await database.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('lock_timeout', '3s', true), set_config('statement_timeout', '10s', true)`,
    );
    const existing = await tx.execute(sql`select id from message_notification_jobs limit 1`);
    assert.equal(
      existing.rows.length,
      0,
      'Use an isolated database with no existing notification jobs.',
    );
    const [sender, recipient] = [randomUUID(), randomUUID()].sort() as [string, string];
    const project = randomUUID();
    const device = randomUUID();
    for (const id of [sender, recipient]) {
      await tx.insert(users).values({
        id,
        clerkSubject: `notification-fixture-${id}`,
        onboardingStatus: 'COMPLETE',
        onboardingStep: 'COMPLETE',
      });
      await tx.insert(profiles).values({ userId: id, displayName: 'Fictional builder' });
    }
    const [match] = await tx
      .insert(matches)
      .values({ firstUserId: sender, secondUserId: recipient })
      .returning();
    assert.ok(match);
    await createNotificationDeviceRepository(tx).register(recipient, device, {
      expectedVersion: 0,
      operationId: randomUUID(),
      bindingSecret: 'a'.repeat(64),
      token: `ExpoPushToken[fixture-${device}]`,
      platform: 'android',
      projectId: project,
    });
    const preferences = createNotificationPreferencesRepository(tx);
    const messaging = createMessagingRepository(tx, {
      notificationsEnabled: true,
      expoProjectId: project,
    });
    const jobs = createNotificationJobRepository(tx, project);
    const receipts = createNotificationReceiptRepository(tx);
    const input = { clientId: randomUUID(), body: 'A fictional notification integration message.' };

    // Silent chats never enqueue. Enabling later does not replay the earlier message.
    await messaging.send(sender, match.id, { ...input, clientId: randomUUID() });
    assert.equal((await tx.execute(sql`select id from message_notification_jobs`)).rows.length, 0);
    await preferences.saveConversation(recipient, match.id, true);
    const message = await messaging.send(sender, match.id, input);
    assert.equal((await messaging.send(sender, match.id, input)).id, message.id);
    assert.equal((await tx.execute(sql`select id from message_notification_jobs`)).rows.length, 1);
    const innerRollback = new Error('Rollback atomic message and job.');
    await assert.rejects(
      tx.transaction(async (inner) => {
        await createMessagingRepository(inner, {
          notificationsEnabled: true,
          expoProjectId: project,
        }).send(sender, match.id, { ...input, clientId: randomUUID() });
        throw innerRollback;
      }),
      (error: unknown) => error === innerRollback,
    );
    assert.equal((await tx.execute(sql`select id from message_notification_jobs`)).rows.length, 1);
    assert.equal(
      (await tx.execute(sql`select id from messages where conversation_id = ${match.id}::uuid`))
        .rows.length,
      2,
    );

    // Crash recovery, old-claim fencing, and accepted receipts after an unknown handoff.
    const [claim] = await jobs.claim();
    assert.ok(claim);
    const firstAttempt = await jobs.prepare(claim);
    assert.ok(firstAttempt);
    assert.equal(await jobs.authorize(firstAttempt), true);
    await tx.execute(
      sql`update message_notification_jobs set leased_until = clock_timestamp() - interval '1 second' where id = ${claim.id}::uuid`,
    );
    const [replacement] = await jobs.claim();
    assert.ok(replacement);
    assert.notEqual(replacement.claimId, claim.claimId);
    const secondAttempt = await jobs.prepare(replacement);
    assert.ok(secondAttempt);
    assert.equal(secondAttempt.attemptNumber, 2);
    await jobs.finish(firstAttempt, {
      outcome: 'ACCEPTED',
      errorCode: null,
      ticketId: 'fixture-old-ticket',
      nextAttemptAt: new Date(),
    });
    assert.equal(await jobs.authorize(firstAttempt), false);
    assert.equal(await jobs.authorize(secondAttempt), true);
    await jobs.finish(secondAttempt, {
      outcome: 'ACCEPTED',
      errorCode: null,
      ticketId: 'fixture-new-ticket',
      nextAttemptAt: new Date(),
    });
    await tx.execute(
      sql`update notification_attempts set receipt_due_at = clock_timestamp() - interval '1 second'`,
    );
    const work = await receipts.claim();
    assert.equal(work.length, 2);
    for (const receipt of work) await receipts.finish(receipt, 'OK', null);

    // A mute invalidates a prepared claim and cannot be undone by late completion or resume.
    await messaging.send(sender, match.id, { ...input, clientId: randomUUID() });
    const [mutedClaim] = await jobs.claim();
    assert.ok(mutedClaim);
    const mutedAttempt = await jobs.prepare(mutedClaim);
    assert.ok(mutedAttempt);
    await preferences.saveConversation(recipient, match.id, false);
    assert.equal(await jobs.authorize(mutedAttempt), false);
    await jobs.finish(mutedAttempt, {
      outcome: 'UNKNOWN',
      errorCode: 'NETWORK',
      nextAttemptAt: new Date(),
    });
    await preferences.saveConversation(recipient, match.id, true);
    assert.equal((await jobs.claim()).length, 0);
    await preferences.saveSettings(recipient, true);
    await messaging.send(sender, match.id, { ...input, clientId: randomUUID() });
    assert.equal((await jobs.claim()).length, 0);
    await preferences.saveSettings(recipient, false);

    // Raw token expiry and resolved metadata retention do not delete message history.
    await tx.execute(
      sql`update notification_devices set expires_at = clock_timestamp() - interval '1 second' where installation_id = ${device}::uuid`,
    );
    await tx.execute(
      sql`update message_notification_jobs set terminal_at = clock_timestamp() - interval '8 days' where status in ('ACCEPTED', 'CANCELLED')`,
    );
    await jobs.housekeep();
    assert.equal((await tx.execute(sql`select id from message_notification_jobs`)).rows.length, 0);
    assert.equal(
      (
        await tx.execute(
          sql`select installation_id from notification_devices where installation_id = ${device}::uuid and token is not null`,
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (await tx.execute(sql`select id from messages where conversation_id = ${match.id}::uuid`))
        .rows.length,
      4,
    );
    throw rollback;
  });
  throw new Error('The integration transaction unexpectedly committed.');
} catch (error) {
  if (error === rollback)
    console.log(
      'Notification integration passed; all fictional fixtures rolled back. Concurrency still requires a separate multi-connection test.',
    );
  else {
    console.error(
      'Notification integration failed. No credentials or database error details are logged.',
    );
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}
