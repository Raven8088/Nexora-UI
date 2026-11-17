import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { REPORT_REQUESTS_URL } from '@/api/intelligence';
import { session, sessionHandler, xlsxResponse } from '@/test/fixtures';
import { renderConsole } from '@/test/render';
import { server } from '@/test/server';

interface Seen {
  key: string | null;
  body: Record<string, unknown>;
}

function record(answers: ((n: number) => Response)[]) {
  const seen: Seen[] = [];
  server.use(
    http.post(REPORT_REQUESTS_URL, async ({ request }) => {
      seen.push({ key: request.headers.get('Idempotency-Key'), body: (await request.json()) as Record<string, unknown> });
      const answer = answers[Math.min(seen.length - 1, answers.length - 1)] as (n: number) => Response;
      return answer(seen.length);
    }),
  );
  return seen;
}

async function ask(text: string) {
  const user = userEvent.setup();
  const box = await screen.findByLabelText(/Escribe tu pregunta/);
  await user.type(box, text);
  await user.click(screen.getByRole('button', { name: /Enviar/ }));
  return user;
}

describe('chat with Nexora (F2/F3/F4 flows, synthetic)', () => {
  it('F2: answers a governed clarification with a new key and receives the Excel', async () => {
    const seen = record([
      () => HttpResponse.json({ status: 'NEEDS_CLARIFICATION', question: '¿Qué quieres contar?', options: ['Registros', 'Pozos'], clarificationId: 'cl-1', optionIds: ['o-1', 'o-2'], expiresAt: '2099-01-01T00:00:00Z' }),
      () => xlsxResponse(),
    ]);
    renderConsole('/chat');
    const user = await ask('¿Cuántos hay por estado?');
    await user.click(await screen.findByRole('button', { name: 'Pozos' }));
    expect(await screen.findByText('Tu reporte está listo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Descargar Excel/ })).toHaveAttribute('download', 'reporte-demo.xlsx');
    expect(seen).toHaveLength(2);
    expect(seen[0]!.body).toEqual({ request: '¿Cuántos hay por estado?', language: 'es', dataSource: 'demo' });
    expect(seen[1]!.body).toEqual({ clarification: { id: 'cl-1', option: 'o-2' }, language: 'es', dataSource: 'demo' });
    expect(seen[0]!.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(seen[1]!.key).not.toBe(seen[0]!.key);
  });

  it('F3/F4: shows the business explanation of a request that cannot be answered', async () => {
    record([() => HttpResponse.json({ status: 422, code: 'not_answerable', explanation: 'No existe una métrica aprobada para «ventas».' }, { status: 422 })]);
    renderConsole('/chat');
    await ask('¿Cuánto vendimos?');
    expect(await screen.findByText('No existe una métrica aprobada para «ventas».')).toBeInTheDocument();
  });

  it('an unknown outcome is retried with the same key and the same body', async () => {
    const seen = record([
      () => HttpResponse.json({ status: 504, code: 'bff_upstream_timeout', origin: 'bff', outcome: 'UNKNOWN' }, { status: 504 }),
      () => xlsxResponse(),
    ]);
    renderConsole('/chat');
    const user = await ask('Total de registros');
    await user.click(await screen.findByRole('button', { name: /Reintentar la misma solicitud/ }));
    expect(await screen.findByText('Tu reporte está listo')).toBeInTheDocument();
    expect(seen[1]!.key).toBe(seen[0]!.key);
    expect(seen[1]!.body).toEqual(seen[0]!.body);
  });

  it('an expired clarification reported by Intelligence asks for the question again', async () => {
    record([
      () => HttpResponse.json({ status: 'NEEDS_CLARIFICATION', question: '¿Cuál?', options: ['A', 'B'], clarificationId: 'cl-2', optionIds: ['a', 'b'], expiresAt: '2099-01-01T00:00:00Z' }),
      () => HttpResponse.json({ status: 502, code: 'compilation_failed', stage: 'COMPILATION', reason: 'CLARIFICATION_EXPIRED' }, { status: 502 }),
    ]);
    renderConsole('/chat');
    const user = await ask('Pregunta ambigua');
    await user.click(await screen.findByRole('button', { name: 'A' }));
    expect(await screen.findByText(/La aclaración caducó antes de tu respuesta/)).toBeInTheDocument();
  });

  it('the report stays in «Reportes de la sesión» with the session warning (D8)', async () => {
    record([() => xlsxResponse()]);
    renderConsole('/chat');
    const user = await ask('Total');
    await screen.findByText('Tu reporte está listo');
    await user.click(screen.getByRole('link', { name: /Reportes de la sesión/ }));
    await waitFor(() => expect(screen.getAllByText(/reporte-demo\.xlsx/).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/si cierras o recargas la página/).length).toBeGreaterThan(0);
  });

  it('DEC-D-FE-1: local_only and authentication_required get a neutral text; the cause only for diagnostics users', async () => {
    record([
      () => HttpResponse.json({ status: 403, code: 'local_only', title: 'This API only accepts requests from the local machine.', correlationId: 'corr-lo' }, { status: 403 }),
      () => HttpResponse.json({ status: 401, code: 'authentication_required', title: 'A valid bearer token is required.', correlationId: 'corr-ar' }, { status: 401 }),
    ]);
    renderConsole('/chat');
    const user = await ask('Total');
    expect(await screen.findByText(/no aceptó la solicitud de la consola/)).toBeInTheDocument();
    expect(screen.getByText(/corr-lo/)).toBeInTheDocument();
    expect(screen.queryByTestId('admin-hint')).toBeNull();
    expect(screen.queryByText(/local machine|trusted-clients/)).toBeNull();
    await user.type(screen.getByLabelText(/Escribe tu pregunta/), 'Otra');
    await user.click(screen.getByRole('button', { name: /Enviar/ }));
    expect(await screen.findByText(/no aceptó tu identificación/)).toBeInTheDocument();
    expect(screen.queryByTestId('admin-hint')).toBeNull();
    // the console session is still there (a service's 401 is not the end of the session)
    expect(screen.queryByText('Tu sesión terminó')).toBeNull();
  });

  it('DEC-D-FE-1: a PLATFORM_ADMIN sees the administrative cause of local_only', async () => {
    server.use(sessionHandler(session({ roles: ['REPORT_REQUESTER', 'PLATFORM_ADMIN'] }, { diagnostics: true })));
    record([() => HttpResponse.json({ status: 403, code: 'local_only', correlationId: 'corr-lo2' }, { status: 403 })]);
    renderConsole('/chat');
    await ask('Total');
    expect(await screen.findByTestId('admin-hint')).toHaveTextContent(/cliente confiable nexora-console/);
    expect(screen.getByText(/no aceptó la solicitud de la consola/)).toBeInTheDocument();
  });
});
