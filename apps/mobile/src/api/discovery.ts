import {
  actionResponseSchema,
  apiErrorResponseSchema,
  discoveryQuerySchema,
  discoveryResponseSchema,
  inboxResponseSchema,
  matchesResponseSchema,
  pullRequestReceiptResponseSchema,
  type DiscoveryProfile,
  type IncomingPullRequest,
  type Match,
  type PullRequestReceipt,
  type ReportProfile,
  type SendPullRequest,
} from '@pro-date/contracts';
import { z } from 'zod';

import type { GetSessionToken } from './current-user';

export interface DiscoveryFilters {
  radiusKm: number;
  minAge: number;
  maxAge: number;
}
export interface DiscoveryPage<T> {
  data: T[];
  nextCursor: string | null;
}
export interface DiscoveryActions {
  browse: (filters: DiscoveryFilters, cursor?: string) => Promise<DiscoveryPage<DiscoveryProfile>>;
  inbox: (cursor?: string) => Promise<DiscoveryPage<IncomingPullRequest>>;
  listMatches: (cursor?: string) => Promise<DiscoveryPage<Match>>;
  send: (input: SendPullRequest) => Promise<PullRequestReceipt>;
  respond: (id: string, decision: 'MERGED' | 'DECLINED') => Promise<PullRequestReceipt>;
  pass: (userId: string) => Promise<void>;
  block: (userId: string) => Promise<void>;
  report: (input: ReportProfile) => Promise<void>;
}

interface Options {
  apiBaseUrl: string;
  getToken: GetSessionToken;
  fetchImplementation?: typeof fetch;
}

export function createDiscoveryApi({
  apiBaseUrl,
  getToken,
  fetchImplementation = fetch,
}: Options): DiscoveryActions {
  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    method: 'GET' | 'POST' | 'PUT' = 'GET',
    body?: unknown,
  ): Promise<T> {
    const token = await getToken();
    if (token === null) throw new Error('Your session expired. Please sign in again.');
    const response = await fetchImplementation(`${apiBaseUrl}/v1/${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      json = null;
    }
    if (!response.ok) {
      const error = apiErrorResponseSchema.safeParse(json);
      throw new Error(
        error.success ? error.data.error.message : 'We could not connect. Please try again.',
      );
    }
    const result = schema.safeParse(json);
    if (!result.success)
      throw new Error('The server returned an unexpected response. Please refresh.');
    return result.data;
  }
  const pagePath = (path: string, cursor?: string) =>
    cursor === undefined ? path : `${path}?cursor=${encodeURIComponent(cursor)}`;
  return {
    browse(filters, cursor) {
      const values = discoveryQuerySchema.parse({
        ...filters,
        ...(cursor === undefined ? {} : { cursor }),
      });
      const params = new URLSearchParams({
        limit: values.limit.toString(),
        radiusKm: values.radiusKm.toString(),
        minAge: values.minAge.toString(),
        maxAge: values.maxAge.toString(),
        ...(cursor === undefined ? {} : { cursor }),
      });
      return request(`discovery?${params.toString()}`, discoveryResponseSchema);
    },
    inbox: (cursor) => request(pagePath('pull-requests', cursor), inboxResponseSchema),
    listMatches: (cursor) => request(pagePath('matches', cursor), matchesResponseSchema),
    send: async (input) =>
      (await request('pull-requests', pullRequestReceiptResponseSchema, 'POST', input)).data,
    respond: async (id, decision) =>
      (
        await request(`pull-requests/${id}/response`, pullRequestReceiptResponseSchema, 'PUT', {
          decision,
        })
      ).data,
    pass: async (userId) => {
      await request('passes', actionResponseSchema, 'PUT', { userId });
    },
    block: async (userId) => {
      await request('blocks', actionResponseSchema, 'PUT', { userId });
    },
    report: async (input) => {
      await request('reports', actionResponseSchema, 'PUT', input);
    },
  };
}
