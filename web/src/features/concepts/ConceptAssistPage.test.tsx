import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { ConceptMatch, ConceptProposals } from '@/api/concepts';
import type { KnowledgeIntent, Proposals } from '@/api/assisted';
import { DS, page, session, sessionHandler } from '@/test/fixtures';
import { renderConsole } from '@/test/render';
import { server } from '@/test/server';

const base = `/bff/api/semantic/data-sources/${DS}`;
const REQUEST = 'Quiero que Nexora conozca los equipos de nuestra planta';
const EQUIPMENT = '30000000-0000-4000-8000-000000000001';
const SENSORS = '30000000-0000-4000-8000-000000000002';
const SENSOR_CONCEPT = '30000000-0000-4000-8000-0000000000c1';
const PROPOSAL = 'e'.repeat(64);

/** The interpretation Intelligence returns (synthetic): the person's words and the tables the model related. */
const MATCH: ConceptMatch = {
  format: 'nexora-concept-match/1',
  dataSourceId: DS,
  language: 'es',
  request: REQUEST,
  contextFingerprint: 'f'.repeat(64),
  interpretation: { kind: 'CONCEPT_REQUEST', words: 'equipos', relationIds: [EQUIPMENT, SENSORS] },
};

const equipment = {
  relationId: EQUIPMENT,
  proposalId: PROPOSAL,
  relevance: 'HIGH',
  known: 'NEW' as const,
  knownId: null,
  knownName: null,
  inferred: ['MODEL_SELECTED' as const],
  verified: [
    { fact: 'IMPORTED' as const, count: 1, conceptId: null, conceptName: null },
    { fact: 'PRIMARY_KEY' as const, count: 1, conceptId: null, conceptName: null },
    { fact: 'REFERENCED_BY_CONCEPT' as const, count: 1, conceptId: SENSOR_CONCEPT, conceptName: 'Sensor' },
    { fact: 'NUMBER_COLUMNS' as const, count: 2, conceptId: null, conceptName: null },
    { fact: 'TEXT_COLUMNS' as const, count: 1, conceptId: null, conceptName: null },
  ],
};

const sensors = {
  ...equipment,
  relationId: SENSORS,
  proposalId: 'a'.repeat(64),
  known: 'CONCEPT_EXISTS' as const,
  knownId: SENSOR_CONCEPT,
  knownName: 'Sensor',
  verified: [{ fact: 'IMPORTED' as const, count: 1, conceptId: null, conceptName: null }],
};

const candidates: ConceptProposals = { status: 'CANDIDATES', words: 'equipos', named: [], candidates: [equipment, sensors], omitted: 0, notices: [] };
const known: ConceptProposals = {
  status: 'ALREADY_KNOWN',
  words: 'equipos',
  named: [{ id: 'd-new', name: 'Equipos', status: 'DRAFT' }],
  candidates: [{ ...equipment, known: 'CONCEPT_EXISTS', knownId: 'd-new', knownName: 'Equipos' }],
  omitted: 0,
  notices: [],
};

type Recorded = { path: string; body: Record<string, unknown> };

function serve(responses: ConceptProposals[], options: { interpret?: () => Response } = {}) {
  const calls: Recorded[] = [];
  let next = 0;
  server.use(
    http.get(`${base}/definitions`, () => HttpResponse.json(page([]))),
    http.post('/bff/api/knowledge-requests/concept-candidates', async ({ request }) => {
      calls.push({ path: 'interpret', body: (await request.json()) as Record<string, unknown> });
      return options.interpret ? options.interpret() : HttpResponse.json({ match: MATCH, correlationId: 'c1' });
    }),
    http.post(`${base}/concept-proposals`, async ({ request }) => {
      calls.push({ path: 'propose', body: (await request.json()) as Record<string, unknown> });
      const r = responses[Math.min(next, responses.length - 1)];
      next += 1;
      return HttpResponse.json(r);
    }),
    http.post(`${base}/concept-proposals/confirm`, async ({ request }) => {
      calls.push({ path: 'confirm', body: (await request.json()) as Record<string, unknown> });
      return HttpResponse.json({ definition: { id: 'd-new', key: 'equipos', status: 'DRAFT' }, suggestion: { id: 's1' }, created: true }, { status: 201 });
    }),
  );
  return calls;
}

