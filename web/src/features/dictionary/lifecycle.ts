import type { Permissions } from '@/api/bff';
import type { Definition, DefinitionStatus } from '@/api/semanticTypes';

/**
 * What the console offers on a definition or a relationship, from Semantic's real lifecycle (DRAFT → APPROVED →
 * INACTIVE; any edit returns to DRAFT, from any status) and the user's permissions. Semantic decides again on every
 * call (permissions, SEC-1/SEC-2, transitions): hiding a button is never the authorization.
 *  - B4 / D-A: an APPROVED element can be «corrected» (`correct`) after an explicit confirmation of the consequences:
 *    Semantic returns it to DRAFT (it stops being used until approved again; plans that depend on it become STALE).
 *  - D5: «reject» a draft = deactivation with a reason (approval permission).
 *  - D6: no deletion: Semantic does not offer it.
 */
export type Action = 'edit' | 'correct' | 'approve' | 'reject' | 'retire' | 'reactivate';

export interface ActionState {
  action: Action;
  allowed: boolean;
  /** Why it is shown but disabled. */
  reasonKey?: string;
}

export function actionsFor(element: { status: DefinitionStatus }, permissions: Permissions): ActionState[] {
  const out: ActionState[] = [];
  switch (element.status) {
    case 'DRAFT':
      if (permissions.proposalWrite) out.push({ action: 'edit', allowed: true });
      if (permissions.approve) out.push({ action: 'approve', allowed: true }, { action: 'reject', allowed: true });
      return out;
    case 'APPROVED':
      if (permissions.proposalWrite) out.push({ action: 'correct', allowed: true });
      if (permissions.approve) out.push({ action: 'retire', allowed: true });
      return out;
    case 'INACTIVE':
      if (permissions.proposalWrite) out.push({ action: 'reactivate', allowed: true });
      return out;
  }
}

/** Definitions of the same source that reference this one (metrics and dimensions of a concept). */
export function dependentsOf(definition: Definition, all: Definition[]): Definition[] {
  if (definition.kind !== 'CONCEPT') return [];
  return all.filter((d) => d.metric?.conceptId === definition.id || d.dimension?.conceptId === definition.id);
}

/** The concept a metric or dimension depends on. */
export function conceptOf(definition: Definition, all: Definition[]): Definition | undefined {
  const id = definition.metric?.conceptId ?? definition.dimension?.conceptId;
  return id ? all.find((d) => d.id === id) : undefined;
}

/** Search in name, key and description, ignoring case and accents. */
export function matches(definition: Definition, search: string): boolean {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const q = norm(search.trim());
  if (!q) return true;
  return [definition.name, definition.key, definition.description ?? ''].some((v) => norm(v).includes(q));
}
