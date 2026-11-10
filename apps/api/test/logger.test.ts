import { describe, expect, it } from 'vitest';

import { describeError, errorFields } from '../src/logger.js';

// Shapes copied from drizzle-orm (errors.js) and pg's DatabaseError, without importing either.
class DrizzleQueryError extends Error {
  constructor(query: string, params: unknown[], cause: unknown) {
    super(`Failed query: ${query}\nparams: ${params.join(',')}`, { cause });
  }
}
function databaseError() {
  return Object.assign(new Error('new row violates check constraint "messages_body_check"'), {
    name: 'DatabaseError',
    code: '23514',
    constraint: 'messages_body_check',
    table: 'messages',
    severity: 'ERROR',
    detail: 'Failing row contains (…, my secret message body, …).',
    where: 'SQL statement near 19.0760, 72.8777',
  });
}

describe('value-free error diagnostics', () => {
  it('locates a database fault without the bound parameters or row values', () => {
    const failure = new DrizzleQueryError(
      'insert into messages (body) values ($1)',
      ['my secret message body', 19.076, 72.8777],
      databaseError(),
    );
    const diagnostics = describeError(failure);
    const serialized = JSON.stringify(diagnostics);

    expect(diagnostics.type).toBe('DrizzleQueryError');
    expect(diagnostics.frames?.[0]).toMatch(/^at /);
    expect(diagnostics.cause).toMatchObject({
      type: 'DatabaseError',
      code: '23514',
      constraint: 'messages_body_check',
      table: 'messages',
    });
    for (const secret of ['secret', '19.07', '72.87', 'Failing row', 'insert into'])
      expect(serialized).not.toContain(secret);
  });

  it('flattens to scalar fields for the push worker observer', () => {
    const fields = errorFields(new DrizzleQueryError('select 1', ['token'], databaseError()));

    expect(fields).toMatchObject({
      errorType: 'DrizzleQueryError',
      causeType: 'DatabaseError',
      errorCode: '23514',
      errorConstraint: 'messages_body_check',
    });
    expect(fields.errorFrame).toMatch(/^at /);
    expect(JSON.stringify(fields)).not.toContain('token');
  });

  it('keeps Node system codes and ignores identifier fields that look like data', () => {
    const network = Object.assign(new Error('connect ECONNREFUSED 10.0.0.5:5432'), {
      code: 'ECONNREFUSED',
      syscall: 'connect',
    });
    expect(describeError(network)).toMatchObject({ code: 'ECONNREFUSED', syscall: 'connect' });

    const odd = Object.assign(new Error('x'), { code: 'Bearer abc.def ghi', table: 'a b' });
    expect(describeError(odd)).not.toHaveProperty('code');
    expect(describeError(odd)).not.toHaveProperty('table');
  });

  it('describes thrown non-errors by kind only and bounds cause chains', () => {
    expect(describeError('private string')).toEqual({ type: 'string' });
    expect(describeError(null)).toEqual({ type: 'null' });

    let deep: Error = new Error('root');
    for (let index = 0; index < 10; index++) deep = new Error('wrap', { cause: deep });
    let depth = 0;
    for (let level = describeError(deep).cause; level !== undefined; level = level.cause) depth++;
    expect(depth).toBe(3);
  });
});
