import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { Relationship } from '@/api/semanticTypes';
import { COL_A1, COL_B1, DS, TABLE_A, TABLE_B, page, physical, relationship, session, sessionHandler } from '@/test/fixtures';
import { renderConsole } from '@/test/render';
import { server } from '@/test/server';

const base = `/bff/api/semantic/data-sources/${DS}`;

interface Call {
  method: string;
  path: string;
  ifMatch: string | null;
  body: unknown;
}

/** A small in-memory Semantic for relationships (synthetic data only). */
function serve(rels: Relationship[]) {
  const calls: Call[] = [];
  const record = async (request: Request, path: string) =>
    calls.push({ method: request.method, path, ifMatch: request.headers.get('If-Match'), body: await request.json().catch(() => undefined) });
  server.use(
    http.get(`${base}/relationships`, () => HttpResponse.json(page(rels))),
    http.get(`${base}/relationships/:id`, ({ params }) => {
      const r = rels.find((x) => x.id === params.id);
      return r ? HttpResponse.json(r, { headers: { ETag: `"${r.version}"` } }) : HttpResponse.json({ status: 404, code: 'not_found' }, { status: 404 });
    }),
    http.get('/bff/api/semantic/audit-events', () => HttpResponse.json(page([]))),
    http.get(`${base}/objects`, ({ request }) => {
      const q = new URL(request.url).searchParams;
      if (q.get('type') === 'TABLE') return HttpResponse.json(page([physical(TABLE_A, 'TABLE'), physical(TABLE_B, 'TABLE')]));
      if (q.get('type') === 'COLUMN' && q.get('parentId') === TABLE_A.objectId) return HttpResponse.json(page([physical(COL_A1, 'COLUMN', TABLE_A.objectId)]));
      if (q.get('type') === 'COLUMN' && q.get('parentId') === TABLE_B.objectId) return HttpResponse.json(page([physical(COL_B1, 'COLUMN', TABLE_B.objectId)]));
      return HttpResponse.json(page([]));
    }),
    http.post(`${base}/relationships`, async ({ request }) => {
      await record(request, 'create');
      const r = relationship({ id: 'r-new', name: 'Nueva' });
      rels.push(r);
      return HttpResponse.json(r, { status: 201, headers: { ETag: '"0"' } });
    }),
    http.post(`${base}/relationships/from-foreign-key`, async ({ request }) => {
      await record(request, 'from-foreign-key');
      const r = relationship({ id: 'r-fk', name: 'fk_pedidos_clientes', origin: 'DECLARED_FK' });
      rels.push(r);
      return HttpResponse.json(r, { status: 201, headers: { ETag: '"0"' } });
    }),
    http.put(`${base}/relationships/:id`, async ({ request, params }) => {
      await record(request, 'update');
      const r = rels.find((x) => x.id === params.id) as Relationship;
      return HttpResponse.json({ ...r, status: 'DRAFT', version: r.version + 1 }, { headers: { ETag: `"${r.version + 1}"` } });
    }),
    http.post(`${base}/relationships/:id/:op`, async ({ request, params }) => {
      await record(request, String(params.op));
      const r = rels.find((x) => x.id === params.id) as Relationship;
      const status = params.op === 'approve' ? 'APPROVED' : 'INACTIVE';
      return HttpResponse.json({ ...r, status, version: r.version + 1 }, { headers: { ETag: `"${r.version + 1}"` } });
    }),
  );
  return calls;
}