async function search(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByRole('textbox', { name: /Tu petición/ }), REQUEST);
  await user.click(screen.getByRole('button', { name: 'Buscar' }));
}

describe('F2: Enseñar un concepto nuevo', () => {
  it('shows what is verified apart from what is inferred, asks the person to choose and saves one draft concept', async () => {
    server.use(sessionHandler(session({ roles: ['EDITOR'] }, { approve: false })));
    const calls = serve([candidates, known]);
    renderConsole('/diccionario/nuevo-concepto');
    const user = userEvent.setup();
    await search(user);

    await waitFor(() => expect(calls.filter((c) => c.path === 'propose')).toHaveLength(1));
    expect(calls[0]).toEqual({ path: 'interpret', body: { request: REQUEST, language: 'es', dataSource: 'demo' } });
    expect(calls[1]?.body).toEqual({ match: MATCH });

    const options = await screen.findAllByTestId('concepts-candidate');
    expect(options).toHaveLength(2);
    const first = options[0]!;
    expect(within(first).getByText('Comprobado')).toBeInTheDocument();
    expect(within(first).getByText('Suposición')).toBeInTheDocument();
    const facts = within(first).getByTestId('concepts-facts');
    expect(facts).toHaveTextContent('Es una tabla de la fuente de datos.');
    expect(facts).toHaveTextContent('Cada registro se distingue de los demás.');
    expect(facts).toHaveTextContent('Cada «Sensor» apunta a uno de estos.');
    expect(facts).toHaveTextContent('Datos habilitados: 2 números, 1 texto.');
    expect(within(first).getByTestId('concepts-inferences')).toHaveTextContent('El asistente de Nexora relacionó tus palabras con estos datos.');
    // An editor never sees the technical name; an existing concept cannot be chosen again.
    expect(screen.queryByText('Detalle para especialistas')).not.toBeInTheDocument();
    expect(within(options[1]!).getByRole('radio')).toBeDisabled();
    expect(within(options[1]!).getByText(/Ya existe como «Sensor»/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Ninguna de estas' })).toBeInTheDocument();

    await user.click(within(first).getByRole('radio', { name: 'Opción 1' }));
    const form = await screen.findByTestId('concepts-form');
    const name = within(form).getByRole('textbox', { name: /Nombre de negocio/ });
    expect(name).toHaveValue('Equipos');
    expect(within(form).getByRole('textbox', { name: /Descripción de negocio/ })).toHaveValue('Cada uno de los «equipos» del negocio.');
    const save = within(form).getByRole('button', { name: 'Guardar como borrador' });
    expect(save).toBeDisabled();
    await user.clear(name);
    await user.type(name, 'Equipo');
    await user.click(within(form).getByRole('checkbox', { name: /Confirmo que la opción elegida corresponde a «equipos»/ }));
    await user.click(save);

    await waitFor(() => expect(calls.some((c) => c.path === 'confirm')).toBe(true));
    expect(calls.find((c) => c.path === 'confirm')?.body).toEqual({
      match: MATCH,
      relationId: EQUIPMENT,
      proposal: PROPOSAL,
      name: 'Equipo',
      description: 'Cada uno de los «equipos» del negocio.',
      acknowledgedInference: true,
      acknowledgedNotKnown: false,
    });
    const saved = await screen.findByTestId('concepts-saved');
    expect(within(saved).getByRole('link', { name: 'Ver en el diccionario' })).toHaveAttribute('href', '/diccionario?id=d-new');
    expect(saved).toHaveTextContent('No se usará en los reportes hasta que una persona autorizada lo apruebe.');
    // Asking again: Nexora knows it now.
    expect(await screen.findByTestId('concepts-known')).toHaveTextContent('Equipos');
    // No physical name, key or identifier anywhere.
    expect(document.body.textContent).not.toMatch(/relationId|30000000|eqp_|\bplant\b/);
  });

  it('«Ninguna de estas» creates nothing; a known name needs «No es esto» before choosing', async () => {
    const calls = serve([candidates]);
    renderConsole('/diccionario/nuevo-concepto');
    const user = userEvent.setup();
    await search(user);
    await user.click(await screen.findByRole('radio', { name: 'Ninguna de estas' }));
    expect(await screen.findByTestId('concepts-none')).toHaveTextContent('No se creará nada.');
    expect(screen.queryByTestId('concepts-form')).not.toBeInTheDocument();
    expect(calls.some((c) => c.path === 'confirm')).toBe(false);

    const again = serve([{ ...known, candidates: [{ ...equipment }] }]);
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    const box = await screen.findByTestId('concepts-known');
    expect(box).toHaveTextContent('Nexora ya conoce algo con ese nombre');
    expect(screen.queryByTestId('concepts-candidate')).not.toBeInTheDocument();
    await user.click(within(box).getByRole('checkbox', { name: 'No es esto: me refiero a otra cosa' }));
    await user.click(await screen.findByRole('radio', { name: 'Opción 1' }));
    const form = await screen.findByTestId('concepts-form');
    await user.click(within(form).getByRole('checkbox', { name: /Confirmo que la opción elegida/ }));
    await user.click(within(form).getByRole('button', { name: 'Guardar como borrador' }));
    await waitFor(() => expect(again.find((c) => c.path === 'confirm')?.body).toMatchObject({ acknowledgedNotKnown: true }));
  });

  it('explains when nothing corresponds, when the function is off and gives the technical detail only to approvers', async () => {
    serve([{ ...candidates, status: 'NOT_FOUND', candidates: [] }]);
    renderConsole('/diccionario/nuevo-concepto');
    const user = userEvent.setup();
    await search(user);
    expect(await screen.findByTestId('concepts-not-found')).toHaveTextContent('Puede que un administrador tenga que habilitar más datos');

    serve([candidates], { interpret: () => HttpResponse.json({ status: 404, code: 'not_found' }, { status: 404, headers: { 'Content-Type': 'application/problem+json' } }) });
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByText('Esta función no está activada')).toBeInTheDocument();

    serve([{ ...candidates, candidates: [{ ...equipment, technicalName: 'equipment' }] }]);
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await user.click(await screen.findByRole('button', { name: 'Detalle para especialistas' }));
    expect(await screen.findByTestId('concepts-technical')).toHaveTextContent('Nombre técnico: equipment');
  });

  it('F1 offers to teach the concept when the entity is not known, with the request', async () => {
    const intent: KnowledgeIntent = {
      format: 'nexora-knowledge-intent/1',
      dataSourceId: DS,
      language: 'es',
      request: 'Quiero contar los equipos de cada planta',
      contextFingerprint: 'c'.repeat(64),
      interpretation: { kind: 'KNOWLEDGE_REQUEST', operation: 'COUNT', entity: { words: 'equipos', conceptId: null }, metric: null, groupings: [], unresolved: [] },
    };
    const notUnderstood: Proposals = { status: 'NOT_UNDERSTOOD', conceptId: null, reused: [], clarifications: [], proposals: [], notices: [], unresolved: [] };
    server.use(
      http.get(`${base}/definitions`, () => HttpResponse.json(page([]))),
      http.post('/bff/api/knowledge-requests', () => HttpResponse.json({ intent })),
      http.post(`${base}/knowledge-proposals`, () => HttpResponse.json(notUnderstood)),
    );
    renderConsole('/diccionario/crear-con-ayuda');
    const user = userEvent.setup();
    await user.type(await screen.findByRole('textbox', { name: /Tu petición/ }), intent.request);
    await user.click(screen.getByRole('button', { name: 'Interpretar' }));
    const entry = await screen.findByTestId('assisted-new-concept');
    expect(within(entry).getByRole('link', { name: 'Enseñar un concepto nuevo' })).toHaveAttribute(
      'href',
      `/diccionario/nuevo-concepto?peticion=${encodeURIComponent(intent.request)}`,
    );
  });

  it('a viewer cannot reach it', async () => {
    server.use(sessionHandler(session({ roles: ['VIEWER'] }, { proposalWrite: false, approve: false, audit: false, chat: false })));
    serve([candidates]);
    renderConsole('/diccionario/nuevo-concepto');
    expect(await screen.findByText('No tienes permiso para usar esta sección.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /Tu petición/ })).not.toBeInTheDocument();
  });
});
