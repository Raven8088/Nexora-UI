import { z } from 'zod';
import { json } from './http';

/**
 * F1 — assisted creation of knowledge (AD-ASIS-1…6). Three calls, all through the BFF with the person's session:
 *
 * 1. `POST /bff/api/knowledge-requests` → Nexora Intelligence interprets the person's words against the closed
 *    catalog and answers `nexora-knowledge-intent/1` (ids and the person's own words; nothing is created).
 * 2. `POST …/knowledge-proposals` → Semantic decides what exists, what is missing and what to ask (reads only).
 * 3. `POST …/knowledge-proposals/confirm` → Semantic saves ONE proposal as a DRAFT (never approved), linked to an
 *    assisted suggestion.
 *
 * The console only presents: it never decides kinds, equivalences or references, and never sees physical names.
 */

const nullableString = z.string().nullish();

/** `nexora-knowledge-intent/1`, kept as Intelligence wrote it and sent back unchanged to Semantic. */
export const knowledgeIntentSchema = z
  .object({
    format: z.literal('nexora-knowledge-intent/1'),
    dataSourceId: z.string(),
    language: z.string(),
    request: z.string(),
    contextFingerprint: z.string(),
    interpretation: z
      .object({
        kind: z.enum(['KNOWLEDGE_REQUEST', 'OTHER']),
        operation: z.enum(['COUNT', 'SUM', 'AVG']).nullable(),
        entity: z.object({ words: z.string(), conceptId: z.string().nullable() }).nullable(),
        metric: z.object({ words: z.string(), definitionId: z.string().nullable() }).nullable(),
        groupings: z.array(
          z.object({ words: z.string(), dimensionId: z.string().nullable(), columnId: z.string().nullable() }),
        ),
        unresolved: z.array(z.string()),
      })
      .strict(),
  })
  .strict();
export type KnowledgeIntent = z.infer<typeof knowledgeIntentSchema>;

export const PROPOSAL_STATUSES = ['PROPOSAL', 'NEEDS_CLARIFICATION', 'ALREADY_EXISTS', 'UNSUPPORTED', 'NOT_UNDERSTOOD'] as const;

const optionSchema = z.object({
  id: z.string(),
  name: nullableString,
  kind: nullableString,
  status: nullableString,
  interpreted: z.boolean(),
});

export const proposalsSchema = z.object({
  status: z.enum(PROPOSAL_STATUSES),
  conceptId: nullableString,
  reused: z.array(
    z.object({
      definitionId: z.string(),
      kind: z.string(),
      name: z.string(),
      status: z.string(),
      role: z.enum(['ENTITY', 'MEASURE', 'GROUPING']),
      words: nullableString,
      basis: z.string(),
    }),
  ),
  clarifications: z.array(
    z.object({
      id: z.string(),
      topic: z.enum(['ENTITY', 'OPERATION', 'MEASURE', 'GROUPING']),
      words: nullableString,
      options: z.array(optionSchema),
    }),
  ),
  proposals: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(['METRIC', 'DIMENSION']),
      conceptId: z.string(),
      conceptName: z.string(),
      words: nullableString,
      aggregation: nullableString,
      dimensionType: nullableString,
      valueCategory: nullableString,
      source: z.enum(['NEW', 'OPEN_SUGGESTION']),
      suggestionId: nullableString,
      pending: z.array(z.string()),
      modelMapping: z.boolean(),
      blocked: z.boolean(),
      evidence: z.array(z.string()),
    }),
  ),
  notices: z.array(z.string()),
  unresolved: z.array(z.string()),
});
export type Proposals = z.infer<typeof proposalsSchema>;
export type Proposal = Proposals['proposals'][number];
export type Clarification = Proposals['clarifications'][number];

export interface Answer {
  clarification: string;
  choice: string;
}

export const NONE = 'NONE';
export const YES = 'YES';

function base(dataSourceId: string): string {
  return `/bff/api/semantic/data-sources/${encodeURIComponent(dataSourceId)}`;
}

/** Step 1: Intelligence interprets the request for the source (by its alias; tenant and source are checked again). */
export async function interpretRequest(alias: string, request: string): Promise<KnowledgeIntent> {
  const { data } = await json<{ intent: unknown }>('/bff/api/knowledge-requests', {
    method: 'POST',
    body: { request, language: 'es', dataSource: alias },
  });
  return knowledgeIntentSchema.parse(data.intent);
}

/** Step 2: what exists, what is missing and what to ask. */
export async function proposeKnowledge(dataSourceId: string, intent: KnowledgeIntent, answers: Answer[]): Promise<Proposals> {
  const { data } = await json<unknown>(`${base(dataSourceId)}/knowledge-proposals`, {
    method: 'POST',
    body: { intent, answers },
  });
  return proposalsSchema.parse(data);
}

export interface Confirmation {
  proposal: string;
  name: string;
  description: string;
  acknowledgedPending: string[];
  acknowledgedInterpretation: boolean;
}

/** Step 3: saves one proposal as a DRAFT; returns the definition created. */
export async function confirmKnowledge(
  dataSourceId: string,
  intent: KnowledgeIntent,
  answers: Answer[],
  confirmation: Confirmation,
): Promise<{ definitionId: string; key?: string; status?: string; suggestionId?: string }> {
  const { data } = await json<{ definition?: { id?: string; key?: string; status?: string }; suggestion?: { id?: string } }>(
    `${base(dataSourceId)}/knowledge-proposals/confirm`,
    { method: 'POST', body: { intent, answers, ...confirmation } },
  );
  return {
    definitionId: data?.definition?.id ?? '',
    key: data?.definition?.key,
    status: data?.definition?.status,
    suggestionId: data?.suggestion?.id,
  };
}
