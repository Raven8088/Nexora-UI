/**
 * The error model of the console. Services (Semantic, Intelligence) and the BFF answer problems with `status` and
 * `code`; the console never shows their technical titles to a business user: it shows its own text for the code and,
 * when the service gives one, the business `explanation` exactly as received.
 */
export interface Problem {
  status: number;
  code: string;
  title?: string;
  detail?: string;
  correlationId?: string;
  /** Intelligence 422 not_answerable: the business explanation, shown as received. */
  explanation?: string;
  gapCodes?: string[];
  /** Intelligence: the stage and reason of a failure (e.g. reason CLARIFICATION_EXPIRED). */
  stage?: string;
  reason?: string;
  /** Semantic: invalid fields (400) or the issues of an invalid definition or relationship (422: code, field, message). */
  errors?: { code?: string; field?: string; message?: string }[];
  /** BFF: origin "bff" and the outcome of a call it could not complete. */
  origin?: string;
  outcome?: 'NOT_SENT' | 'UNKNOWN' | 'REFUSED';
  [key: string]: unknown;
}

export class ApiError extends Error {
  constructor(
    readonly problem: Problem,
    readonly correlationId?: string,
  ) {
    super(problem.code);
    this.name = 'ApiError';
  }
}

/** The session ended (401): the console asks the user to sign in again. */
export class SessionExpiredError extends Error {
  constructor() {
    super('session_required');
    this.name = 'SessionExpiredError';
  }
}

/** No answer reached the browser: the request may or may not have been processed. */
export class NetworkError extends Error {
  constructor() {
    super('network');
    this.name = 'NetworkError';
  }
}

/** Parses a problem body; anything unreadable becomes a generic problem with the HTTP status. */
export async function readProblem(response: Response): Promise<Problem> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const p = body as Record<string, unknown>;
      return {
        ...p,
        status: typeof p.status === 'number' ? p.status : response.status,
        code: typeof p.code === 'string' ? p.code : `http_${response.status}`,
      } as Problem;
    }
  } catch {
    /* not JSON */
  }
  return { status: response.status, code: `http_${response.status}` };
}
