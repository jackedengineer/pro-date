import {
  actionResponseSchema,
  conversationResponseSchema,
  conversationsResponseSchema,
  inboxQuerySchema,
  messageHistoryQuerySchema,
  messageHistoryResponseSchema,
  messageResponseSchema,
  sendMessageSchema,
} from '@pro-date/contracts';
import { DiscoveryError } from '@pro-date/database';
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { CurrentUserRecord } from '../app.js';
import type { MessagingService } from './messaging-service.js';

export function createMessagingRouter(options: {
  service: MessagingService | undefined;
  findCurrentUser: (subject: string) => Promise<CurrentUserRecord | null>;
  resolveClerkSubject: (request: Request) => string | null;
  requestId: (request: Request) => string;
}) {
  const router = Router();
  router.use('/conversations', async (request, response, next) => {
    const subject = options.resolveClerkSubject(request);
    if (subject === null || subject.length === 0) {
      response.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication is required.' },
        requestId: options.requestId(request),
      });
      return;
    }
    const viewer = await options.findCurrentUser(subject);
    if (viewer === null || viewer.onboardingStatus !== 'COMPLETE') {
      response.status(409).json({
        error: {
          code: 'ONBOARDING_STEP_REQUIRED',
          message: 'Publish your profile before starting a conversation.',
        },
        requestId: options.requestId(request),
      });
      return;
    }
    if (options.service === undefined) {
      response.status(503).json({
        error: {
          code: 'PROFILE_UNAVAILABLE',
          message: 'Messaging is unavailable right now. Try again shortly.',
        },
        requestId: options.requestId(request),
      });
      return;
    }
    response.locals.viewerId = viewer.id;
    next();
  });
  function input<T>(schema: z.ZodType<T>, value: unknown) {
    const result = schema.safeParse(value);
    if (!result.success)
      throw new DiscoveryError('VALIDATION_ERROR', 422, 'Check your message and try again.');
    return result.data;
  }
  router.get('/conversations', async (request, response) => {
    const page = await options.service!.conversations(
      response.locals.viewerId as string,
      input(inboxQuerySchema, request.query),
    );
    response.json(
      conversationsResponseSchema.parse({ ...page, requestId: options.requestId(request) }),
    );
  });
  router.get('/conversations/:id', async (request, response) => {
    const data = await options.service!.conversation(
      response.locals.viewerId as string,
      input(z.uuid(), request.params.id),
    );
    response.json(
      conversationResponseSchema.parse({ data, requestId: options.requestId(request) }),
    );
  });
  router.get('/conversations/:id/messages', async (request, response) => {
    const page = await options.service!.history(
      response.locals.viewerId as string,
      input(z.uuid(), request.params.id),
      input(messageHistoryQuerySchema, request.query),
    );
    response.json(
      messageHistoryResponseSchema.parse({ ...page, requestId: options.requestId(request) }),
    );
  });
  router.post('/conversations/:id/messages', async (request, response) => {
    const data = await options.service!.send(
      response.locals.viewerId as string,
      input(z.uuid(), request.params.id),
      input(sendMessageSchema, request.body),
    );
    response.json(messageResponseSchema.parse({ data, requestId: options.requestId(request) }));
  });
  router.delete('/conversations/:id', async (request, response) => {
    await options.service!.unmatch(
      response.locals.viewerId as string,
      input(z.uuid(), request.params.id),
    );
    response.json(
      actionResponseSchema.parse({ data: { saved: true }, requestId: options.requestId(request) }),
    );
  });
  return router;
}
