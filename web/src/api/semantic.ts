import { z } from 'zod';
import { json } from './http';
import {
  auditEventSchema,
  candidatesSchema,
  definitionSchema,
  relationshipSchema,
  type AuditTargetType,
  type Candidates,
  type Cardinality,
  type JoinType,
  type Relationship,
  type RelationshipOrigin,
  pageSchema,
  physicalObjectSchema,
  suggestionSchema,
  type Aggregation,
  type AuditEvent,
  type Definition,
  type DefinitionKind,
  type DefinitionStatus,
  type DimensionType,
  type Granularity,
  type PhysicalObject,
  type Suggestion,
} from './semanticTypes';

/** Nexora Semantic through the BFF (only the operations allowlisted by the BFF). */
const base = (dataSourceId: string) => `/bff/api/semantic/data-sources/${encodeURIComponent(dataSourceId)}`;
/** Semantic's maximum page size. */
export const MAX_PAGE = 200;
/** Safety bound when reading every page of a list. */
const MAX_PAGES = 50;

function query(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return entries.length ? `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}` : '';
}

/** Every page of a list (Semantic pages by 200 at most). */
async function allPages<T>(url: (page: number) => string, item: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data } = await json<unknown>(url(page));
    const parsed = pageSchema(item).parse(data);
    out.push(...(parsed.items as T[]));
    if (out.length >= parsed.totalItems || parsed.items.length === 0) break;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------- definitions

export interface DefinitionFilter {
  kind?: DefinitionKind;
  status?: DefinitionStatus;
}

export function listDefinitions(dataSourceId: string, filter: DefinitionFilter = {}): Promise<Definition[]> {
  return allPages(
    (page) => `${base(dataSourceId)}/definitions${query({ kind: filter.kind, status: filter.status, page, size: MAX_PAGE })}`,
    definitionSchema,
  );
}

/** Number of definitions with this status (one small page): used by the home page. */
export async function countDefinitions(dataSourceId: string, status: DefinitionStatus): Promise<number> {
  const { data } = await json<unknown>(`${base(dataSourceId)}/definitions${query({ status, page: 0, size: 1 })}`);
  return pageSchema(definitionSchema).parse(data).totalItems;
}

export interface Versioned<T> {
  data: T;
  /** The ETag (version) to send back in If-Match. */
  etag: string;
}

function versioned<T>(data: T, etag: string | undefined, version: number): Versioned<T> {
  return { data, etag: etag ?? `"${version}"` };
}

export async function getDefinition(dataSourceId: string, id: string): Promise<Versioned<Definition>> {
  const { data, etag } = await json<unknown>(`${base(dataSourceId)}/definitions/${encodeURIComponent(id)}`);
  const d = definitionSchema.parse(data);
  return versioned(d, etag, d.version);
}

export type DefinitionBlock =
  | { concept: { relationId: string } }
  | { metric: { conceptId: string; aggregation: Aggregation; columnId?: string } }
  | {
      dimension: {
        conceptId: string;
        columnId: string;
        type: DimensionType;
        granularities?: Granularity[];
        timeZone?: string;
      };
    };

/** CreateDefinitionRequest: always a DRAFT in Semantic. */
export type CreateDefinition = { kind: DefinitionKind; key: string; name: string; description?: string } & DefinitionBlock;
/** UpdateDefinitionRequest: full replacement of name, description and block; kind and key never change. */
export type UpdateDefinition = { name: string; description?: string } & DefinitionBlock;

export async function createDefinition(dataSourceId: string, body: CreateDefinition): Promise<Versioned<Definition>> {
  const { data, etag } = await json<unknown>(`${base(dataSourceId)}/definitions`, { method: 'POST', body });
  const d = definitionSchema.parse(data);
  return versioned(d, etag, d.version);
}

export async function updateDefinition(
  dataSourceId: string,
  id: string,
  etag: string,
  body: UpdateDefinition,
): Promise<Versioned<Definition>> {
  const r = await json<unknown>(`${base(dataSourceId)}/definitions/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body,
    headers: { 'If-Match': etag },
  });
  const d = definitionSchema.parse(r.data);
  return versioned(d, r.etag, d.version);
}

export async function approveDefinition(dataSourceId: string, id: string, etag: string): Promise<Versioned<Definition>> {
  const r = await json<unknown>(`${base(dataSourceId)}/definitions/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    headers: { 'If-Match': etag },
  });
  const d = definitionSchema.parse(r.data);
  return versioned(d, r.etag, d.version);
}

/** Deactivation (DRAFT or APPROVED → INACTIVE) with a mandatory reason: «reject» a draft, «retire» an approved one. */
export async function deactivateDefinition(
  dataSourceId: string,
  id: string,
  etag: string,
  reason: string,
): Promise<Versioned<Definition>> {
  const r = await json<unknown>(`${base(dataSourceId)}/definitions/${encodeURIComponent(id)}/deactivate`, {
    method: 'POST',
    body: { reason },
    headers: { 'If-Match': etag },
  });
  const d = definitionSchema.parse(r.data);
  return versioned(d, r.etag, d.version);
}

