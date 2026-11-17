import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { DS, definition, page, session, sessionHandler } from '@/test/fixtures';
import { renderConsole } from '@/test/render';
import { server } from '@/test/server';

const base = `/bff/api/semantic/data-sources/${DS}`;

function serve(defs: ReturnType<typeof definition>[]) {
  const calls: { url: string; ifMatch: string | null; body: unknown }[] = [];
  server.use(
    http.get(`${base}/definitions`, () => HttpResponse.json(page(defs))),
    http.get(`${base}/definitions/:id`, ({ params }) => {
      const d = defs.find((x) => x.id === params.id);
      return d ? HttpResponse.json(d, { headers: { ETag: `"${d.version}"` } }) : HttpResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
    }),
    http.get('/bff/api/semantic/audit-events', () => HttpResponse.json(page([]))),
    http.post(`${base}/definitions/:id/:op`, async ({ request, params }) => {
      calls.push({ url: `${params.op}`, ifMatch: request.headers.get('If-Match'), body: await request.json().catch(() => undefined) });
      const d = defs.find((x) => x.id === params.id);
      const status = params.op === 'approve' ? 'APPROVED' : 'INACTIVE';
      return HttpResponse.json({ ...d, status, version: (d?.version ?? 0) + 1 }, { headers: { ETag: `"${(d?.version ?? 0) + 1}"` } });
    }),
  );
  return calls;
}

