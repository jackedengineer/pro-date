import {
  actionResponseSchema,
  discoveryQuerySchema,
  discoveryResponseSchema,
  inboxQuerySchema,
  inboxResponseSchema,
  matchesResponseSchema,
  pullRequestReceiptResponseSchema,
  reportProfileSchema,
  respondPullRequestSchema,
  sendPullRequestSchema,
  userTargetSchema,
} from '@pro-date/contracts';
import { DiscoveryError } from '@pro-date/database';
import { Router, type Request } from 'express';
import { z } from 'zod';

import type { CurrentUserRecord } from '../app.js';
import type { DiscoveryService } from './discovery-service.js';

interface Options {
  service: DiscoveryService | undefined;
  resolveClerkSubject: (request: Request) => string | null;
  findOrCreateCurrentUser: (subject: string) => Promise<CurrentUserRecord>;
  requestId: (request: Request) => string;
}

export function createDiscoveryRouter(options: Options) {
  const router = Router();
  // Mount only on these resources so unrelated routes retain their own auth semantics.
  router.use(
    ['/discovery', '/pull-requests', '/matches', '/passes', '/blocks', '/reports'],
    async (request, response, next) => {
      const subject = options.resolveClerkSubject(request);
      const fail = (status: number, code: string, message: string) =>
        response
          .status(status)
          .json({ error: { code, message }, requestId: options.requestId(request) });
      if (subject === null || subject.length === 0) {
        fail(401, 'UNAUTHORIZED', 'Authentication is required.');
        return;
      }
      const user = await options.findOrCreateCurrentUser(subject);
      if (user.onboardingStatus !== 'COMPLETE' || user.onboardingStep !== 'COMPLETE') {
        fail(409, 'ONBOARDING_STEP_REQUIRED', 'Publish your profile before discovering people.');
        return;
      }
      if (options.service === undefined) {
        fail(503, 'PROFILE_UNAVAILABLE', 'Discovery is unavailable right now. Try again shortly.');
        return;
      }
      response.locals.viewerId = user.id;
      next();
    },
  );
  function input<T>(schema: z.ZodType<T>, value: unknown): T {
    const result = schema.safeParse(value);
    if (!result.success)
      throw new DiscoveryError('VALIDATION_ERROR', 422, 'Check your selection and try again.');
    return result.data;
  }
  router.get('/discovery', async (request, response) => {
    const result = await options.service!.browse(
      response.locals.viewerId as string,
      input(discoveryQuerySchema, request.query),
    );
    response.json(
      discoveryResponseSchema.parse({ ...result, requestId: options.requestId(request) }),
    );
  });
  router.get('/pull-requests', async (request, response) => {
    const result = await options.service!.inbox(
      response.locals.viewerId as string,
      input(inboxQuerySchema, request.query),
    );
    response.json(inboxResponseSchema.parse({ ...result, requestId: options.requestId(request) }));
  });
  router.get('/matches', async (request, response) => {
    const result = await options.service!.listMatches(
      response.locals.viewerId as string,
      input(inboxQuerySchema, request.query),
    );
    response.json(
      matchesResponseSchema.parse({ ...result, requestId: options.requestId(request) }),
    );
  });
  router.post('/pull-requests', async (request, response) => {
    const data = await options.service!.send(
      response.locals.viewerId as string,
      input(sendPullRequestSchema, request.body),
    );
    response.json(
      pullRequestReceiptResponseSchema.parse({ data, requestId: options.requestId(request) }),
    );
  });
  router.put('/pull-requests/:id/response', async (request, response) => {
    const { decision } = input(respondPullRequestSchema, request.body);
    const data = await options.service!.respond(
      response.locals.viewerId as string,
      input(z.uuid(), request.params.id),
      decision,
    );
    response.json(
      pullRequestReceiptResponseSchema.parse({ data, requestId: options.requestId(request) }),
    );
  });
  router.put('/passes', async (request, response) => {
    await options.service!.pass(
      response.locals.viewerId as string,
      input(userTargetSchema, request.body).userId,
    );
    response.json(
      actionResponseSchema.parse({ data: { saved: true }, requestId: options.requestId(request) }),
    );
  });
  router.put('/blocks', async (request, response) => {
    await options.service!.block(
      response.locals.viewerId as string,
      input(userTargetSchema, request.body).userId,
    );
    response.json(
      actionResponseSchema.parse({ data: { saved: true }, requestId: options.requestId(request) }),
    );
  });
  router.put('/reports', async (request, response) => {
    await options.service!.report(
      response.locals.viewerId as string,
      input(reportProfileSchema, request.body),
    );
    response.json(
      actionResponseSchema.parse({ data: { saved: true }, requestId: options.requestId(request) }),
    );
  });
  return router;
}
