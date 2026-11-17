import { describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS, definition } from '@/test/fixtures';
import { actionsFor, dependentsOf, matches } from './lifecycle';

const none = { chat: false, catalogRead: true, proposalWrite: false, approve: false, audit: false, diagnostics: false };

describe('definition lifecycle in the console', () => {
  it('B4: a DRAFT is editable; an APPROVED one can be corrected (with confirmation) or retired; no delete anywhere (D6)', () => {
    const draft = actionsFor({ status: 'DRAFT' }, ALL_PERMISSIONS).map((a) => a.action);
    expect(draft).toEqual(['edit', 'approve', 'reject']);
    expect(actionsFor({ status: 'APPROVED' }, ALL_PERMISSIONS).map((a) => a.action)).toEqual(['correct', 'retire']);
    expect(actionsFor({ status: 'INACTIVE' }, ALL_PERMISSIONS).map((a) => a.action)).toEqual(['reactivate']);
    const all = ['DRAFT', 'APPROVED', 'INACTIVE'].flatMap((s) => actionsFor({ status: s as 'DRAFT' }, ALL_PERMISSIONS).map((a) => a.action as string));
    expect(all).not.toContain('delete');
  });

  it('separates the editor from the approver as Semantic does (SEC-1/SEC-2)', () => {
    const editor = { ...none, proposalWrite: true };
    const approverOnly = { ...none, approve: true };
    expect(actionsFor({ status: 'DRAFT' }, editor).map((a) => a.action)).toEqual(['edit']);
    expect(actionsFor({ status: 'APPROVED' }, editor).map((a) => a.action)).toEqual(['correct']);
    expect(actionsFor({ status: 'DRAFT' }, approverOnly).map((a) => a.action)).toEqual(['approve', 'reject']);
    expect(actionsFor({ status: 'APPROVED' }, approverOnly).map((a) => a.action)).toEqual(['retire']);
    expect(actionsFor({ status: 'INACTIVE' }, approverOnly)).toEqual([]);
  });

  it('offers nothing to a reader', () => {
    for (const status of ['DRAFT', 'APPROVED', 'INACTIVE'] as const) expect(actionsFor({ status }, none)).toEqual([]);
  });

  it('finds dependents and searches ignoring case and accents', () => {
    const concept = definition({ kind: 'CONCEPT', name: 'Pozo petrolífero' });
    const metric = definition({ kind: 'METRIC', concept: null, metric: { conceptId: concept.id, aggregation: 'COUNT' } });
    expect(dependentsOf(concept, [concept, metric]).map((d) => d.id)).toEqual([metric.id]);
    expect(matches(concept, 'PETROLIFERO')).toBe(true);
    expect(matches(concept, 'gas')).toBe(false);
  });
});