// --------------------------------------------------------------------------------------- physical objects

export const RELATION_TYPES = ['TABLE', 'VIEW', 'MATERIALIZED_VIEW'] as const;

export async function listRelations(dataSourceId: string): Promise<PhysicalObject[]> {
  const lists = await Promise.all(
    RELATION_TYPES.map((type) =>
      allPages((page) => `${base(dataSourceId)}/objects${query({ type, status: 'ACTIVE', page, size: MAX_PAGE })}`, physicalObjectSchema),
    ),
  );
  return lists.flat().sort((a, b) => a.naturalKey.localeCompare(b.naturalKey));
}

export function listColumns(dataSourceId: string, relationId: string): Promise<PhysicalObject[]> {
  return allPages(
    (page) => `${base(dataSourceId)}/objects${query({ type: 'COLUMN', parentId: relationId, status: 'ACTIVE', page, size: MAX_PAGE })}`,
    physicalObjectSchema,
  );
}

// -------------------------------------------------------------------------------------------------- audit

/**
 * The audit events of one definition, relationship or suggestion (requires AUDIT_READ in Semantic; the tenant is the
 * token's). Semantic orders them; the console shows them as received.
 */
export async function listAuditEvents(targetId: string, targetType: AuditTargetType = 'SEMANTIC_DEFINITION'): Promise<AuditEvent[]> {
  const { data } = await json<unknown>(`/bff/api/semantic/audit-events${query({ targetType, targetId, page: 0, size: MAX_PAGE })}`);
  return pageSchema(auditEventSchema).parse(data).items;
}

// ---------------------------------------------------------------------------------- relationships (B3)

export interface RelationshipFilter {
  status?: DefinitionStatus;
  origin?: RelationshipOrigin;
  /** A table or view: relationships where it is the source or the target. */
  objectId?: string;
}

export function listRelationships(dataSourceId: string, filter: RelationshipFilter = {}): Promise<Relationship[]> {
  return allPages(
    (page) =>
      `${base(dataSourceId)}/relationships${query({ status: filter.status, origin: filter.origin, objectId: filter.objectId, page, size: MAX_PAGE })}`,
    relationshipSchema,
  );
}

export async function getRelationship(dataSourceId: string, id: string): Promise<Versioned<Relationship>> {
  const { data, etag } = await json<unknown>(`${base(dataSourceId)}/relationships/${encodeURIComponent(id)}`);
  const r = relationshipSchema.parse(data);
  return versioned(r, etag, r.version);
}

export interface ColumnPair {
  sourceColumnId: string;
  targetColumnId: string;
}

/** CreateRelationshipRequest (SEMANTIC origin): always a DRAFT in Semantic. Unknown properties are refused by Semantic. */
export interface CreateRelationship {
  name: string;
  description?: string;
  sourceObjectId: string;
  targetObjectId: string;
  pairs: ColumnPair[];
  declaredCardinality: Cardinality;
  allowedJoinTypes: JoinType[];
}

/** CreateFromForeignKeyRequest (DECLARED_FK origin): the name defaults to the foreign key's. */
export interface CreateFromForeignKey {
  foreignKeyId: string;
  name?: string;
  description?: string;
  declaredCardinality: Cardinality;
  allowedJoinTypes: JoinType[];
}

/** UpdateRelationshipRequest: objects, pairs and origin are immutable; the result is a DRAFT. */
export interface UpdateRelationship {
  name: string;
  description?: string;
  declaredCardinality: Cardinality;
  allowedJoinTypes: JoinType[];
}

export async function createRelationship(dataSourceId: string, body: CreateRelationship): Promise<Versioned<Relationship>> {
  const { data, etag } = await json<unknown>(`${base(dataSourceId)}/relationships`, { method: 'POST', body });
  const r = relationshipSchema.parse(data);
  return versioned(r, etag, r.version);
}

export async function createRelationshipFromForeignKey(dataSourceId: string, body: CreateFromForeignKey): Promise<Versioned<Relationship>> {
  const { data, etag } = await json<unknown>(`${base(dataSourceId)}/relationships/from-foreign-key`, { method: 'POST', body });
  const r = relationshipSchema.parse(data);
  return versioned(r, etag, r.version);
}

export async function updateRelationship(
  dataSourceId: string,
  id: string,
  etag: string,
  body: UpdateRelationship,
): Promise<Versioned<Relationship>> {
  const r = await json<unknown>(`${base(dataSourceId)}/relationships/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body,
    headers: { 'If-Match': etag },
  });
  const d = relationshipSchema.parse(r.data);
  return versioned(d, r.etag, d.version);
}

export async function approveRelationship(dataSourceId: string, id: string, etag: string): Promise<Versioned<Relationship>> {
  const r = await json<unknown>(`${base(dataSourceId)}/relationships/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    headers: { 'If-Match': etag },
  });
  const d = relationshipSchema.parse(r.data);
  return versioned(d, r.etag, d.version);
}

