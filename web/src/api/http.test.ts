import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/server';
import { json, send, SESSION_EXPIRED_EVENT } from './http';
import { ApiError, SessionExpiredError } from './problem';

describe('BFF client', () => {
  it('sends the CSRF token of the readable cookie on state-changing calls, never on reads', async () => {
    document.cookie = 'XSRF-TOKEN=token-123; path=/';
    const seen: (string | null)[] = [];
    server.use(
      http.all('/bff/echo', ({ request }) => {
        seen.push(request.headers.get('X-XSRF-TOKEN'));
        return HttpResponse.json({});
      }),
    );
    await send('/bff/echo');
    await send('/bff/echo', { method: 'POST', body: {} });
    expect(seen).toEqual([null, 'token-123']);
  });

  it('announces an ended session (401) and throws SessionExpiredError', async () => {
    server.use(http.get('/bff/x', () => new HttpResponse(null, { status: 401 })));
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);
    await expect(send('/bff/x')).rejects.toBeInstanceOf(SessionExpiredError);
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  });

  it('a 401 of a service forwarded by the BFF is an answer, not the end of the session (DEC-D-FE-1)', async () => {
    server.use(
      http.post('/bff/svc', () => HttpResponse.json({ status: 401, code: 'authentication_required' }, { status: 401 })),
      http.get('/bff/own', () => HttpResponse.json({ status: 401, code: 'session_required', reason: 'not_signed_in' }, { status: 401 })),
    );
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);
    const answer = await send('/bff/svc', { method: 'POST', body: {} });
    expect(answer.status).toBe(401);
    expect(listener).not.toHaveBeenCalled();
    await expect(send('/bff/own')).rejects.toBeInstanceOf(SessionExpiredError);
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  });

  it('turns a problem answer into an ApiError and keeps the ETag of a success', async () => {
    server.use(
      http.get('/bff/bad', () => HttpResponse.json({ status: 409, code: 'DUPLICATE_KEY', correlationId: 'c-9' }, { status: 409 })),
      http.get('/bff/ok', () => HttpResponse.json({ a: 1 }, { headers: { ETag: '"4"' } })),
    );
    const error = await json('/bff/bad').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).problem.code).toBe('DUPLICATE_KEY');
    await expect(json('/bff/ok')).resolves.toEqual({ data: { a: 1 }, etag: '"4"' });
  });
});
