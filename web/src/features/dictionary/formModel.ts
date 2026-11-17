import { z } from 'zod';
import {
  AGGREGATIONS,
  DEFINITION_KINDS,
  DIMENSION_TYPES,
  GRANULARITIES,
  type Definition,
} from '@/api/semanticTypes';
import type { CreateDefinition, DefinitionBlock, UpdateDefinition } from '@/api/semantic';

/**
 * The editor's form, validated with the same rules as Semantic's CreateDefinitionRequest / UpdateDefinitionRequest
 * (key pattern and lengths, one block per kind, a column for SUM and AVG). Semantic validates again and its errors are
 * shown as they come.
 */
export const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{1,62}$/;

export const formSchema = z
  .object({
    kind: z.enum(DEFINITION_KINDS),
    key: z.string(),
    name: z.string().trim().min(1, 'name').max(200, 'name'),
    description: z.string().max(2000, 'description'),
    relationId: z.string(),
    conceptId: z.string(),
    aggregation: z.enum(AGGREGATIONS),
    columnId: z.string(),
    dimensionType: z.enum(DIMENSION_TYPES),
    granularities: z.array(z.enum(GRANULARITIES)),
    timeZone: z.string().max(64, 'timeZone'),
    /** Edits do not change the key: it is only validated on creation. */
    creating: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.creating && !KEY_PATTERN.test(v.key)) ctx.addIssue({ code: 'custom', path: ['key'], message: 'key' });
    if (v.kind === 'CONCEPT' && !v.relationId) ctx.addIssue({ code: 'custom', path: ['relationId'], message: 'relation' });
    if (v.kind !== 'CONCEPT' && !v.conceptId) ctx.addIssue({ code: 'custom', path: ['conceptId'], message: 'concept' });
    if (v.kind === 'METRIC' && v.aggregation !== 'COUNT' && !v.columnId) {
      ctx.addIssue({ code: 'custom', path: ['columnId'], message: 'columnForSum' });
    }
    if (v.kind === 'DIMENSION' && !v.columnId) ctx.addIssue({ code: 'custom', path: ['columnId'], message: 'column' });
  });

export type FormValues = z.infer<typeof formSchema>;

export function emptyForm(kind: FormValues['kind'] = 'CONCEPT'): FormValues {
  return {
    kind,
    key: '',
    name: '',
    description: '',
    relationId: '',
    conceptId: '',
    aggregation: 'COUNT',
    columnId: '',
    dimensionType: 'CATEGORICAL',
    granularities: [],
    timeZone: '',
    creating: true,
  };
}

/** The form of an existing definition (edit of a DRAFT, or reactivation of an INACTIVE). */
export function formOf(d: Definition): FormValues {
  return {
    ...emptyForm(d.kind),
    creating: false,
    key: d.key,
    name: d.name,
    description: d.description ?? '',
    relationId: d.concept?.relationId ?? '',
    conceptId: d.metric?.conceptId ?? d.dimension?.conceptId ?? '',
    aggregation: d.metric?.aggregation ?? 'COUNT',
    columnId: d.metric?.columnId ?? d.dimension?.columnId ?? '',
    dimensionType: d.dimension?.type ?? 'CATEGORICAL',
    granularities: (d.dimension?.granularities ?? []).filter((g): g is FormValues['granularities'][number] =>
      (GRANULARITIES as readonly string[]).includes(g),
    ),
    timeZone: d.dimension?.timeZone ?? '',
  };
}

function block(v: FormValues): DefinitionBlock {
  switch (v.kind) {
    case 'CONCEPT':
      return { concept: { relationId: v.relationId } };
    case 'METRIC':
      return { metric: { conceptId: v.conceptId, aggregation: v.aggregation, ...(v.columnId ? { columnId: v.columnId } : {}) } };
    case 'DIMENSION':
      return {
        dimension: {
          conceptId: v.conceptId,
          columnId: v.columnId,
          type: v.dimensionType,
          ...(v.dimensionType === 'TEMPORAL' && v.granularities.length ? { granularities: v.granularities } : {}),
          ...(v.dimensionType === 'TEMPORAL' && v.timeZone.trim() ? { timeZone: v.timeZone.trim() } : {}),
        },
      };
  }
}

const description = (v: FormValues) => (v.description.trim() ? { description: v.description.trim() } : {});

export function toCreate(v: FormValues): CreateDefinition {
  return { kind: v.kind, key: v.key, name: v.name.trim(), ...description(v), ...block(v) } as CreateDefinition;
}

export function toUpdate(v: FormValues): UpdateDefinition {
  return { name: v.name.trim(), ...description(v), ...block(v) } as UpdateDefinition;
}
