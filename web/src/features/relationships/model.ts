import type {
  ColumnPair,
  CreateFromForeignKey,
  CreateRelationship,
  UpdateRelationship,
} from '@/api/semantic';
import { MAX_PAIRS, type Candidate, type Cardinality, type JoinType, type Relationship } from '@/api/semanticTypes';

/**
 * The relationship editor's model, validated with the same limits as Semantic's CreateRelationshipRequest,
 * CreateFromForeignKeyRequest and UpdateRelationshipRequest (name 1–200, description ≤ 2000, 1–16 complete pairs, at
 * least one JOIN type). Semantic validates again (physical validity, duplicates, equivalents) and its errors are
 * shown as they come.
 */
export const NAME_MAX = 200;
export const DESCRIPTION_MAX = 2000;

export interface PairDraft {
  sourceColumnId: string;
  targetColumnId: string;
}

export interface RelationshipValues {
  /** manual = SEMANTIC origin; foreignKey = DECLARED_FK from a detected foreign key (B3). */
  origin: 'manual' | 'foreignKey';
  name: string;
  description: string;
  sourceObjectId: string;
  targetObjectId: string;
  pairs: PairDraft[];
  foreignKeyId: string;
  /** The foreign key's natural key, to show what is being created. */
  foreignKeyLabel: string;
  declaredCardinality: Cardinality;
  allowedJoinTypes: JoinType[];
}

export type ValueErrors = Partial<Record<'name' | 'description' | 'source' | 'target' | 'pairs' | 'joinTypes' | 'foreignKey', string>>;

export function emptyValues(): RelationshipValues {
  return {
    origin: 'manual',
    name: '',
    description: '',
    sourceObjectId: '',
    targetObjectId: '',
    pairs: [{ sourceColumnId: '', targetColumnId: '' }],
    foreignKeyId: '',
    foreignKeyLabel: '',
    declaredCardinality: 'MANY_TO_ONE',
    allowedJoinTypes: ['INNER'],
  };
}

/** The editable fields of an existing relationship (edit, correct, reactivate). */
export function valuesOf(r: Relationship): RelationshipValues {
  return {
    ...emptyValues(),
    origin: r.origin === 'DECLARED_FK' ? 'foreignKey' : 'manual',
    name: r.name,
    description: r.description ?? '',
    sourceObjectId: r.source.objectId,
    targetObjectId: r.target.objectId,
    pairs: r.pairs.map((p) => ({ sourceColumnId: p.sourceColumn.objectId, targetColumnId: p.targetColumn.objectId })),
    foreignKeyId: r.foreignKey?.objectId ?? '',
    foreignKeyLabel: r.foreignKey?.naturalKey ?? '',
    declaredCardinality: r.declaredCardinality,
    allowedJoinTypes: [...r.allowedJoinTypes],
  };
}

/**
 * A candidate (never stored by Semantic) as the starting point of a new relationship: a declared foreign key becomes
 * a DECLARED_FK draft (Semantic resolves its columns); any other candidate pre-fills a SEMANTIC draft.
 */
export function valuesFromCandidate(c: Candidate): RelationshipValues {
  const base = emptyValues();
  if (c.suggestedOrigin === 'DECLARED_FK' && c.foreignKeyId) {
    return {
      ...base,
      origin: 'foreignKey',
      foreignKeyId: c.foreignKeyId,
      foreignKeyLabel: `${c.source.naturalKey ?? c.source.objectId} → ${c.target.naturalKey ?? c.target.objectId}`,
      sourceObjectId: c.source.objectId,
      targetObjectId: c.target.objectId,
      pairs: c.pairs.map((p) => ({ sourceColumnId: p.sourceColumn.objectId, targetColumnId: p.targetColumn.objectId })),
    };
  }
  return {
    ...base,
    sourceObjectId: c.source.objectId,
    targetObjectId: c.target.objectId,
    pairs: c.pairs.slice(0, MAX_PAIRS).map((p) => ({ sourceColumnId: p.sourceColumn.objectId, targetColumnId: p.targetColumn.objectId })),
  };
}

