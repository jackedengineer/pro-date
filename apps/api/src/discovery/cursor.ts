import { DiscoveryError } from '@pro-date/database';
import { z } from 'zod';

const cursorSchema = z.strictObject({
  version: z.literal(1),
  scope: z.string().max(200),
  id: z.uuid(),
  at: z.iso.datetime({ offset: true }),
  ceiling: z.iso.datetime({ offset: true }),
});
type CursorPosition = Pick<z.infer<typeof cursorSchema>, 'id' | 'at' | 'ceiling'>;

export function encodeDiscoveryCursor(scope: string, position: CursorPosition): string {
  return Buffer.from(JSON.stringify({ version: 1, scope, ...position })).toString('base64url');
}

export function decodeDiscoveryCursor(cursor: string, scope: string): CursorPosition {
  try {
    if (cursor.length > 1600 || !/^[A-Za-z0-9_-]+$/.test(cursor))
      throw new Error('Invalid encoding');
    const result = cursorSchema.parse(
      JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')),
    );
    if (result.scope !== scope || Date.parse(result.at) > Date.parse(result.ceiling))
      throw new Error('Invalid scope');
    return { id: result.id, at: result.at, ceiling: result.ceiling };
  } catch {
    throw new DiscoveryError('INVALID_CURSOR', 422, 'Refresh this list to continue browsing.');
  }
}
