import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { KnowledgeIntent, Proposals } from '@/api/assisted';
import { DS, page, session, sessionHandler } from '@/test/fixtures';
import { renderConsole } from '@/test/render';
import { server } from '@/test/server';

const base = `/bff/api/semantic/data-sources/${DS}`;
const REQUEST = 'Quiero que Nexora pueda contar cuántos envíos tiene cada almacén';
const SHIPMENT = '20000000-0000-4000-8000-000000000001';
const WAREHOUSE = '20000000-0000-4000-8000-000000000002';
const PROPOSAL_ID = 'b'.repeat(64);

/** The interpretation Intelligence returns (synthetic): the concept by name, the dimension under other words. */
const INTENT: KnowledgeIntent = {
  format: 'nexora-knowledge-intent/1',
  dataSourceId: DS,
  language: 'es',
  request: REQUEST,
  contextFingerprint: 'c'.repeat(64),
  interpretation: {
    kind: 'KNOWLEDGE_REQUEST',
    operation: 'COUNT',
    entity: { words: 'envíos', conceptId: SHIPMENT },
    metric: null,
    groupings: [{ words: 'cada almacén', dimensionId: WAREHOUSE, columnId: null }],
    unresolved: [],
  },
};

const countProposal = {
  id: PROPOSAL_ID,
  kind: 'METRIC' as const,
  conceptId: SHIPMENT,
  conceptName: 'Envío',
  words: 'envíos',
  aggregation: 'COUNT',
  dimensionType: null,
  valueCategory: null,
  source: 'NEW' as const,
  suggestionId: null,
  pending: ['BUSINESS_NAME'],
  modelMapping: false,
  blocked: false,
  evidence: ['CONCEPT_APPROVED', 'COUNT_IN_REQUEST'],
};

const entity = { definitionId: SHIPMENT, kind: 'CONCEPT', name: 'Envío', status: 'APPROVED', role: 'ENTITY' as const, words: 'envíos', basis: 'NAMED_IN_REQUEST' };

const asking: Proposals = {
  status: 'NEEDS_CLARIFICATION',
  conceptId: SHIPMENT,
  reused: [entity],
  clarifications: [
    {
      id: 'grouping-0',
      topic: 'GROUPING',
      words: 'cada almacén',
      options: [
        { id: WAREHOUSE, name: 'Shipment warehouse', kind: 'DIMENSION', status: 'APPROVED', interpreted: true },
        { id: 'NONE', name: null, kind: null, status: null, interpreted: false },
      ],
    },
  ],
  proposals: [countProposal],
  notices: [],
  unresolved: [],
};

const proposing: Proposals = {
  ...asking,
  status: 'PROPOSAL',
  reused: [entity, { definitionId: WAREHOUSE, kind: 'DIMENSION', name: 'Shipment warehouse', status: 'APPROVED', role: 'GROUPING', words: 'cada almacén', basis: 'CHOSEN_BY_PERSON' }],
  clarifications: [],
};

const done: Proposals = { ...proposing, status: 'ALREADY_EXISTS', proposals: [], notices: ['DRAFT_NOT_APPROVED'] };

interface Recorded {
  path: string;
  body: Record<string, unknown>;
}

function serve(responses: Proposals[], options: { confirm?: () => Response; interpret?: () => Response } = {}) {
  const calls: Recorded[] = [];
  let next = 0;
  server.use(
    http.get(`${base}/definitions`, () => HttpResponse.json(page([]))),
    http.post('/bff/api/knowledge-requests', async ({ request }) => {
      calls.push({ path: 'interpret', body: (await request.json()) as Record<string, unknown> });
      return options.interpret ? options.interpret() : HttpResponse.json({ intent: INTENT, correlationId: 'c1' });
    }),
    http.post(`${base}/knowledge-proposals`, async ({ request }) => {
      calls.push({ path: 'propose', body: (await request.json()) as Record<string, unknown> });
      const r = responses[Math.min(next, responses.length - 1)];
      next += 1;
      return HttpResponse.json(r);
    }),
    http.post(`${base}/knowledge-proposals/confirm`, async ({ request }) => {
      calls.push({ path: 'confirm', body: (await request.json()) as Record<string, unknown> });
      return options.confirm
        ? options.confirm()
        : HttpResponse.json({ definition: { id: 'd-new', key: 'shipment-count', status: 'DRAFT' }, suggestion: { id: 's1' }, created: true }, { status: 201 });
    }),
  );
  return calls;
}