/**
 * Validation of the form. `creating`: the objects and pairs are only edited on creation (Semantic keeps them
 * immutable); a foreign key relationship may leave the name empty (it defaults to the foreign key's).
 */
export function validate(v: RelationshipValues, creating: boolean): ValueErrors {
  const e: ValueErrors = {};
  const name = v.name.trim();
  const nameOptional = creating && v.origin === 'foreignKey';
  if ((!nameOptional && name.length === 0) || name.length > NAME_MAX) e.name = 'name';
  if (v.description.trim().length > DESCRIPTION_MAX) e.description = 'description';
  if (v.allowedJoinTypes.length === 0) e.joinTypes = 'joinTypes';
  if (creating && v.origin === 'foreignKey' && !v.foreignKeyId) e.foreignKey = 'foreignKey';
  if (creating && v.origin === 'manual') {
    if (!v.sourceObjectId) e.source = 'source';
    if (!v.targetObjectId) e.target = 'target';
    const complete = v.pairs.length > 0 && v.pairs.length <= MAX_PAIRS && v.pairs.every((p) => p.sourceColumnId && p.targetColumnId);
    const keys = v.pairs.map((p) => `${p.sourceColumnId}|${p.targetColumnId}`);
    if (!complete) e.pairs = 'pairs';
    else if (new Set(keys).size !== keys.length) e.pairs = 'pairsDuplicated';
  }
  return e;
}

const description = (v: RelationshipValues) => (v.description.trim() ? { description: v.description.trim() } : {});
const pairsOf = (v: RelationshipValues): ColumnPair[] => v.pairs.map((p) => ({ sourceColumnId: p.sourceColumnId, targetColumnId: p.targetColumnId }));

/** CreateRelationshipRequest: exactly its fields (Semantic refuses unknown properties). */
export function toCreate(v: RelationshipValues): CreateRelationship {
  return {
    name: v.name.trim(),
    ...description(v),
    sourceObjectId: v.sourceObjectId,
    targetObjectId: v.targetObjectId,
    pairs: pairsOf(v),
    declaredCardinality: v.declaredCardinality,
    allowedJoinTypes: [...v.allowedJoinTypes],
  };
}

/** CreateFromForeignKeyRequest: the name is omitted when empty (Semantic uses the foreign key's). */
export function toFromForeignKey(v: RelationshipValues): CreateFromForeignKey {
  return {
    foreignKeyId: v.foreignKeyId,
    ...(v.name.trim() ? { name: v.name.trim() } : {}),
    ...description(v),
    declaredCardinality: v.declaredCardinality,
    allowedJoinTypes: [...v.allowedJoinTypes],
  };
}

/** UpdateRelationshipRequest: full replacement of the editable fields only. */
export function toUpdate(v: RelationshipValues): UpdateRelationship {
  return { name: v.name.trim(), ...description(v), declaredCardinality: v.declaredCardinality, allowedJoinTypes: [...v.allowedJoinTypes] };
}

/** Search in name, description, tables and columns, ignoring case and accents. */
export function matchesRelationship(r: Relationship, search: string): boolean {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const q = norm(search.trim());
  if (!q) return true;
  const fields = [
    r.name,
    r.description ?? '',
    r.source.naturalKey ?? '',
    r.target.naturalKey ?? '',
    ...r.pairs.flatMap((p) => [p.sourceColumn.naturalKey ?? '', p.targetColumn.naturalKey ?? '']),
  ];
  return fields.some((f) => norm(f).includes(q));
}

/** «source → target» with natural keys (ids only when Semantic has no name for an object). */
export function endpoints(r: { source?: { objectId: string; naturalKey?: string | null } | null; target?: { objectId: string; naturalKey?: string | null } | null }): string {
  const name = (o?: { objectId: string; naturalKey?: string | null } | null) => (o ? o.naturalKey ?? o.objectId : '—');
  return `${name(r.source)} → ${name(r.target)}`;
}
