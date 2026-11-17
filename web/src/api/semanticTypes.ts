import { z } from 'zod';

/**
 * Contracts of Nexora Semantic used by the console (DefinitionDtos, MetadataDtos, SuggestionDtos, audit events),
 * validated on arrival. Unknown fields are kept (passthrough), so an additive change of Semantic does not break the
 * console; a missing or mistyped field the console relies on fails loudly.
 */
export const DEFINITION_KINDS = ['CONCEPT', 'METRIC', 'DIMENSION'] as const;
export const DEFINITION_STATUSES = ['DRAFT', 'APPROVED', 'INACTIVE'] as const;
export const AGGREGATIONS = ['COUNT', 'SUM', 'AVG'] as const;
export const DIMENSION_TYPES = ['CATEGORICAL', 'TEMPORAL'] as const;
export const GRANULARITIES = ['DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR'] as const;

export type DefinitionKind = (typeof DEFINITION_KINDS)[number];
export type DefinitionStatus = (typeof DEFINITION_STATUSES)[number];
export type Aggregation = (typeof AGGREGATIONS)[number];
export type DimensionType = (typeof DIMENSION_TYPES)[number];
export type Granularity = (typeof GRANULARITIES)[number];

const nullableString = z.string().nullish();

export const definitionSchema = z
  .object({
    id: z.string(),
    dataSourceId: z.string(),
    kind: z.enum(DEFINITION_KINDS),
    key: z.string(),
    name: z.string(),
    description: nullableString,
    status: z.enum(DEFINITION_STATUSES),
    origin: z.string().nullish(),
    usable: z.boolean(),
    issues: z.array(z.object({ code: z.string(), field: nullableString, message: nullableString }).passthrough()).default([]),
    concept: z.object({ relationId: z.string(), relationNaturalKey: nullableString }).passthrough().nullish(),
    metric: z
      .object({ conceptId: z.string(), aggregation: z.enum(AGGREGATIONS), columnId: nullableString, columnNaturalKey: nullableString })
      .passthrough()
      .nullish(),
    dimension: z
      .object({
        conceptId: z.string(),
        columnId: z.string(),
        columnNaturalKey: nullableString,
        type: z.enum(DIMENSION_TYPES),
        valueType: nullableString,
        granularities: z.array(z.string()).nullish(),
        timeZone: nullableString,
      })
      .passthrough()
      .nullish(),
    createdBy: nullableString,
    createdAt: nullableString,
    updatedBy: nullableString,
    updatedAt: nullableString,
    approvedBy: nullableString,
    approvedAt: nullableString,
    inactiveReason: nullableString,
    version: z.number(),
  })
  .passthrough();

export type Definition = z.infer<typeof definitionSchema>;

export const pageSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ items: z.array(item), page: z.number(), size: z.number(), totalItems: z.number() }).passthrough();

export const physicalObjectSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    naturalKey: z.string(),
    schemaName: nullableString,
    objectName: nullableString,
    childName: nullableString,
    parentId: nullableString,
    status: z.string(),
    comment: nullableString,
  })
  .passthrough();

export type PhysicalObject = z.infer<typeof physicalObjectSchema>;

export const auditEventSchema = z
  .object({
    id: z.string(),
    occurredAt: z.string(),
    actorId: z.string(),
    actorType: z.string(),
    action: z.string(),
    targetType: z.string(),
    targetId: nullableString,
    correlationId: nullableString,
    details: z.record(z.unknown()).nullish(),
  })
  .passthrough();

export type AuditEvent = z.infer<typeof auditEventSchema>;

const objectRef = z.object({ objectId: z.string().nullish(), naturalKey: nullableString }).passthrough().nullish();

export const suggestionSchema = z
  .object({
    id: z.string(),
    kind: z.string(),
    status: z.string(),
    evidence: z.array(z.object({ code: z.string(), detail: nullableString }).passthrough()).nullish(),
    confidence: z.number().nullish(),
    confidenceClass: nullableString,
    relevance: nullableString,
    pending: z.array(z.string()).nullish(),
    origin: nullableString,
    createdVia: nullableString,
    openedBy: z.object({ id: z.string(), type: z.string() }).passthrough().nullish(),
    createdAt: nullableString,
    closedAt: nullableString,
    staleReason: nullableString,
    decision: z
      .object({
        decidedBy: z.object({ id: z.string(), type: z.string() }).passthrough().nullish(),
        reason: nullableString,
        resultMode: nullableString,
        resultDefinitionId: nullableString,
        resultRelationshipId: nullableString,
      })
      .passthrough()
      .nullish(),
    version: z.number(),
    objectsChanged: z.boolean().nullish(),
    definition: z
      .object({ relation: objectRef, column: objectRef, aggregation: nullableString, dimensionType: nullableString })
      .passthrough()
      .nullish(),
    relationship: z.lazy(() => relationshipContentSchema).nullish(),
    suggestedKey: nullableString,
    exposure: z.array(z.object({ objectId: z.string(), naturalKey: nullableString, state: z.string() }).passthrough()).nullish(),
  })
  .passthrough();

