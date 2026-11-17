import { NetworkError, readProblem, type Problem } from './problem';
import { send } from './http';

/**
 * Nexora Intelligence `POST /api/v1/report-requests`, through the BFF. A 200 is not always a report: it is either a
 * clarification (JSON `NEEDS_CLARIFICATION`) or the Excel file (binary). Everything else is a problem.
 */
export const REPORT_REQUESTS_URL = '/bff/api/report-requests';
export const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type Language = 'es' | 'en' | 'fr';

export type ReportRequestBody =
  | { request: string; language: Language; dataSource: string }
  | { clarification: { id: string; option: string }; language: Language; dataSource: string };

export interface ClarificationAnswer {
  kind: 'clarification';
  question: string;
  options: string[];
  /** Present only for a governed clarification of Semantic (a session that can be answered). */
  clarificationId?: string;
  optionIds?: string[];
  expiresAt?: string;
  correlationId?: string;
  raw: unknown;
}

export interface ReportAnswer {
  kind: 'report';
  file: Blob;
  fileName: string;
  sha256?: string;
  completeness?: string;
  warnings: string[];
  runId?: string;
  reportPlanId?: string;
  correlationId?: string;
}

export interface ProblemAnswer {
  kind: 'problem';
  problem: Problem;
  correlationId?: string;
}

/** No answer, or one that says the outcome is unknown: the same key may be sent again. */
export interface UnknownAnswer {
  kind: 'unknown';
  /** NOT_SENT: the request did not reach the service; UNKNOWN: it may have been processed. */
  outcome: 'NOT_SENT' | 'UNKNOWN';
  problem?: Problem;
}

export type ReportOutcome = ClarificationAnswer | ReportAnswer | ProblemAnswer | UnknownAnswer;

export interface ReportResponseMeta {
  httpStatus?: number;
  elapsedMs: number;
  bffElapsedMs?: number;
}

function header(response: Response, name: string): string | undefined {
  return response.headers.get(name) ?? undefined;
}

function fileNameOf(disposition: string | undefined): string {
  const match = disposition?.match(/filename="([^"]+)"/);
  return match?.[1] ?? 'nexora-report.xlsx';
}

export async function submitReportRequest(
  key: string,
  body: ReportRequestBody,
): Promise<{ outcome: ReportOutcome; meta: ReportResponseMeta }> {
  const started = performance.now();
  let response: Response;
  try {
    response = await send(REPORT_REQUESTS_URL, {
      method: 'POST',
      body,
      headers: { 'Idempotency-Key': key, Accept: `application/json, application/problem+json, ${XLSX}` },
    });
  } catch (e) {
    if (e instanceof NetworkError) {
      return { outcome: { kind: 'unknown', outcome: 'UNKNOWN' }, meta: { elapsedMs: performance.now() - started } };
    }
    throw e;
  }
  const meta: ReportResponseMeta = {
    httpStatus: response.status,
    elapsedMs: performance.now() - started,
    bffElapsedMs: header(response, 'X-Nexora-Bff-Elapsed-Ms') ? Number(header(response, 'X-Nexora-Bff-Elapsed-Ms')) : undefined,
  };
  const correlationId = header(response, 'X-Request-Id');
  const type = header(response, 'Content-Type') ?? '';
  if (response.ok && type.includes('spreadsheetml')) {
    return {
      outcome: {
        kind: 'report',
        file: await response.blob(),
        fileName: fileNameOf(header(response, 'Content-Disposition')),
        sha256: header(response, 'X-Nexora-Artifact-Sha256'),
        completeness: header(response, 'X-Nexora-Completeness'),
        warnings: (header(response, 'X-Nexora-Warnings') ?? '').split(',').filter(Boolean),
        runId: header(response, 'X-Nexora-Run-Id'),
        reportPlanId: header(response, 'X-Nexora-Report-Plan-Id'),
        correlationId,
      },
      meta,
    };
  }
  if (response.ok) {
    const raw: unknown = await response.json().catch(() => undefined);
    const b = (raw ?? {}) as Record<string, unknown>;
    if (b.status === 'NEEDS_CLARIFICATION' && typeof b.question === 'string' && Array.isArray(b.options)) {
      return {
        outcome: {
          kind: 'clarification',
          question: b.question,
          options: b.options.filter((o): o is string => typeof o === 'string'),
          clarificationId: typeof b.clarificationId === 'string' ? b.clarificationId : undefined,
          optionIds: Array.isArray(b.optionIds) ? b.optionIds.filter((o): o is string => typeof o === 'string') : undefined,
          expiresAt: typeof b.expiresAt === 'string' ? b.expiresAt : undefined,
          correlationId: typeof b.correlationId === 'string' ? b.correlationId : correlationId,
          raw,
        },
        meta,
      };
    }
    return {
      outcome: { kind: 'problem', problem: { status: response.status, code: 'unexpected_answer' }, correlationId },
      meta,
    };
  }
  const problem = await readProblem(response);
  if (problem.origin === 'bff' && (problem.outcome === 'UNKNOWN' || problem.outcome === 'NOT_SENT')) {
    return { outcome: { kind: 'unknown', outcome: problem.outcome, problem }, meta };
  }
  return { outcome: { kind: 'problem', problem, correlationId: problem.correlationId ?? correlationId }, meta };
}
