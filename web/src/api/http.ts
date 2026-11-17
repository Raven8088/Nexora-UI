import { ApiError, NetworkError, SessionExpiredError, readProblem } from './problem';

/** Event the console listens to when any call finds the session ended. */
export const SESSION_EXPIRED_EVENT = 'nexora:session-expired';

const CSRF_COOKIE = 'XSRF-TOKEN';
const CSRF_HEADER = 'X-XSRF-TOKEN';

/** The CSRF token the BFF set in a readable cookie (the session cookie itself is HttpOnly). */
export function csrfToken(): string | undefined {
  const entry = document.cookie.split('; ').find((c) => c.startsWith(`${CSRF_COOKIE}=`));
  return entry ? decodeURIComponent(entry.slice(CSRF_COOKIE.length + 1)) : undefined;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * One call to the BFF, same origin, with the session cookie and the CSRF header on state-changing calls. Throws
 * SessionExpiredError when the BFF says the console session is not usable (401 {@code session_required}, or a 401
 * without a readable problem) and announces it; NetworkError when no answer arrived. Other statuses are returned,
 * including a 401 of a service forwarded by the BFF (e.g. Intelligence's {@code authentication_required}, DEC-D-FE-1):
 * that is an answer about the request, not the end of the console session.
 */
export async function send(url: string, options: RequestOptions = {}): Promise<Response> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
  if (method !== 'GET') {
    const token = csrfToken();
    if (token) headers[CSRF_HEADER] = token;
  }
  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  let response: Response;
  try {
    response = await fetch(url, { method, headers, body, credentials: 'same-origin', signal: options.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new NetworkError();
  }
  if (response.status === 401 && (await endsTheSession(response))) {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    throw new SessionExpiredError();
  }
  return response;
}

/** A JSON answer with its ETag; a non-2xx answer becomes an ApiError with the service's problem. */
export async function json<T>(url: string, options: RequestOptions = {}): Promise<{ data: T; etag?: string }> {
  const response = await send(url, options);
  if (!response.ok) {
    throw new ApiError(await readProblem(response), response.headers.get('X-Request-Id') ?? undefined);
  }
  const data = (response.status === 204 ? undefined : await response.json()) as T;
  return { data, etag: response.headers.get('ETag') ?? undefined };
}

/** A 401 of the BFF itself (its code is always session_required) or one without a readable problem. */
async function endsTheSession(response: Response): Promise<boolean> {
  try {
    const body = (await response.clone().json()) as { code?: unknown };
    return typeof body?.code !== 'string' || body.code === 'session_required';
  } catch {
    return true;
  }
}