export type Suggestion = z.infer<typeof suggestionSchema>;

/** Semantic PendingConfirmation (every value: an acceptance must confirm exactly the pending points). */
export const PENDING_CONFIRMATIONS = ['AMBIGUOUS_TARGET', 'CARDINALITY_CONFIRMATION', 'BUSINESS_NAME', 'VALUE_DISTRIBUTION_UNKNOWN'] as const;

// ------------------------------------------------------------------------------------- relationships (B3)

/** Semantic DeclaredCardinality, JoinType and RelationshipOrigin. */
export const CARDINALITIES = ['ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_ONE', 'MANY_TO_MANY'] as const;
export const JOIN_TYPES = ['INNER', 'LEFT'] as const;
export const RELATIONSHIP_ORIGINS = ['DECLARED_FK', 'SEMANTIC'] as const;
/** SemanticRelationship.MAX_PAIRS. */
export const MAX_PAIRS = 16;

export type Cardinality = (typeof CARDINALITIES)[number];
export type JoinType = (typeof JOIN_TYPES)[number];
export type RelationshipOrigin = (typeof RELATIONSHIP_ORIGINS)[number];

/** RelationshipDtos.ObjectRef / SuggestionDtos.ObjectRefResponse. */
export const refSchema = z.object({ objectId: z.string(), naturalKey: nullableString }).passthrough();
export type ObjectRef = z.infer<typeof refSchema>;

const issueSchema = z.object({ code: z.string(), field: nullableString, message: nullableString }).passthrough();

/** RelationshipDtos.RelationshipResponse. */
export const relationshipSchema = z
  .object({
    id: z.string(),
    dataSourceId: z.string(),
    name: z.string(),
    description: nullableString,
    origin: z.enum(RELATIONSHIP_ORIGINS),
    status: z.enum(DEFINITION_STATUSES),
    physicallyValid: z.boolean(),
    usable: z.boolean(),
    issues: z.array(issueSchema).default([]),
    source: refSchema,
    target: refSchema,
    pairs: z.array(z.object({ ordinal: z.number(), sourceColumn: refSchema, targetColumn: refSchema }).passthrough()).default([]),
    foreignKey: refSchema.nullish(),
    declaredCardinality: z.enum(CARDINALITIES),
    allowedJoinTypes: z.array(z.enum(JOIN_TYPES)),
    evidence: z.record(z.unknown()).nullish(),
    replacesId: nullableString,
    createdBy: nullableString,
    createdAt: nullableString,
    updatedBy: nullableString,
    updatedAt: nullableString,
    approvedBy: nullableString,
    approvedAt: nullableString,
    inactiveReason: nullableString,
    version: z.number(),
  })
  .passthrough();

export type Relationship = z.infer<typeof relationshipSchema>;

/** RelationshipDtos.CandidateResponse: a heuristic suggestion computed on demand, never stored. */
export const candidateSchema = z
  .object({
    source: refSchema,
    target: refSchema,
    pairs: z.array(z.object({ sourceColumn: refSchema, targetColumn: refSchema }).passthrough()),
    suggestedOrigin: z.enum(RELATIONSHIP_ORIGINS),
    foreignKeyId: nullableString,
    signals: z.array(z.object({ code: z.string(), detail: nullableString }).passthrough()).default([]),
    heuristicScore: z.number().nullish(),
    classification: nullableString,
  })
  .passthrough();

export type Candidate = z.infer<typeof candidateSchema>;

/** RelationshipDtos.CandidatesResponse (only the fields the console uses are required). */
export const candidatesSchema = z
  .object({
    candidates: z.array(candidateSchema),
    unresolvedForeignKeys: z.array(z.object({ foreignKeyId: z.string(), naturalKey: nullableString }).passthrough()).default([]),
    truncated: z.boolean().default(false),
    alreadyCataloged: z.number().nullish(),
  })
  .passthrough();

export type Candidates = z.infer<typeof candidatesSchema>;

/** SuggestionDtos.RelationshipContentResponse: what a RELATIONSHIP suggestion proposes. */
export const relationshipContentSchema = z
  .object({
    source: refSchema.nullish(),
    target: refSchema.nullish(),
    pairs: z.array(z.object({ sourceColumn: refSchema.nullish(), targetColumn: refSchema.nullish() }).passthrough()).default([]),
    foreignKeyId: nullableString,
    rule: nullableString,
  })
  .passthrough();

export type RelationshipContent = z.infer<typeof relationshipContentSchema>;

/** Semantic AuditTargetType values the console reads (B2). */
export type AuditTargetType = 'SEMANTIC_DEFINITION' | 'SEMANTIC_RELATIONSHIP' | 'SEMANTIC_SUGGESTION';
