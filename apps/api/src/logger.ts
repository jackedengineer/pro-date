import pino from 'pino';

export function createLogger(level: pino.LevelWithSilent = 'info') {
  return pino({
    level,
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      remove: true,
    },
  });
}

const identifierFields = [
  'code',
  'constraint',
  'table',
  'column',
  'schema',
  'routine',
  'severity',
  'syscall',
] as const;
type IdentifierField = (typeof identifierFields)[number];

export type ErrorDiagnostics = { type: string; frames?: string[]; cause?: ErrorDiagnostics } & {
  [Field in IdentifierField]?: string;
};

const maxFrames = 12;
const maxCauseDepth = 3;
// Postgres SQLSTATEs, constraint/table names and Node system codes are identifiers, never values.
const identifierPattern = /^[\w.:-]{1,80}$/;

/**
 * Value-free diagnostics for logs. Messages are deliberately excluded: Drizzle's
 * DrizzleQueryError embeds every bound parameter (message bodies, coordinates) in its message,
 * and Postgres `detail`/`where` echo row values. The concrete type, SQLSTATE/constraint/table
 * and stack frames still locate both code faults and database faults.
 */
export function describeError(error: unknown, depth = 0): ErrorDiagnostics {
  if (!(error instanceof Error)) return { type: error === null ? 'null' : typeof error };

  const diagnostics: ErrorDiagnostics = {
    // DrizzleQueryError and others keep name 'Error'; the constructor tells them apart.
    type: error.name !== 'Error' ? error.name : error.constructor.name || 'Error',
  };
  const fields = error as unknown as Record<string, unknown>;

  for (const field of identifierFields) {
    const value = fields[field];
    const text = typeof value === 'number' ? String(value) : value;
    if (typeof text === 'string' && identifierPattern.test(text)) diagnostics[field] = text;
  }

  const frames = (error.stack ?? '')
    .split('\n')
    .filter((line) => /^\s+at /.test(line))
    .slice(0, maxFrames)
    .map((line) => line.trim());
  if (frames.length > 0) diagnostics.frames = frames;

  if (error.cause !== undefined && depth < maxCauseDepth)
    diagnostics.cause = describeError(error.cause, depth + 1);

  return diagnostics;
}

/** Flat scalar form for observers that accept only string/number fields. */
export function errorFields(error: unknown): Record<string, string> {
  const root = describeError(error);
  let innermost = root;
  while (innermost.cause !== undefined) innermost = innermost.cause;
  const code = innermost.code ?? root.code;

  return {
    errorType: root.type,
    ...(innermost === root ? {} : { causeType: innermost.type }),
    ...(code === undefined ? {} : { errorCode: code }),
    ...(innermost.constraint === undefined ? {} : { errorConstraint: innermost.constraint }),
    ...(root.frames?.[0] === undefined ? {} : { errorFrame: root.frames[0] }),
  };
}
