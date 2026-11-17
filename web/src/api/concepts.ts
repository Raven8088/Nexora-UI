import { z } from 'zod';
import { json } from './http';

/**
 * F2 — assisted creation of NEW concepts (D-F2-1…9). Three calls, all through the BFF with the person's session:
 *
 * 1. `POST /bff/api/knowledge-requests/concept-candidates` → Nexora Intelligence relates the person's words to at most
 *    5 tables or views of a closed list of exposed data and answers `nexora-concept-match/1` (ids and the person's own
 *    words; every relation is an inference; nothing is created).
 * 2. `POST …/concept-proposals` → Semantic says what Nexora already knows and gives the candidates with their verified
 *    facts apart from inferences (reads only; no physical name unless the folded detail for an approver).
 * 3. `POST …/concept-proposals/confirm` → Semantic saves the chosen candidate as a DRAFT concept (never approved).
 */

export const conceptMatchSchema = z
  .object({
    format: z.literal('nexora-concept-match/1'),
    dataSourceId: z.string(),
    language: z.string(),
    request: z.string(),
    contextFingerprint: z.string(),
    interpretation: z
      .object({
        kind: z.enum(['CONCEPT_REQUEST', 'OTHER']),
        words: z.string().nullable(),
        relationIds: z.array(z.string()).max(5),
      })
      .strict(),
  })
  .strict();
export type ConceptMatch = z.infer<typeof conceptMatchSchema>;

export const FACTS = [
  'IMPORTED',
  'PRIMARY_KEY',
  'NO_PRIMARY_KEY',
  'REFERENCED_BY_CONCEPT',
  'REFERENCES_CONCEPT',
  'REFERENCED_BY_FOREIGN_KEYS',
  'DATE_COLUMNS',
  'TEXT_COLUMNS',
  'NUMBER_COLUMNS',
  'YES_NO_COLUMNS',
  'OTHER_COLUMNS',
] as const;

const candidateSchema = z.object({
  relationId: z.string(),
  proposalId: z.string(),
  relevance: z.string(),
  known: z.enum(['NEW', 'OPEN_SUGGESTION', 'REJECTED_BEFORE', 'CONCEPT_EXISTS']),
  knownId: z.string().nullish(),
  knownName: z.string().nullish(),
  inferred: z.array(z.enum(['NAME_EQUALS', 'NAME_CONTAINS', 'MODEL_SELECTED'])),
  verified: z.array(
    z.object({
      fact: z.enum(FACTS),
      count: z.number(),
      conceptId: z.string().nullish(),
      conceptName: z.string().nullish(),
    }),
  ),
  technicalName: z.string().nullish(),
});

export const conceptProposalsSchema = z.object({
  status: z.enum(['NOT_UNDERSTOOD', 'ALREADY_KNOWN', 'CANDIDATES', 'NOT_FOUND']),
  words: z.string().nullish(),
  named: z.array(z.object({ id: z.string(), name: z.string(), status: z.string() })),
  candidates: z.array(candidateSchema),
  omitted: z.number(),
  notices: z.array(z.string()),
});
export type ConceptProposals = z.infer<typeof conceptProposalsSchema>;
export type ConceptCandidate = ConceptProposals['candidates'][number];
export type VerifiedFact = ConceptCandidate['verified'][number];

function base(dataSourceId: string): string {
  return `/bff/api/semantic/data-sources/${encodeURIComponent(dataSourceId)}`;
}

/** Step 1: Intelligence relates the person's words to the closed list of exposed tables (by source alias). */
export async function interpretConcept(alias: string, request: string): Promise<ConceptMatch> {
  const { data } = await json<{ match: unknown }>('/bff/api/knowledge-requests/concept-candidates', {
    method: 'POST',
    body: { request, language: 'es', dataSource: alias },
  });
  return conceptMatchSchema.parse(data.match);
}

/** Step 2: what Nexora already knows and the candidates (verified facts apart from inferences). */
export async function proposeConcepts(dataSourceId: string, match: ConceptMatch): Promise<ConceptProposals> {
  const { data } = await json<unknown>(`${base(dataSourceId)}/concept-proposals`, { method: 'POST', body: { match } });
  return conceptProposalsSchema.parse(data);
}

export interface ConceptConfirmation {
  relationId: string;
  proposal: string;
  name: string;
  description: string;
  acknowledgedInference: boolean;
  acknowledgedNotKnown: boolean;
}

/** Step 3: saves the chosen candidate as a DRAFT concept; returns the definition created. */
export async function confirmConcept(
  dataSourceId: string,
  match: ConceptMatch,
  confirmation: ConceptConfirmation,
): Promise<{ definitionId: string; status?: string }> {
  const { data } = await json<{ definition?: { id?: string; status?: string } }>(`${base(dataSourceId)}/concept-proposals/confirm`, {
    method: 'POST',
    body: { match, ...confirmation },
  });
  return { definitionId: data?.definition?.id ?? '', status: data?.definition?.status };
}