describe('semantic dictionary', () => {
  it('lists and searches definitions', async () => {
    serve([definition({ name: 'Pozo', key: 'pozo' }), definition({ name: 'Campo', key: 'campo', status: 'APPROVED', usable: true })]);
    renderConsole('/diccionario');
    expect(await screen.findByText('2 definiciones')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Buscar'), 'pozo');
    expect(await screen.findByText('1 definiciones')).toBeInTheDocument();
  });

  it('approves a DRAFT after confirmation, sending its ETag', async () => {
    const d = definition({ name: 'Borrador A', version: 4 });
    const calls = serve([d]);
    renderConsole(`/diccionario?id=${d.id}`);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Aprobar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Aprobar definición' });
    await user.click(within(dialog).getByRole('button', { name: 'Aprobar' }));
    await waitFor(() => expect(calls).toEqual([{ url: 'approve', ifMatch: '"4"', body: undefined }]));
  });

  it('D5: rejecting a DRAFT requires a reason and deactivates it', async () => {
    const d = definition({ name: 'Borrador B', version: 2 });
    const calls = serve([d]);
    renderConsole(`/diccionario?id=${d.id}`);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Rechazar borrador' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rechazar borrador' });
    const confirm = within(dialog).getByRole('button', { name: 'Rechazar borrador' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/Motivo/), 'Duplicada');
    await user.click(confirm);
    await waitFor(() => expect(calls).toEqual([{ url: 'deactivate', ifMatch: '"2"', body: { reason: 'Duplicada' } }]));
  });

  it('B4/D6: correcting an APPROVED definition needs the explicit confirmation of its consequences, then saves a DRAFT with If-Match', async () => {
    const d = definition({ name: 'Aprobada', status: 'APPROVED', usable: true, version: 7 });
    serve([d]);
    let put: { ifMatch: string | null; body: unknown } | undefined;
    server.use(
      http.get(`${base}/objects`, () => HttpResponse.json(page([]))),
      http.put(`${base}/definitions/:id`, async ({ request }) => {
        put = { ifMatch: request.headers.get('If-Match'), body: await request.json() };
        return HttpResponse.json({ ...d, name: 'Aprobada v2', status: 'DRAFT', usable: false, version: 8 }, { headers: { ETag: '"8"' } });
      }),
    );
    renderConsole(`/diccionario?id=${d.id}`);
    const user = userEvent.setup();
    expect(await screen.findByRole('button', { name: 'Retirar definición' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Eliminar|Borrar/i })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Corregir' }));
    const dialog = await screen.findByRole('dialog', { name: 'Corregir definición aprobada' });
    // the four consequences are stated before anything can be changed
    const consequences = within(dialog).getByTestId('correction-consequences');
    expect(consequences).toHaveTextContent('Volverá al estado Borrador');
    expect(consequences).toHaveTextContent('Dejará de estar disponible como elemento aprobado');
    expect(consequences).toHaveTextContent('STALE');
    expect(consequences).toHaveTextContent('Los archivos Excel generados anteriormente no cambiarán');
    const proceed = within(dialog).getByRole('button', { name: 'Continuar con la corrección' });
    expect(proceed).toBeDisabled();
    await user.click(within(dialog).getByLabelText('Entiendo las consecuencias y quiero corregirla'));
    await user.click(proceed);
    const form = await screen.findByRole('dialog', { name: 'Corregir definición aprobada' });
    expect(within(form).getByText(/vuelve a borrador/)).toBeInTheDocument();
    const nameInput = within(form).getByLabelText(/Nombre de negocio/);
    await user.clear(nameInput);
    await user.type(nameInput, 'Aprobada v2');
    await user.click(within(form).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(put).toBeDefined());
    expect(put?.ifMatch).toBe('"7"');
    expect(put?.body).toEqual({ name: 'Aprobada v2', description: 'Definición sintética de prueba', concept: { relationId: 'r-1' } });
  });

  it('B1: approving one\'s own draft warns that it will be recorded as self-approval; someone else\'s does not', async () => {
    const mine = definition({ name: 'Mía', createdBy: 'sub-ana', updatedBy: 'sub-ana' });
    const other = definition({ name: 'Ajena', createdBy: 'otra', updatedBy: 'otra' });
    serve([mine, other]);
    const user = userEvent.setup();
    const { unmount } = renderConsole(`/diccionario?id=${mine.id}`);
    await user.click(await screen.findByRole('button', { name: 'Aprobar' }));
    expect(await screen.findByTestId('self-approval')).toHaveTextContent('autoaprobación');
    // «You» instead of the identifier in the detail
    expect(screen.getAllByText(/^Tú ·/).length).toBeGreaterThan(0);
    unmount();
    renderConsole(`/diccionario?id=${other.id}`);
    await user.click(await screen.findByRole('button', { name: 'Aprobar' }));
    await screen.findByRole('dialog', { name: 'Aprobar definición' });
    expect(screen.queryByTestId('self-approval')).toBeNull();
  });

  it('creates a concept as a DRAFT with exactly the fields of CreateDefinitionRequest', async () => {
    let created: unknown;
    serve([]);
    server.use(
      http.get(`${base}/objects`, ({ request }) => {
        const type = new URL(request.url).searchParams.get('type');
        return HttpResponse.json(page(type === 'TABLE' ? [{ id: 'r-9', type: 'TABLE', naturalKey: 'demo.pedidos', status: 'ACTIVE' }] : []));
      }),
      http.post(`${base}/definitions`, async ({ request }) => {
        created = await request.json();
        return HttpResponse.json(definition({ id: 'd-created', name: 'Pedido' }), { status: 201, headers: { ETag: '"0"' } });
      }),
      http.get(`${base}/definitions/d-created`, () => HttpResponse.json(definition({ id: 'd-created', name: 'Pedido' }), { headers: { ETag: '"0"' } })),
    );
    renderConsole('/diccionario');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Nueva definición' }));
    const form = await screen.findByRole('dialog', { name: 'Nueva definición (borrador)' });
    await user.type(within(form).getByLabelText(/^Clave/), 'pedido');
    await user.type(within(form).getByLabelText(/Nombre de negocio/), 'Pedido');
    await user.click(within(form).getByRole('textbox', { name: /Tabla o vista/ }));
    await user.click(await screen.findByRole('option', { name: 'demo.pedidos' }));
    await user.click(within(form).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(created).toEqual({ kind: 'CONCEPT', key: 'pedido', name: 'Pedido', concept: { relationId: 'r-9' } }));
  });

  it('412: another person changed it: the console says so and offers to reload (no overwrite)', async () => {
    const d = definition({ name: 'Concurrida', version: 2 });
    serve([d]);
    server.use(http.post(`${base}/definitions/:id/approve`, () => HttpResponse.json({ status: 412, code: 'precondition_failed' }, { status: 412 })));
    renderConsole(`/diccionario?id=${d.id}`);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Aprobar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Aprobar definición' });
    await user.click(within(dialog).getByRole('button', { name: 'Aprobar' }));
    expect(await screen.findByText(/Otra persona modificó esta definición/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument();
  });

  it('422 definition_invalid: the specific problems of Semantic are listed', async () => {
    const d = definition({ name: 'Inválida', kind: 'METRIC', concept: null, metric: { conceptId: 'c-x', aggregation: 'COUNT' } });
    serve([d]);
    server.use(
      http.post(`${base}/definitions/:id/approve`, () =>
        HttpResponse.json(
          { status: 422, code: 'definition_invalid', errors: [{ code: 'CONCEPT_NOT_APPROVED', field: 'metric.conceptId', message: 'x' }] },
          { status: 422 },
        ),
      ),
    );
    renderConsole(`/diccionario?id=${d.id}`);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Aprobar' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Aprobar definición' })).getByRole('button', { name: 'Aprobar' }));
    expect(await screen.findByText('Semantic no puede aceptar esta definición todavía:')).toBeInTheDocument();
    expect(screen.getByText('El concepto todavía no está aprobado (metric.conceptId)')).toBeInTheDocument();
  });

  it('a reader (VIEWER) sees the detail but no action; history needs AUDITOR (D-C)', async () => {
    const d = definition({ name: 'Solo lectura', status: 'APPROVED', usable: true });
    serve([d]);
    server.use(sessionHandler(session({ roles: ['VIEWER'] }, { proposalWrite: false, approve: false, audit: false, chat: false })));
    renderConsole(`/diccionario?id=${d.id}`);
    const user = userEvent.setup();
    expect(await screen.findByText('Solo lectura', { selector: 'h2, .mantine-Drawer-title' })).toBeInTheDocument();
    for (const name of ['Corregir', 'Aprobar', 'Retirar definición', 'Nueva definición', 'Editar borrador']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
    await user.click(screen.getByRole('tab', { name: /Historial/ }));
    expect(await screen.findByText(/requiere el rol de auditoría/)).toBeInTheDocument();
  });
});
