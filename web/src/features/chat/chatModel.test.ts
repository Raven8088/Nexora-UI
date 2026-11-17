import { describe, expect, it } from 'vitest';
import { chatReducer, clarificationState, initialChatState, isBusy, saysExpired, type NexoraEntry } from './chatModel';

const request = { key: 'k', body: { request: 'q', language: 'es' as const, dataSource: 'demo' }, sourceAlias: 'demo', sourceLabel: 'Demo', question: 'q', sentAt: 0 };
const pending: NexoraEntry = { id: 'n1', role: 'nexora', at: 0, request, state: 'pending' };
const clarification = (extra: Partial<NexoraEntry> = {}, expiresAt = '2099-01-01T00:00:00Z'): NexoraEntry => ({
  ...pending,
  state: 'done',
  outcome: { kind: 'clarification', question: '¿?', options: ['A', 'B'], clarificationId: 'c', optionIds: ['a', 'b'], expiresAt, raw: {} },
  ...extra,
});

describe('chat model', () => {
  it('is busy while an operation is pending, and a reset keeps the reports of the session', () => {
    const sent = chatReducer(initialChatState, { type: 'sent', user: { id: 'u1', role: 'user', text: 'q', at: 0 }, pending });
    expect(isBusy(sent)).toBe(true);
    const report = { id: 'r1', fileName: 'f.xlsx', url: 'blob:x', size: 1, warnings: [], question: 'q', sourceLabel: 'Demo', createdAt: 0 };
    const done = chatReducer(sent, { type: 'resolved', id: 'n1', outcome: { kind: 'unknown', outcome: 'UNKNOWN' }, meta: { elapsedMs: 1 }, report });
    expect(isBusy(done)).toBe(false);
    const reset = chatReducer(done, { type: 'reset' });
    expect(reset.entries).toEqual([]);
    expect(reset.reports).toHaveLength(1);
  });

  it('knows when a clarification can be answered', () => {
    expect(clarificationState(clarification(), Date.now())).toBe('answerable');
    expect(clarificationState(clarification({ answeredOptionId: 'a' }), Date.now())).toBe('answered');
    expect(clarificationState(clarification({}, '2000-01-01T00:00:00Z'), Date.now())).toBe('expired');
    expect(clarificationState(clarification({ expiredByServer: true }), Date.now())).toBe('expired');
    const legacy = clarification();
    if (legacy.outcome?.kind === 'clarification') legacy.outcome = { ...legacy.outcome, clarificationId: undefined };
    expect(clarificationState(legacy, Date.now())).toBe('notAnswerable');
  });

  it('recognizes the expiry reported by Intelligence', () => {
    expect(saysExpired({ kind: 'problem', problem: { status: 502, code: 'compilation_failed', reason: 'CLARIFICATION_EXPIRED' } })).toBe(true);
    expect(saysExpired({ kind: 'problem', problem: { status: 502, code: 'compilation_failed' } })).toBe(false);
  });
});