async function ask(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByRole('textbox', { name: /Tu petición/ }), REQUEST);
  await user.click(screen.getByRole('button', { name: 'Interpretar' }));
}

describe('F1: Crear con ayuda', () => {
  it('reuses what exists, asks what is unclear and saves one count as a draft with exactly the confirmation', async () => {
    const calls = serve([asking, proposing, done]);
    renderConsole('/diccionario/crear-con-ayuda');
    const user = userEvent.setup();
    await ask(user);

    // Intelligence gets the words, the language and the source alias; never ids.
    await waitFor(() => expect(calls.filter((c) => c.path === 'propose')).toHaveLength(1));
    expect(calls[0]).toEqual({ path: 'interpret', body: { request: REQUEST, language: 'es', dataSource: 'demo' } });
    expect(calls[1]?.body).toEqual({ intent: INTENT, answers: [] });

    const reused = await screen.findByTestId('assisted-reused');
    expect(within(reused).getByText('Envío')).toBeInTheDocument();
    const question = screen.getByRole('radiogroup', { name: /¿Qué quieres decir con «cada almacén»\?/ });
    expect(within(question).getByRole('radio', { name: /Shipment warehouse/ })).toBeInTheDocument();
    expect(within(question).getByRole('radio', { name: 'Ninguna de estas' })).toBeInTheDocument();
    expect(screen.queryByTestId('assisted-proposal')).not.toBeInTheDocument();
    const continueButton = screen.getByRole('button', { name: 'Continuar' });
    expect(continueButton).toBeDisabled();
    await user.click(within(question).getByRole('radio', { name: /Shipment warehouse/ }));
    await user.click(continueButton);

    await waitFor(() => expect(calls.filter((c) => c.path === 'propose')).toHaveLength(2));
    expect(calls[2]?.body).toEqual({ intent: INTENT, answers: [{ clarification: 'grouping-0', choice: WAREHOUSE }] });
    const card = await screen.findByTestId('assisted-proposal');
    expect(within(card).getByText('Nueva métrica que falta')).toBeInTheDocument();
    expect(within(card).getByTestId('assisted-explanation')).toHaveTextContent('Contará cada «Envío» una vez en cada grupo.');
    // The suggested name and description are templates with the person's words, editable and required.
    const name = within(card).getByRole('textbox', { name: /Nombre de negocio/ });
    expect(name).toHaveValue('Número de envíos');
    const description = within(card).getByRole('textbox', { name: /Descripción de negocio/ });
    expect(description).toHaveValue('Número de «Envío» en cada grupo. Cuenta cada «Envío» una vez.');
    const save = within(card).getByRole('button', { name: 'Guardar como borrador' });
    expect(save).toBeDisabled();
    await user.click(within(card).getByRole('checkbox', { name: /Confirmo que el nombre y la descripción/ }));
    await user.clear(name);
    await user.type(name, 'Número de envíos');
    await user.click(save);

    await waitFor(() => expect(calls.some((c) => c.path === 'confirm')).toBe(true));
    expect(calls.find((c) => c.path === 'confirm')?.body).toEqual({
      intent: INTENT,
      answers: [{ clarification: 'grouping-0', choice: WAREHOUSE }],
      proposal: PROPOSAL_ID,
      name: 'Número de envíos',
      description: 'Número de «Envío» en cada grupo. Cuenta cada «Envío» una vez.',
      acknowledgedPending: ['BUSINESS_NAME'],
      acknowledgedInterpretation: true,
    });
    const saved = await screen.findByTestId('assisted-saved');
    expect(within(saved).getByRole('link', { name: 'Ver en el diccionario' })).toHaveAttribute('href', '/diccionario?id=d-new');
    expect(saved).toHaveTextContent('No se usará en los reportes hasta que una persona autorizada lo apruebe.');
    // Asking again finds it: nothing more to create.
    expect(await screen.findByTestId('assisted-exists')).toBeInTheDocument();
    expect(screen.getByText(/Parte de lo que se reutiliza todavía es un borrador/)).toBeInTheDocument();
    // No key and no physical name anywhere.
    expect(document.body.textContent).not.toMatch(/shipment-count|columnId|conceptId/);
  });

  it('a grouping chosen by the model needs the explicit acknowledgement of the person', async () => {
    const dimension = {
      ...countProposal,
      id: 'd'.repeat(64),
      kind: 'DIMENSION' as const,
      words: 'por fecha de salida',
      aggregation: null,
      dimensionType: 'TEMPORAL',
      valueCategory: 'DATE',
      modelMapping: true,
      evidence: ['CONCEPT_APPROVED', 'MODEL_SELECTED_COLUMN'],
    };
    const calls = serve([{ ...proposing, proposals: [dimension] }]);
    renderConsole('/diccionario/crear-con-ayuda');
    const user = userEvent.setup();
    await ask(user);
    const card = await screen.findByTestId('assisted-proposal');
    expect(within(card).getByText('Nueva forma de agrupar que falta')).toBeInTheDocument();
    expect(within(card).getByTestId('assisted-explanation')).toHaveTextContent('Agrupará cada «Envío» según una fecha que Nexora relacionó con «por fecha de salida».');
    expect(within(card).getByRole('textbox', { name: /Descripción de negocio/ })).toHaveValue('Agrupa cada «Envío» según fecha de salida.');
    expect(within(card).getByRole('textbox', { name: /Nombre de negocio/ })).toHaveValue('Fecha de salida');
    await user.click(within(card).getByRole('checkbox', { name: /Confirmo que el nombre/ }));
    const save = within(card).getByRole('button', { name: 'Guardar como borrador' });
    expect(save).toBeDisabled();
    await user.click(within(card).getByRole('checkbox', { name: /Confirmo que «por fecha de salida» es lo que quiero decir/ }));
    await user.click(save);
    await waitFor(() => expect(calls.find((c) => c.path === 'confirm')?.body).toMatchObject({ acknowledgedInterpretation: true, proposal: 'd'.repeat(64) }));
  });

  it('explains problems of the interpretation and of the confirmation, and what cannot be created yet', async () => {
    serve([{ ...asking, status: 'UNSUPPORTED', reused: [entity], clarifications: [], proposals: [], notices: ['AGGREGATION_NOT_ASSISTED'] }], {
      interpret: () => HttpResponse.json({ status: 422, code: 'interpretation_failed' }, { status: 422, headers: { 'Content-Type': 'application/problem+json' } }),
    });
    renderConsole('/diccionario/crear-con-ayuda');
    const user = userEvent.setup();
    await ask(user);
    expect(await screen.findByText(/Nexora no logró interpretar tu petición con el conocimiento aprobado/)).toBeInTheDocument();

    server.use(http.post('/bff/api/knowledge-requests', () => HttpResponse.json({ intent: INTENT })));
    await user.click(screen.getByRole('button', { name: 'Interpretar' }));
    expect(await screen.findByText('Esto todavía no se puede crear con ayuda')).toBeInTheDocument();
    expect(screen.getAllByText('Las sumas y los promedios nuevos se crean en el modo avanzado.').length).toBeGreaterThan(0);
  });

  it('a proposal rejected before cannot be saved from here', async () => {
    serve([{ ...proposing, proposals: [{ ...countProposal, blocked: true }], notices: ['REJECTED_BEFORE'] }], {
      confirm: () => HttpResponse.json({ status: 409, code: 'assisted_proposal_blocked' }, { status: 409 }),
    });
    renderConsole('/diccionario/crear-con-ayuda');
    const user = userEvent.setup();
    await ask(user);
    const card = await screen.findByTestId('assisted-proposal');
    await user.click(within(card).getByRole('checkbox', { name: /Confirmo que el nombre/ }));
    expect(within(card).getByRole('button', { name: 'Guardar como borrador' })).toBeDisabled();
    expect(within(card).getByText(/Solo un revisor puede reabrirla desde Sugerencias/)).toBeInTheDocument();
  });

  it('only people who may propose knowledge see and reach it; the advanced editor stays', async () => {
    serve([asking]);
    renderConsole('/diccionario');
    expect(await screen.findByRole('link', { name: 'Crear con ayuda' })).toHaveAttribute('href', '/diccionario/crear-con-ayuda');
    expect(screen.getByRole('button', { name: 'Nueva definición' })).toBeInTheDocument();
  });

  it('a viewer sees neither the entry nor the page', async () => {
    server.use(sessionHandler(session({ roles: ['VIEWER'] }, { proposalWrite: false, approve: false, audit: false, chat: false })));
    serve([asking]);
    const { unmount } = renderConsole('/diccionario');
    expect(await screen.findByRole('heading', { name: 'Diccionario semántico' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Crear con ayuda' })).not.toBeInTheDocument();
    unmount();
    renderConsole('/diccionario/crear-con-ayuda');
    expect(await screen.findByText('No tienes permiso para usar esta sección.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /Tu petición/ })).not.toBeInTheDocument();
  });
});
