import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { COL_A1, COL_B1, DS, TABLE_A, TABLE_B, definition, page, physical, relationship, session, sessionHandler, suggestion } from '@/test/fixtures';
import { renderConsole } from '@/test/render';
import { server } from '@/test/server';

const base = `/bff/api/semantic/data-sources/${DS}`;

describe('suggestions', () => {
  it('D10: accepting always asks Semantic for a DRAFT and acknowledges the pending points', async () => {
    const s = suggestion({ kind: 'CONCEPT', suggestedKey: 'pozo', pending: ['BUSINESS_NAME'], definition: { relation: { objectId: 'r-1', naturalKey: 'demo.pozos' } } });
    let accepted: { body: unknown; ifMatch: string | null } | undefined;
    server.use(
      http.get(`${base}/suggestions`, () => HttpResponse.json(page([s]))),
      http.get(`${base}/suggestions/:id`, () => HttpResponse.json(s, { headers: { ETag: '"3"' } })),
      http.get(`${base}/suggestions/:id/history`, () => HttpResponse.json({ versions: [s] })),
      http.get(`${base}/definitions`, () => HttpResponse.json(page([]))),
      http.post(`${base}/suggestions/:id/accept-definition`, async ({ request }) => {
        accepted = { body: await request.json(), ifMatch: request.headers.get('If-Match') };
        return HttpResponse.json({ suggestion: { ...s, status: 'ACCEPTED' }, definition: { id: 'd-new' } });
      }),
      http.get(`${base}/definitions/d-new`, () => HttpResponse.json(definition({ id: 'd-new', name: 'Pozo' }), { headers: { ETag: '"1"' } })),
      http.get('/bff/api/semantic/audit-events', () => HttpResponse.json(page([]))),
    );
    renderConsole('/sugerencias');
    const user = userEvent.setup();
    await user.click(await screen.findByText('pozo'));
    await user.click(await screen.findByRole('button', { name: 'Aceptar como borrador' }));
    const dialog = await screen.findByRole('dialog', { name: 'Aceptar como borrador' });
    await user.type(within(dialog).getByLabelText(/Nombre de negocio/), 'Pozo');
    const accept = within(dialog).getByRole('button', { name: 'Aceptar como borrador' });
    expect(accept).toBeDisabled();
    await user.click(within(dialog).getByLabelText(/Confirmo los aspectos pendientes/));
    await user.click(accept);
    await waitFor(() => expect(accepted).toBeDefined());
    expect(accepted?.ifMatch).toBe('"3"');
    expect(accepted?.body).toEqual({ key: 'pozo', name: 'Pozo', acknowledgedPending: ['BUSINESS_NAME'], result: 'DRAFT' });
    // the console opens the created draft in the dictionary
    expect(await screen.findByRole('button', { name: 'Aprobar' })).toBeInTheDocument();
  });

  it('B3 / D-B: accepting a relationship suggestion always sends result DRAFT, the declaration and the pending points', async () => {
    const s = suggestion({
      id: 's-rel',
      kind: 'RELATIONSHIP',
      suggestedKey: null,
      pending: ['CARDINALITY_CONFIRMATION'],
      definition: null,
      relationship: { source: TABLE_A, target: TABLE_B, pairs: [{ sourceColumn: COL_A1, targetColumn: COL_B1 }], foreignKeyId: null, rule: 'SAME_NAME' },
    });
    let accepted: { body: unknown; ifMatch: string | null } | undefined;
    server.use(
      http.get(`${base}/suggestions`, () => HttpResponse.json(page([s]))),
      http.get(`${base}/suggestions/:id`, () => HttpResponse.json(s, { headers: { ETag: '"4"' } })),
      http.get(`${base}/suggestions/:id/history`, () => HttpResponse.json({ versions: [s] })),
      http.get('/bff/api/semantic/audit-events', () => HttpResponse.json(page([]))),
      http.post(`${base}/suggestions/:id/accept`, async ({ request }) => {
        accepted = { body: await request.json(), ifMatch: request.headers.get('If-Match') };
        return HttpResponse.json({ suggestion: { ...s, status: 'ACCEPTED' }, relationship: { id: 'r-acc', status: 'DRAFT', origin: 'SEMANTIC', version: 0 } });
      }),
      http.get(`${base}/relationships/r-acc`, () => HttpResponse.json(relationship({ id: 'r-acc', name: 'Pedido de cliente' }), { headers: { ETag: '"0"' } })),
      http.get(`${base}/relationships`, () => HttpResponse.json(page([]))),
    );
    renderConsole('/sugerencias');
    const user = userEvent.setup();
    await user.click(await screen.findByText('demo.pedidos → demo.clientes'));
    expect(await screen.findByTestId('relationship-content')).toHaveTextContent('demo.pedidos.cliente_id = demo.clientes.id');
    await user.click(screen.getByRole('button', { name: 'Aceptar como borrador' }));
    const dialog = await screen.findByRole('dialog', { name: 'Aceptar relación como borrador' });
    const accept = within(dialog).getByRole('button', { name: 'Aceptar como borrador' });
    expect(accept).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/Nombre de negocio/), 'Pedido de cliente');
    await user.click(within(dialog).getByLabelText(/Confirmo los aspectos pendientes/));
    await user.click(accept);
    await waitFor(() => expect(accepted).toBeDefined());
    expect(accepted?.ifMatch).toBe('"4"');
    expect(accepted?.body).toEqual({
      name: 'Pedido de cliente',
      declaredCardinality: 'MANY_TO_ONE',
      allowedJoinTypes: ['INNER'],
      acknowledgedPending: ['CARDINALITY_CONFIRMATION'],
      result: 'DRAFT',
    });
    // the created relationship opens in the Relationships section
    expect(await screen.findByRole('link', { name: /Relaciones/ })).toHaveAttribute('aria-current', 'page');
  });

  it('B3: a relationship suggestion can be corrected (target and pairs; the source stays), still as a DRAFT', async () => {
    const TABLE_C = { objectId: '20000000-0000-4000-8000-00000000000c', naturalKey: 'demo.cuentas' };
    const COL_C1 = { objectId: '30000000-0000-4000-8000-0000000000c1', naturalKey: 'demo.cuentas.codigo' };
    const s = suggestion({ id: 's-rel2', kind: 'RELATIONSHIP', suggestedKey: null, pending: [], definition: null,
      relationship: { source: TABLE_A, target: TABLE_B, pairs: [{ sourceColumn: COL_A1, targetColumn: COL_B1 }], foreignKeyId: null, rule: 'SAME_NAME' } });
    let body: unknown;
    server.use(
      http.get(`${base}/suggestions`, () => HttpResponse.json(page([s]))),
      http.get(`${base}/suggestions/:id`, () => HttpResponse.json(s, { headers: { ETag: '"2"' } })),
      http.get(`${base}/suggestions/:id/history`, () => HttpResponse.json({ versions: [s] })),
      http.get('/bff/api/semantic/audit-events', () => HttpResponse.json(page([]))),
      http.get(`${base}/objects`, ({ request }) => {
        const q = new URL(request.url).searchParams;
        if (q.get('type') === 'TABLE') return HttpResponse.json(page([physical(TABLE_A, 'TABLE'), physical(TABLE_B, 'TABLE'), physical(TABLE_C, 'TABLE')]));
        if (q.get('parentId') === TABLE_A.objectId) return HttpResponse.json(page([physical(COL_A1, 'COLUMN', TABLE_A.objectId)]));
        if (q.get('parentId') === TABLE_C.objectId) return HttpResponse.json(page([physical(COL_C1, 'COLUMN', TABLE_C.objectId)]));
        return HttpResponse.json(page([]));
      }),
      http.post(`${base}/suggestions/:id/accept`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ suggestion: { ...s, status: 'ACCEPTED' }, relationship: null });
      }),
    );
    renderConsole('/sugerencias');
    const user = userEvent.setup();
    await user.click(await screen.findByText('demo.pedidos → demo.clientes'));
    await user.click(await screen.findByRole('button', { name: 'Aceptar como borrador' }));
    const dialog = await screen.findByRole('dialog', { name: 'Aceptar relación como borrador' });
    await user.type(within(dialog).getByLabelText(/Nombre de negocio/), 'Pedido de cuenta');
    await user.click(within(dialog).getByLabelText(/Corregir el destino o las columnas/));
    const correction = within(dialog).getByTestId('relationship-correction');
    expect(correction).toHaveTextContent('demo.pedidos');
    await user.click(within(correction).getByRole('textbox', { name: /Tabla de destino/ }));
    await user.click(await screen.findByRole('option', { name: 'demo.cuentas' }));
    await user.click(within(correction).getByRole('textbox', { name: 'Columna de destino 1' }));
    await user.click(await screen.findByRole('option', { name: 'codigo' }));
    await user.click(within(dialog).getByRole('button', { name: 'Aceptar como borrador' }));
    await waitFor(() => expect(body).toBeDefined());
    expect(body).toEqual({
      name: 'Pedido de cuenta',
      declaredCardinality: 'MANY_TO_ONE',
      allowedJoinTypes: ['INNER'],
      correction: { targetObjectId: TABLE_C.objectId, pairs: [{ sourceColumnId: COL_A1.objectId, targetColumnId: COL_C1.objectId }] },
      result: 'DRAFT',
    });
  });

  it('B1: a metric is accepted with a concept OF ITS TABLE only (preselected when it is the only one)', async () => {
    const own = definition({ id: 'c-own', name: 'Pedido', kind: 'CONCEPT', concept: { relationId: 'r-1', relationNaturalKey: 'demo.tabla_a' } });
    const other = definition({ id: 'c-other', name: 'Cliente', kind: 'CONCEPT', concept: { relationId: 'r-2', relationNaturalKey: 'demo.tabla_b' } });
    const s = suggestion({ id: 's-met', kind: 'METRIC', pending: [] });
    let body: unknown;
    server.use(
      http.get(`${base}/suggestions`, () => HttpResponse.json(page([s]))),
      http.get(`${base}/suggestions/:id`, () => HttpResponse.json(s, { headers: { ETag: '"3"' } })),
      http.get(`${base}/suggestions/:id/history`, () => HttpResponse.json({ versions: [s] })),
      http.get('/bff/api/semantic/audit-events', () => HttpResponse.json(page([]))),
      http.get(`${base}/definitions`, () => HttpResponse.json(page([own, other]))),
      http.post(`${base}/suggestions/:id/accept-definition`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ suggestion: { ...s, status: 'ACCEPTED' }, definition: null });
      }),
    );
    renderConsole('/sugerencias');
    const user = userEvent.setup();
    await user.click(await screen.findByText('importe-total'));
    await user.click(await screen.findByRole('button', { name: 'Aceptar como borrador' }));
    const dialog = await screen.findByRole('dialog', { name: 'Aceptar como borrador' });
    const conceptBox = within(dialog).getByRole('textbox', { name: /Concepto/ });
    await waitFor(() => expect(conceptBox).toHaveValue('Pedido (Borrador)'));
    await user.click(conceptBox);
    expect(screen.queryByRole('option', { name: /Cliente/ })).toBeNull();
    await user.keyboard('{Escape}');
    await user.type(within(dialog).getByLabelText(/Nombre de negocio/), 'Importe total');
    await user.click(within(dialog).getByRole('button', { name: 'Aceptar como borrador' }));
    await waitFor(() => expect(body).toEqual({ key: 'importe-total', name: 'Importe total', conceptId: 'c-own', result: 'DRAFT' }));
  });

  it('B1: a dimension can be corrected (type only when it changes; granularities and time zone for TEMPORAL)', async () => {
    const concept = definition({ id: 'c-own', kind: 'CONCEPT', concept: { relationId: 'r-1', relationNaturalKey: 'demo.tabla_a' } });
    const s = suggestion({
      id: 's-dim', kind: 'DIMENSION', suggestedKey: 'fecha', pending: ['VALUE_DISTRIBUTION_UNKNOWN'],
      definition: { relation: { objectId: 'r-1', naturalKey: 'demo.tabla_a' }, column: { objectId: 'c-9', naturalKey: 'demo.tabla_a.fecha' }, dimensionType: 'CATEGORICAL' },
    });
    let body: unknown;
    server.use(
      http.get(`${base}/suggestions`, () => HttpResponse.json(page([s]))),
      http.get(`${base}/suggestions/:id`, () => HttpResponse.json(s, { headers: { ETag: '"1"' } })),
      http.get(`${base}/suggestions/:id/history`, () => HttpResponse.json({ versions: [s] })),
      http.get('/bff/api/semantic/audit-events', () => HttpResponse.json(page([]))),
      http.get(`${base}/definitions`, () => HttpResponse.json(page([concept]))),
      http.post(`${base}/suggestions/:id/accept-definition`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ suggestion: { ...s, status: 'ACCEPTED' }, definition: null });
      }),
    );
    renderConsole('/sugerencias');
    const user = userEvent.setup();
    await user.click(await screen.findByText('fecha'));
    expect(await screen.findByText(/agrupar por esta columna tiene sentido/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Aceptar como borrador' }));
    const dialog = await screen.findByRole('dialog', { name: 'Aceptar como borrador' });
    await user.type(within(dialog).getByLabelText(/Nombre de negocio/), 'Fecha');
    await user.click(within(dialog).getByRole('textbox', { name: /Tipo de dimensión/ }));
    await user.click(await screen.findByRole('option', { name: /Temporal/ }));
    await user.click(within(dialog).getByLabelText('Mes'));
    await user.type(within(dialog).getByLabelText(/Zona horaria/), 'America/Toronto');
    await user.click(within(dialog).getByLabelText(/Confirmo los aspectos pendientes/));
    await user.click(within(dialog).getByRole('button', { name: 'Aceptar como borrador' }));
    await waitFor(() =>
      expect(body).toEqual({
        key: 'fecha',
        name: 'Fecha',
        conceptId: 'c-own',
        dimensionType: 'TEMPORAL',
        granularities: ['MONTH'],
        timeZone: 'America/Toronto',
        acknowledgedPending: ['VALUE_DISTRIBUTION_UNKNOWN'],
        result: 'DRAFT',
      }),
    );
  });

  it('B1: rejecting a suggestion accepts a reason up to 2000 characters (Semantic RejectRequest)', async () => {
    const s = suggestion({ id: 's-rej', kind: 'CONCEPT', suggestedKey: 'tabla-log', pending: [] });
    let body: { reason?: string } | undefined;
    server.use(
      http.get(`${base}/suggestions`, () => HttpResponse.json(page([s]))),
      http.get(`${base}/suggestions/:id`, () => HttpResponse.json(s, { headers: { ETag: '"1"' } })),
      http.get(`${base}/suggestions/:id/history`, () => HttpResponse.json({ versions: [s] })),
      http.get('/bff/api/semantic/audit-events', () => HttpResponse.json(page([]))),
      http.post(`${base}/suggestions/:id/reject`, async ({ request }) => {
        body = (await request.json()) as { reason?: string };
        return HttpResponse.json({ ...s, status: 'REJECTED' });
      }),
    );
    renderConsole('/sugerencias');
    const user = userEvent.setup();
    await user.click(await screen.findByText('tabla-log'));
    await user.click(await screen.findByRole('button', { name: 'Rechazar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rechazar sugerencia' });
    const reason = within(dialog).getByLabelText(/Motivo/);
    expect(reason).toHaveAttribute('maxlength', '2000');
    const long = 'x'.repeat(1200);
    await user.click(reason);
    await user.paste(long);
    await user.click(within(dialog).getByRole('button', { name: 'Rechazar' }));
    await waitFor(() => expect(body?.reason).toHaveLength(1200));
  });

  it('D-C / B2: the audit history of a suggestion only for AUDIT_READ; the decision says «You» for one\'s own', async () => {
    const s = suggestion({ id: 's-hist', kind: 'CONCEPT', status: 'ACCEPTED', suggestedKey: 'pozo', pending: [],
      decision: { decidedBy: { id: 'sub-ana', type: 'HUMAN' }, resultMode: 'DRAFT', resultDefinitionId: 'd-1' } });
    let auditCalls = 0;
    server.use(
      http.get(`${base}/suggestions`, () => HttpResponse.json(page([s]))),
      http.get(`${base}/suggestions/:id`, () => HttpResponse.json(s, { headers: { ETag: '"1"' } })),
      http.get(`${base}/suggestions/:id/history`, () => HttpResponse.json({ versions: [s] })),
      http.get('/bff/api/semantic/audit-events', ({ request }) => {
        auditCalls += 1;
        expect(new URL(request.url).searchParams.get('targetType')).toBe('SEMANTIC_SUGGESTION');
        return HttpResponse.json(page([{ id: 'e1', occurredAt: '2026-01-01T10:00:00Z', actorId: 'sub-ana', actorType: 'HUMAN', action: 'SUGGESTION_ACCEPTED', targetType: 'SEMANTIC_SUGGESTION', targetId: 's-hist', details: { resultMode: 'DRAFT' } }]));
      }),
    );
    const user = userEvent.setup();
    const { unmount } = renderConsole('/sugerencias');
    await user.click(await screen.findByText('pozo'));
    expect(await screen.findByText('Sugerencia aceptada')).toBeInTheDocument();
    expect(screen.getByText(/Tú · creó un borrador/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir la definición creada' })).toBeInTheDocument();
    unmount();
    const before = auditCalls;
    server.use(sessionHandler(session({}, { audit: false })));
    renderConsole('/sugerencias');
    await user.click(await screen.findByText('pozo'));
    expect(await screen.findByText(/requiere el rol de auditoría/)).toBeInTheDocument();
    expect(auditCalls).toBe(before);
  });
});
