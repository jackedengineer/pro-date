import {
  notificationSettingsPatchSchema,
  notificationSettingsResponseSchema,
  conversationNotificationPatchSchema,
  conversationNotificationResponseSchema,
  notificationDeviceRegisterSchema,
  notificationDeviceRevokeSchema,
  notificationDeviceResponseSchema,
} from '@pro-date/contracts';
import {
  DiscoveryError,
  type NotificationPreferencesRepository,
  type NotificationDeviceRepository,
} from '@pro-date/database';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { CurrentUserRecord } from '../app.js';

export interface NotificationPreferencesOptions {
  repository: NotificationPreferencesRepository;
  enabled: boolean;
  deliveryEnabled?: boolean;
}
export interface NotificationDevicesOptions {
  repository: NotificationDeviceRepository;
  enabled: boolean;
  projectId: string | null;
}
export function createNotificationRouter(options: {
  preferences: NotificationPreferencesOptions | undefined;
  devices: NotificationDevicesOptions | undefined;
  findCurrentUser: (subject: string) => Promise<CurrentUserRecord | null>;
  resolveClerkSubject: (request: Request) => string | null;
  requestId: (request: Request) => string;
}) {
  const router = Router();
  const isAvailable = options.preferences?.enabled === true;
  // Configured handoff capability, not a worker health check or a delivery guarantee.
  const capabilities = {
    isAvailable,
    isDeliveryReady: isAvailable && options.preferences?.deliveryEnabled === true,
  };
  const paths = ['/notification-settings', '/conversations/:id/notification-preference'];
  const devicePath = '/notification-devices/:installationId';
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
  router.use([...paths, devicePath], async (request, response, next) => {
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
  router.use(devicePath, (request, response, next) => {
    if (options.devices?.enabled === true) {
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
  router.put(devicePath, async (request, response) => {
    if (options.devices!.projectId === null) {
      reject(request, response, 503, 'NOTIFICATIONS_UNAVAILABLE', 'Push project setup is pending.');
      return;
    }
    const installationId = input(z.uuid(), request.params.installationId);
    const registration = input(notificationDeviceRegisterSchema, request.body);
    if (registration.projectId !== options.devices!.projectId)
      throw new DiscoveryError(
        'VALIDATION_ERROR',
        422,
        'Check this build’s push project configuration.',
      );
    const receipt = await options.devices!.repository.register(
      response.locals.viewerId as string,
      installationId,
      registration,
    );
    response.json(
      notificationDeviceResponseSchema.parse({
        data: receipt,
        requestId: options.requestId(request),
      }),
    );
  });
  router.delete(devicePath, async (request, response) => {
    const installationId = input(z.uuid(), request.params.installationId);
    const revocation = input(notificationDeviceRevokeSchema, request.body);
    const receipt = await options.devices!.repository.revoke(
      response.locals.viewerId as string,
      installationId,
      revocation,
    );
    response.json(
      notificationDeviceResponseSchema.parse({
        data: receipt,
        requestId: options.requestId(request),
      }),
    );
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
