import { apiErrorResponseSchema, healthResponseSchema } from '@pro-date/contracts';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApiApp } from '../src/app.js';

const requestId = '59a2c4a6-110e-470e-bcab-c762c18dec45';
const timestamp = '2026-10-04T11:00:00.000Z';

function createTestApp(readinessCheck?: () => Promise<Record<string, 'up' | 'down'>>) {
  return createApiApp({
    clock: () => new Date(timestamp),
    logger: pino({ level: 'silent' }),
    ...(readinessCheck === undefined ? {} : { readinessCheck }),
    requestId: () => requestId,
  });
}

describe('API application', () => {
  it('returns a contract-valid liveness response', async () => {
    const response = await request(createTestApp()).get('/health/live').expect(200);

    expect(response.headers['x-request-id']).toBe(requestId);
    expect(healthResponseSchema.parse(response.body)).toEqual({
      requestId,
      service: 'api',
      status: 'ok',
      timestamp,
    });
  });

  it('returns readiness only when dependencies are available', async () => {
    const response = await request(createTestApp()).get('/health/ready').expect(200);

    expect(healthResponseSchema.parse(response.body)).toEqual({
      checks: { application: 'up' },
      requestId,
      service: 'api',
      status: 'ok',
      timestamp,
    });
  });

  it('returns a safe unavailable response when readiness fails', async () => {
    const response = await request(
      createTestApp(() =>
        Promise.reject<Record<string, 'up' | 'down'>>(
          new Error('postgres://admin:secret@example.test'),
        ),
      ),
    )
      .get('/health/ready')
      .expect(503);

    expect(healthResponseSchema.parse(response.body)).toEqual({
      checks: { application: 'down' },
      requestId,
      service: 'api',
      status: 'unavailable',
      timestamp,
    });
    expect(JSON.stringify(response.body)).not.toContain('secret');
  });

  it('returns a safe JSON envelope for an unknown route', async () => {
    const response = await request(createTestApp()).get('/v1/unknown').expect(404);

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(apiErrorResponseSchema.parse(response.body)).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
      },
      requestId,
    });
  });

  it('handles malformed JSON without exposing implementation details', async () => {
    const response = await request(createTestApp())
      .post('/v1/unknown')
      .set('content-type', 'application/json')
      .send('{')
      .expect(400);

    expect(apiErrorResponseSchema.parse(response.body)).toEqual({
      error: {
        code: 'MALFORMED_JSON',
        message: 'The request body must contain valid JSON.',
      },
      requestId,
    });
    expect(JSON.stringify(response.body)).not.toContain('SyntaxError');
  });
});