/** DRAFT or APPROVED → INACTIVE with a mandatory reason (1–500 characters, Semantic DeactivateRequest). */
export async function deactivateRelationship(
  dataSourceId: string,
  id: string,
  etag: string,
  reason: string,
): Promise<Versioned<Relationship>> {
  const r = await json<unknown>(`${base(dataSourceId)}/relationships/${encodeURIComponent(id)}/deactivate`, {
    method: 'POST',
    body: { reason },
    headers: { 'If-Match': etag },
  });
  const d = relationshipSchema.parse(r.data);
  return versioned(d, r.etag, d.version);
}

/** Semantic's maximum number of candidates per call (RelationshipCandidateFinder.MAX_RESULTS). */
export const MAX_CANDIDATES = 100;

/** Heuristic candidates computed on demand (nothing is stored); optionally around one table or view. */
export async function relationshipCandidates(dataSourceId: string, objectId?: string): Promise<Candidates> {
  const { data } = await json<unknown>(`${base(dataSourceId)}/relationship-candidates${query({ objectId, limit: MAX_CANDIDATES })}`);
  return candidatesSchema.parse(data);
}

// -------------------------------------------------------------------------------------------- suggestions

export interface SuggestionFilter {
  kind?: string;
  status?: string;
  relevance?: string;
}

export function listSuggestions(dataSourceId: string, filter: SuggestionFilter = {}): Promise<Suggestion[]> {
  return allPages(
    (page) =>
      `${base(dataSourceId)}/suggestions${query({ kind: filter.kind, status: filter.status, relevance: filter.relevance, sort: 'RELEVANCE', page, size: MAX_PAGE })}`,
    suggestionSchema,
  );
}

export async function getSuggestion(dataSourceId: string, id: string): Promise<Versioned<Suggestion>> {
  const { data, etag } = await json<unknown>(`${base(dataSourceId)}/suggestions/${encodeURIComponent(id)}`);
  const s = suggestionSchema.parse(data);
  return versioned(s, etag, s.version);
}

export async function suggestionHistory(dataSourceId: string, id: string): Promise<Suggestion[]> {
  const { data } = await json<unknown>(`${base(dataSourceId)}/suggestions/${encodeURIComponent(id)}/history`);
  return z.object({ versions: z.array(suggestionSchema) }).passthrough().parse(data).versions;
}

/**
 * AcceptDefinitionRequest. D10 / D-B: the console always asks for result DRAFT (the BFF refuses anything else);
 * approving is a later, explicit action on the created definition. B1: a DIMENSION may be corrected (its type, only
 * when it differs from the suggested one; granularities and time zone for a TEMPORAL dimension).
 */
export interface AcceptDefinition {
  key: string;
  name: string;
  description?: string;
  conceptId?: string;
  dimensionType?: DimensionType;
  granularities?: Granularity[];
  timeZone?: string;
  acknowledgedPending?: string[];
  reason?: string;
}

export async function acceptSuggestionAsDraft(
  dataSourceId: string,
  id: string,
  etag: string,
  body: AcceptDefinition,
): Promise<{ definitionId?: string }> {
  const { data } = await json<{ definition?: { id?: string } }>(
    `${base(dataSourceId)}/suggestions/${encodeURIComponent(id)}/accept-definition`,
    { method: 'POST', body: { ...body, result: 'DRAFT' }, headers: { 'If-Match': etag } },
  );
  return { definitionId: data?.definition?.id };
}

/**
 * AcceptRequest of a RELATIONSHIP suggestion (B3). D-B: `result` is ALWAYS sent as DRAFT: without it Semantic approves
 * at once for a person who can approve. A correction keeps the source and changes the target and/or the pairs.
 */
export interface AcceptRelationship {
  name?: string;
  description?: string;
  declaredCardinality: Cardinality;
  allowedJoinTypes: JoinType[];
  acknowledgedPending?: string[];
  correction?: { targetObjectId: string; pairs: ColumnPair[] };
}

export async function acceptRelationshipSuggestionAsDraft(
  dataSourceId: string,
  id: string,
  etag: string,
  body: AcceptRelationship,
): Promise<{ relationshipId?: string }> {
  const { data } = await json<{ relationship?: { id?: string } }>(
    `${base(dataSourceId)}/suggestions/${encodeURIComponent(id)}/accept`,
    { method: 'POST', body: { ...body, result: 'DRAFT' }, headers: { 'If-Match': etag } },
  );
  return { relationshipId: data?.relationship?.id };
}

export async function rejectSuggestion(dataSourceId: string, id: string, etag: string, reason: string): Promise<void> {
  await json(`${base(dataSourceId)}/suggestions/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: { reason },
    headers: { 'If-Match': etag },
  });
}

export async function reopenSuggestion(dataSourceId: string, id: string, etag: string): Promise<void> {
  await json(`${base(dataSourceId)}/suggestions/${encodeURIComponent(id)}/reopen`, {
    method: 'POST',
    headers: { 'If-Match': etag },
  });
}
