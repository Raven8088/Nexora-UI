import { describe, expect, it } from 'vitest';
import { COL_A1, COL_B1, TABLE_A, TABLE_B, relationship } from '@/test/fixtures';
import { emptyValues, matchesRelationship, toCreate, toFromForeignKey, toUpdate, validate, valuesFromCandidate, valuesOf } from './model';

describe('relationship model (B3), same limits as Semantic', () => {
  it('a manual relationship needs a name, both tables, complete distinct pairs (1–16) and a JOIN type', () => {
    const v = emptyValues();
    expect(validate(v, true)).toEqual({ name: 'name', source: 'source', target: 'target', pairs: 'pairs' });
    const ok = { ...v, name: 'Pedido de cliente', sourceObjectId: TABLE_A.objectId, targetObjectId: TABLE_B.objectId, pairs: [{ sourceColumnId: COL_A1.objectId, targetColumnId: COL_B1.objectId }] };
    expect(validate(ok, true)).toEqual({});
    expect(validate({ ...ok, pairs: [...ok.pairs, ...ok.pairs] }, true)).toEqual({ pairs: 'pairsDuplicated' });
    expect(validate({ ...ok, pairs: Array.from({ length: 17 }, (_, i) => ({ sourceColumnId: `s${i}`, targetColumnId: `t${i}` })) }, true)).toEqual({ pairs: 'pairs' });
    expect(validate({ ...ok, allowedJoinTypes: [] }, true)).toEqual({ joinTypes: 'joinTypes' });
    expect(validate({ ...ok, name: 'x'.repeat(201) }, true)).toEqual({ name: 'name' });
  });

  it('builds exactly CreateRelationshipRequest, CreateFromForeignKeyRequest and UpdateRelationshipRequest', () => {
    const v = { ...emptyValues(), name: ' Pedido ', description: '  ', sourceObjectId: 'a', targetObjectId: 'b', pairs: [{ sourceColumnId: 'c1', targetColumnId: 'c2' }], allowedJoinTypes: ['INNER', 'LEFT'] as ('INNER' | 'LEFT')[] };
    expect(toCreate(v)).toEqual({ name: 'Pedido', sourceObjectId: 'a', targetObjectId: 'b', pairs: [{ sourceColumnId: 'c1', targetColumnId: 'c2' }], declaredCardinality: 'MANY_TO_ONE', allowedJoinTypes: ['INNER', 'LEFT'] });
    // the name of a foreign key relationship is optional: omitted when empty, Semantic uses the foreign key's
    const fk = { ...emptyValues(), origin: 'foreignKey' as const, foreignKeyId: 'fk-1' };
    expect(validate(fk, true)).toEqual({});
    expect(toFromForeignKey(fk)).toEqual({ foreignKeyId: 'fk-1', declaredCardinality: 'MANY_TO_ONE', allowedJoinTypes: ['INNER'] });
    // objects, pairs and origin are immutable: an update sends only the editable fields
    expect(toUpdate(valuesOf(relationship({ name: 'R', description: 'd', declaredCardinality: 'ONE_TO_ONE', allowedJoinTypes: ['LEFT'] })))).toEqual({
      name: 'R',
      description: 'd',
      declaredCardinality: 'ONE_TO_ONE',
      allowedJoinTypes: ['LEFT'],
    });
    expect(validate(valuesOf(relationship({ name: '' })), false)).toEqual({ name: 'name' });
  });

  it('a declared foreign key candidate becomes a DECLARED_FK draft; another candidate pre-fills a SEMANTIC one', () => {
    const pairs = [{ sourceColumn: COL_A1, targetColumn: COL_B1 }];
    const fk = valuesFromCandidate({ source: TABLE_A, target: TABLE_B, pairs, suggestedOrigin: 'DECLARED_FK', foreignKeyId: 'fk-9', signals: [] });
    expect(fk).toMatchObject({ origin: 'foreignKey', foreignKeyId: 'fk-9', foreignKeyLabel: 'demo.pedidos → demo.clientes' });
    const sem = valuesFromCandidate({ source: TABLE_A, target: TABLE_B, pairs, suggestedOrigin: 'SEMANTIC', foreignKeyId: null, signals: [] });
    expect(sem).toMatchObject({ origin: 'manual', sourceObjectId: TABLE_A.objectId, targetObjectId: TABLE_B.objectId, pairs: [{ sourceColumnId: COL_A1.objectId, targetColumnId: COL_B1.objectId }] });
  });

  it('searches names, tables and columns ignoring case and accents', () => {
    const r = relationship({ name: 'Pedido → Cliente' });
    expect(matchesRelationship(r, 'PEDIDO')).toBe(true);
    expect(matchesRelationship(r, 'clientes.id')).toBe(true);
    expect(matchesRelationship(r, 'factura')).toBe(false);
  });
});
