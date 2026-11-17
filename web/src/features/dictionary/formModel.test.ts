import { describe, expect, it } from 'vitest';
import { emptyForm, formSchema, toCreate } from './formModel';

const errorsOf = (v: unknown) => {
  const r = formSchema.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe('definition form', () => {
  it('validates the key like Semantic', () => {
    expect(errorsOf({ ...emptyForm(), name: 'X', relationId: 'r', key: 'Mal Clave' })).toContain('key');
    expect(errorsOf({ ...emptyForm(), name: 'X', relationId: 'r', key: 'pozo_1' })).toEqual([]);
  });

  it('requires a column for SUM and AVG, not for COUNT', () => {
    const metric = { ...emptyForm('METRIC'), key: 'm1', name: 'M', conceptId: 'c' };
    expect(errorsOf({ ...metric, aggregation: 'SUM' })).toContain('columnForSum');
    expect(errorsOf({ ...metric, aggregation: 'COUNT' })).toEqual([]);
  });

  it('builds the request with only the block of its kind', () => {
    const body = toCreate({ ...emptyForm('METRIC'), key: 'm1', name: ' Total ', conceptId: 'c', aggregation: 'COUNT' });
    expect(body).toEqual({ kind: 'METRIC', key: 'm1', name: 'Total', metric: { conceptId: 'c', aggregation: 'COUNT' } });
  });
});
