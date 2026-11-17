import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/server';
import { xlsxResponse } from '@/test/fixtures';
import { REPORT_REQUESTS_URL, submitReportRequest } from './intelligence';

const body = { request: '¿Cuántos registros hay?', language: 'es' as const, dataSource: 'demo' };

describe('report requests (Intelligence through the BFF)', () => {
  it('sends the Idempotency-Key and reads a report with its headers', async () => {
    let key: string | null = null;
    server.use(
      http.post(REPORT_REQUESTS_URL, ({ request }) => {
        key = request.headers.get('Idempotency-Key');
        return xlsxResponse({ 'X-Nexora-Warnings': 'W1,W2' });
      }),
    );
    const { outcome } = await submitReportRequest('k-1', body);
    expect(key).toBe('k-1');
    expect(outcome.kind).toBe('report');
    if (outcome.kind !== 'report') return;
    expect(outcome.fileName).toBe('reporte-demo.xlsx');
    expect(outcome.completeness).toBe('COMPLETED');
    expect(outcome.warnings).toEqual(['W1', 'W2']);
    expect(outcome.sha256).toHaveLength(64);
  });

  it('reads a governed clarification', async () => {
    server.use(
      http.post(REPORT_REQUESTS_URL, () =>
        HttpResponse.json({ status: 'NEEDS_CLARIFICATION', question: '¿Cuál?', options: ['A', 'B'], clarificationId: 'cl-1', optionIds: ['o-a', 'o-b'], expiresAt: '2099-01-01T00:00:00Z' }),
      ),
    );
    const { outcome } = await submitReportRequest('k-2', body);
    expect(outcome).toMatchObject({ kind: 'clarification', clarificationId: 'cl-1', optionIds: ['o-a', 'o-b'] });
  });

  it('keeps the business explanation of a 422 and separates an unknown outcome from a failure', async () => {
    server.use(
      http.post(REPORT_REQUESTS_URL, () =>
        HttpResponse.json({ status: 422, code: 'not_answerable', explanation: 'No hay una métrica aprobada.' }, { status: 422 }),
      ),
    );
    const first = await submitReportRequest('k-3', body);
    expect(first.outcome).toMatchObject({ kind: 'problem', problem: { code: 'not_answerable', explanation: 'No hay una métrica aprobada.' } });

    server.use(
      http.post(REPORT_REQUESTS_URL, () =>
        HttpResponse.json({ status: 504, code: 'bff_upstream_timeout', origin: 'bff', outcome: 'UNKNOWN' }, { status: 504 }),
      ),
    );
    const second = await submitReportRequest('k-3', body);
    expect(second.outcome).toMatchObject({ kind: 'unknown', outcome: 'UNKNOWN' });
  });

  it('treats a network failure as an unknown outcome (the same key may be retried)', async () => {
    server.use(http.post(REPORT_REQUESTS_URL, () => HttpResponse.error()));
    const { outcome } = await submitReportRequest('k-4', body);
    expect(outcome).toMatchObject({ kind: 'unknown', outcome: 'UNKNOWN' });
  });
});
