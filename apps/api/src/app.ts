import { randomUUID } from 'node:crypto';

import type { ApiErrorResponse, HealthResponse } from '@pro-date/contracts';
import cors from 'cors';
import express, { type ErrorRequestHandler, type Request } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import pinoHttp from 'pino-http';

import { createLogger } from './logger.js';

type ReadinessStatus = 'up' | 'down';
type ReadinessChecks = Record<string, ReadinessStatus>;

export interface ApiAppOptions {
  clock?: () => Date;
  logger?: Logger;
  readinessCheck?: () => Promise<ReadinessChecks>;
  requestId?: () => string;
}

function areChecksHealthy(checks: ReadinessChecks): checks is Record<string, 'up'> {
  return Object.values(checks).every((status) => status === 'up');
}

function isMalformedJsonError(error: unknown): error is SyntaxError & { type: string } {
  return (
    error instanceof SyntaxError &&
    'type' in error &&
    typeof error.type === 'string' &&
    error.type === 'entity.parse.failed'
  );
}

function getRequestId(request: Request): string {
  if (typeof request.id === 'string') {
    return request.id;
  }

  if (typeof request.id === 'number') {
    return request.id.toString();
  }

  throw new TypeError('Request ID must be a string or number.');
}

export function createApiApp(options: ApiAppOptions = {}) {
  const clock = options.clock ?? (() => new Date());
  const logger = options.logger ?? createLogger();
  const readinessCheck = options.readinessCheck ?? (() => Promise.resolve({ application: 'up' }));
  const requestId = options.requestId ?? randomUUID;
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: false }));
  app.use(
    pinoHttp({
      genReqId: () => requestId(),
      logger,
    }),
  );
  app.use((request, response, next) => {
    response.setHeader('x-request-id', getRequestId(request));
    next();
  });
  app.use(express.json({ limit: '100kb' }));

  app.get('/health/live', (request, response) => {
    const body = {
      requestId: getRequestId(request),
      service: 'api',
      status: 'ok',
      timestamp: clock().toISOString(),
    } satisfies HealthResponse;

    response.status(200).json(body);
  });

  app.get('/health/ready', async (request, response) => {
    try {
      const checks = await readinessCheck();

      if (areChecksHealthy(checks)) {
        const body = {
          checks,
          requestId: getRequestId(request),
          service: 'api',
          status: 'ok',
          timestamp: clock().toISOString(),
        } satisfies HealthResponse;

        response.status(200).json(body);
        return;
      }

      const body = {
        checks,
        requestId: getRequestId(request),
        service: 'api',
        status: 'unavailable',
        timestamp: clock().toISOString(),
      } satisfies HealthResponse;

      response.status(503).json(body);
    } catch (error: unknown) {
      request.log.warn(
        { errorType: error instanceof Error ? error.name : 'UnknownError' },
        'Readiness check failed',
      );

      const body = {
        checks: { application: 'down' },
        requestId: getRequestId(request),
        service: 'api',
        status: 'unavailable',
        timestamp: clock().toISOString(),
      } satisfies HealthResponse;

      response.status(503).json(body);
    }
  });

  app.use((request, response) => {
    const body = {
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
      },
      requestId: getRequestId(request),
    } satisfies ApiErrorResponse;

    response.status(404).json(body);
  });

  const errorHandler: ErrorRequestHandler = (error, request, response, next) => {
    void next;

    if (isMalformedJsonError(error)) {
      const body = {
        error: {
          code: 'MALFORMED_JSON',
          message: 'The request body must contain valid JSON.',
        },
        requestId: getRequestId(request),
      } satisfies ApiErrorResponse;

      response.status(400).json(body);
      return;
    }

    request.log.error(
      { errorType: error instanceof Error ? error.name : 'UnknownError' },
      'Unhandled request error',
    );

    const body = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong.',
      },
      requestId: getRequestId(request),
    } satisfies ApiErrorResponse;

    response.status(500).json(body);
  };

  app.use(errorHandler);

  return app;
}