describe('semantic relationships (B3)', () => {
  it('lists, searches and filters relationships, under the dictionary tabs', async () => {
    serve([
      relationship({ name: 'Pedido de cliente' }),
      relationship({ name: 'Factura de pedido', source: { objectId: 'f', naturalKey: 'demo.facturas' }, status: 'APPROVED', usable: true, origin: 'DECLARED_FK' }),
    ]);
    renderConsole('/diccionario/relaciones');
    const user = userEvent.setup();
    expect(await screen.findByText('2 relaciones')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Relaciones/ })).toHaveAttribute('aria-current', 'page');
    await user.type(screen.getByLabelText('Buscar'), 'facturas');
    expect(await screen.findByText('1 relación')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Buscar'));
    await user.click(screen.getByRole('textbox', { name: 'Procedencia' }));
    await user.click(await screen.findByRole('option', { name: 'Definida por una persona' }));
    expect(await screen.findByText('1 relación')).toBeInTheDocument();
    expect(screen.getByText('Pedido de cliente')).toBeInTheDocument();
  });

  it('creates a manual relationship with exactly the fields of CreateRelationshipRequest', async () => {
    const calls = serve([]);
    renderConsole('/diccionario/relaciones');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Nueva relación' }));
    const form = await screen.findByRole('dialog', { name: 'Nueva relación (borrador)' });
    await user.type(within(form).getByLabelText(/Nombre de negocio/), 'Pedido de cliente');
    await user.click(within(form).getByRole('textbox', { name: /Tabla de origen/ }));
    await user.click(await screen.findByRole('option', { name: 'demo.pedidos' }));
    await user.click(within(form).getByRole('textbox', { name: /Tabla de destino/ }));
    await user.click(await screen.findByRole('option', { name: 'demo.clientes' }));
    await user.click(within(form).getByRole('textbox', { name: 'Columna de origen 1' }));
    await user.click(await screen.findByRole('option', { name: 'cliente_id' }));
    await user.click(within(form).getByRole('textbox', { name: 'Columna de destino 1' }));
    await user.click(await screen.findByRole('option', { name: 'id' }));
    await user.click(within(form).getByLabelText(/Conservar las filas de origen/));
    await user.click(within(form).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({ method: 'POST', path: 'create', ifMatch: null });
    expect(calls[0]?.body).toEqual({
      name: 'Pedido de cliente',
      sourceObjectId: TABLE_A.objectId,
      targetObjectId: TABLE_B.objectId,
      pairs: [{ sourceColumnId: COL_A1.objectId, targetColumnId: COL_B1.objectId }],
      declaredCardinality: 'MANY_TO_ONE',
      allowedJoinTypes: ['INNER', 'LEFT'],
    });
    // the created draft opens
    expect(await screen.findByRole('button', { name: 'Aprobar' })).toBeInTheDocument();
  });

  it('creates from a detected foreign key (candidate): CreateFromForeignKeyRequest, name optional', async () => {
    const calls = serve([]);
    server.use(
      http.get(`${base}/relationship-candidates`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('limit')).toBe('100');
        return HttpResponse.json({
          candidates: [{ source: TABLE_A, target: TABLE_B, pairs: [{ sourceColumn: COL_A1, targetColumn: COL_B1 }], suggestedOrigin: 'DECLARED_FK', foreignKeyId: 'fk-1', signals: [], heuristic: true, heuristicScore: 1 }],
          unresolvedForeignKeys: [],
          truncated: false,
          alreadyCataloged: 0,
        });
      }),
    );
    renderConsole('/diccionario/relaciones');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Nueva relación' }));
    const form = await screen.findByRole('dialog', { name: 'Nueva relación (borrador)' });
    await user.click(within(form).getByText('Desde claves foráneas o candidatas'));
    await user.click(within(form).getByRole('button', { name: 'Buscar candidatas' }));
    await user.click(await within(form).findByRole('button', { name: 'Usar: demo.pedidos → demo.clientes' }));
    expect(within(form).getByTestId('from-foreign-key')).toHaveTextContent('demo.pedidos → demo.clientes');
    await user.click(within(form).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({ path: 'from-foreign-key', body: { foreignKeyId: 'fk-1', declaredCardinality: 'MANY_TO_ONE', allowedJoinTypes: ['INNER'] } });
  });

  it('edits a DRAFT (only the editable fields, with If-Match), approves and rejects with a reason', async () => {
    const r = relationship({ name: 'Borrador R', version: 3 });
    const calls = serve([r]);
    renderConsole(`/diccionario/relaciones?id=${r.id}`);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Editar borrador' }));
    const form = await screen.findByRole('dialog', { name: 'Editar borrador de relación' });
    expect(within(form).getByTestId('immutable-structure')).toHaveTextContent('demo.pedidos → demo.clientes');
    await user.click(within(form).getByRole('textbox', { name: /Cardinalidad declarada/ }));
    await user.click(await screen.findByRole('option', { name: 'Uno a uno' }));
    await user.click(within(form).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({
      method: 'PUT',
      path: 'update',
      ifMatch: '"3"',
      body: { name: 'Borrador R', description: 'Relación sintética de prueba', declaredCardinality: 'ONE_TO_ONE', allowedJoinTypes: ['INNER'] },
    });
    await user.click(await screen.findByRole('button', { name: 'Aprobar' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Aprobar relación' })).getByRole('button', { name: 'Aprobar' }));
    await waitFor(() => expect(calls[1]).toMatchObject({ path: 'approve', ifMatch: '"3"' }));
    await user.click(screen.getByRole('button', { name: 'Rechazar borrador' }));
    const reject = await screen.findByRole('dialog', { name: 'Rechazar borrador de relación' });
    const confirm = within(reject).getByRole('button', { name: 'Rechazar borrador' });
    expect(confirm).toBeDisabled();
    await user.type(within(reject).getByLabelText(/Motivo/), 'Columnas equivocadas');
    await user.click(confirm);
    await waitFor(() => expect(calls[2]).toMatchObject({ path: 'deactivate', body: { reason: 'Columnas equivocadas' } }));
  });

  it('B4: correcting an APPROVED relationship requires confirming its consequences, then PUT with If-Match', async () => {
    const r = relationship({ name: 'Aprobada R', status: 'APPROVED', usable: true, version: 5 });
    const calls = serve([r]);
    renderConsole(`/diccionario/relaciones?id=${r.id}`);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Corregir' }));
    const dialog = await screen.findByRole('dialog', { name: 'Corregir relación aprobada' });
    expect(within(dialog).getByTestId('correction-consequences')).toHaveTextContent('Volverá al estado Borrador');
    expect(within(dialog).getByRole('button', { name: 'Continuar con la corrección' })).toBeDisabled();
    await user.click(within(dialog).getByLabelText('Entiendo las consecuencias y quiero corregirla'));
    await user.click(within(dialog).getByRole('button', { name: 'Continuar con la corrección' }));
    const form = await screen.findByRole('dialog', { name: 'Corregir relación aprobada' });
    await user.click(within(form).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(calls[0]).toMatchObject({ method: 'PUT', ifMatch: '"5"' }));
  });

  it('412 on approval: the console says another person changed it and offers to reload', async () => {
    const r = relationship({ name: 'Concurrida R' });
    serve([r]);
    server.use(http.post(`${base}/relationships/:id/approve`, () => HttpResponse.json({ status: 412, code: 'precondition_failed' }, { status: 412 })));
    renderConsole(`/diccionario/relaciones?id=${r.id}`);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Aprobar' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Aprobar relación' })).getByRole('button', { name: 'Aprobar' }));
    expect(await screen.findByText(/Otra persona modificó esta relación/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument();
  });

  it('409 relationship_equivalent_exists and 403 forbidden are explained in business words', async () => {
    const r = relationship({ name: 'Equivalente' });
    serve([r]);
    let answer = { status: 409, code: 'relationship_equivalent_exists' };
    server.use(http.post(`${base}/relationships/:id/approve`, () => HttpResponse.json(answer, { status: answer.status })));
    renderConsole(`/diccionario/relaciones?id=${r.id}`);
    const user = userEvent.setup();
    const approveOnce = async () => {
      await user.click(await screen.findByRole('button', { name: 'Aprobar' }));
      await user.click(within(await screen.findByRole('dialog', { name: 'Aprobar relación' })).getByRole('button', { name: 'Aprobar' }));
    };
    await approveOnce();
    expect(await screen.findByText('Ya existe otra relación (borrador o aprobada) que une las mismas columnas.')).toBeInTheDocument();
    answer = { status: 403, code: 'forbidden' };
    await user.click(within(await screen.findByRole('dialog', { name: 'Aprobar relación' })).getByRole('button', { name: 'Aprobar' }));
    expect(await screen.findByText('Tu cuenta no tiene permiso para esta acción.')).toBeInTheDocument();
  });

  it('a reader (VIEWER) sees relationships but no action (Semantic decides again on every call)', async () => {
    const r = relationship({ name: 'Visible' });
    serve([r]);
    server.use(sessionHandler(session({ roles: ['VIEWER'] }, { proposalWrite: false, approve: false, audit: false })));
    renderConsole(`/diccionario/relaciones?id=${r.id}`);
    expect(await screen.findByText('Une')).toBeInTheDocument();
    for (const name of ['Nueva relación', 'Editar borrador', 'Aprobar', 'Rechazar borrador']) expect(screen.queryByRole('button', { name })).toBeNull();
  });
});
