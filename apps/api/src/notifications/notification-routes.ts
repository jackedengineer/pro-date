import {
  notificationSettingsPatchSchema,
  notificationSettingsResponseSchema,
  conversationNotificationPatchSchema,
  conversationNotificationResponseSchema,
} from '@pro-date/contracts';
import { DiscoveryError, type NotificationPreferencesRepository } from '@pro-date/database';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { CurrentUserRecord } from '../app.js';

export interface NotificationPreferencesOptions {
  repository: NotificationPreferencesRepository;
  enabled: boolean;
}
export function createNotificationRouter(options: {
  preferences: NotificationPreferencesOptions | undefined;
  findCurrentUser: (subject: string) => Promise<CurrentUserRecord | null>;
  resolveClerkSubject: (request: Request) => string | null;
  requestId: (request: Request) => string;
}) {
  const router = Router();
  const isAvailable = options.preferences?.enabled === true;
  // Preference storage is not proof that a worker/device/provider is ready.
  const capabilities = { isAvailable, isDeliveryReady: false };
  const paths = ['/notification-settings', '/conversations/:id/notification-preference'];
  function reject(
    request: Request,
    response: Response,
    status: number,
    code: string,
    message: string,
  ) {
    response
      .status(status)
      .json({ error: { code, message }, requestId: options.requestId(request) });
  }
  router.use(paths, async (request, response, next) => {
    const subject = options.resolveClerkSubject(request);
    if (!subject) {
      reject(request, response, 401, 'UNAUTHORIZED', 'Authentication is required.');
      return;
    }
    const viewer = await options.findCurrentUser(subject);
    if (viewer === null || viewer.onboardingStatus !== 'COMPLETE') {
      reject(
        request,
        response,
        409,
        'ONBOARDING_STEP_REQUIRED',
        'Publish your profile before changing chat notifications.',
      );
      return;
    }
    response.locals.viewerId = viewer.id;
    next();
  });
  const repository = () => options.preferences!.repository;
  // Capability reads work even before migration; mutating/chat-specific routes fail closed.
  router.get('/notification-settings', async (request, response) => {
    const state = isAvailable
      ? await repository().settings(response.locals.viewerId as string)
      : { isPaused: false, revision: 0 };
    response.json(
      notificationSettingsResponseSchema.parse({
        data: { ...state, ...capabilities },
        requestId: options.requestId(request),
      }),
    );
  });
  router.use(paths, (request, response, next) => {
    if (isAvailable) {
      next();
      return;
    }
    reject(
      request,
      response,
      503,
      'NOTIFICATIONS_UNAVAILABLE',
      'Push setup is pending. Messaging still works.',
    );
  });
  function input<T>(schema: z.ZodType<T>, value: unknown): T {
    const parsed = schema.safeParse(value);
    if (!parsed.success)
      throw new DiscoveryError(
        'VALIDATION_ERROR',
        422,
        'Check your notification settings and try again.',
      );
    return parsed.data;
  }
  router.patch('/notification-settings', async (request, response) => {
    const { isPaused } = input(notificationSettingsPatchSchema, request.body);
    const state = await repository().saveSettings(response.locals.viewerId as string, isPaused);
    response.json(
      notificationSettingsResponseSchema.parse({
        data: { ...state, ...capabilities },
        requestId: options.requestId(request),
      }),
    );
  });
  router.get('/conversations/:id/notification-preference', async (request, response) => {
    const conversationId = input(z.uuid(), request.params.id);
    const state = await repository().conversation(
      response.locals.viewerId as string,
      conversationId,
    );
    response.json(
      conversationNotificationResponseSchema.parse({
        data: { ...state, conversationId, ...capabilities },
        requestId: options.requestId(request),
      }),
    );
  });
  router.patch('/conversations/:id/notification-preference', async (request, response) => {
    const conversationId = input(z.uuid(), request.params.id);
    const { isEnabled } = input(conversationNotificationPatchSchema, request.body);
    const state = await repository().saveConversation(
      response.locals.viewerId as string,
      conversationId,
      isEnabled,
    );
    response.json(
      conversationNotificationResponseSchema.parse({
        data: { ...state, conversationId, ...capabilities },
        requestId: options.requestId(request),
      }),
    );
  });
  return router;
}
