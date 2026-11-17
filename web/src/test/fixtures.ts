import { http, HttpResponse } from 'msw';
import type { Permissions, SessionView } from '@/api/bff';
import type { Definition, Relationship, Suggestion } from '@/api/semanticTypes';

/**
 * Synthetic data for automated tests (D11): invented names and ids, no company data, no credentials.
 */
export const DS = '00000000-0000-4000-8000-000000000001';

export const ALL_PERMISSIONS: Permissions = {
  chat: true,
  catalogRead: true,
  proposalWrite: true,
  approve: true,
  audit: true,
  diagnostics: false,
};

export function session(overrides: Partial<SessionView> = {}, permissions: Partial<Permissions> = {}): SessionView {
  return {
    name: 'Ana Prueba',
    username: 'ana.prueba',
    subject: 'sub-ana',
    tenant: 'tenant-demo',
    roles: ['REPORT_REQUESTER', 'EDITOR', 'APPROVER', 'AUDITOR'],
    permissions: { ...ALL_PERMISSIONS, ...permissions },
    sources: [{ alias: 'demo', label: 'Fuente de demostración', dataSourceId: DS }],
    ...overrides,
  };
}

export function sessionHandler(value: SessionView = session()) {
  return http.get('/bff/session', () => HttpResponse.json(value));
}

let seq = 0;
export function definition(overrides: Partial<Definition> = {}): Definition {
  seq += 1;
  return {
    id: `10000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    dataSourceId: DS,
    kind: 'CONCEPT',
    key: `concepto-${seq}`,
    name: `Concepto ${seq}`,
    description: 'Definición sintética de prueba',
    status: 'DRAFT',
    origin: 'MANUAL',
    usable: false,
    issues: [],
    concept: { relationId: 'r-1', relationNaturalKey: 'demo.tabla_a' },
    createdBy: 'ana.prueba',
    createdAt: '2026-01-01T10:00:00Z',
    updatedAt: '2026-01-01T10:00:00Z',
    version: 1,
    ...overrides,
  } as Definition;
}

/** Physical objects of the synthetic source (invented names). */
export const TABLE_A = { objectId: '20000000-0000-4000-8000-00000000000a', naturalKey: 'demo.pedidos' };
export const TABLE_B = { objectId: '20000000-0000-4000-8000-00000000000b', naturalKey: 'demo.clientes' };
export const COL_A1 = { objectId: '30000000-0000-4000-8000-0000000000a1', naturalKey: 'demo.pedidos.cliente_id' };
export const COL_B1 = { objectId: '30000000-0000-4000-8000-0000000000b1', naturalKey: 'demo.clientes.id' };

export function relationship(overrides: Partial<Relationship> = {}): Relationship {
  seq += 1;
  return {
    id: `40000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    dataSourceId: DS,
    name: `Relación ${seq}`,
    description: 'Relación sintética de prueba',
    origin: 'SEMANTIC',
    status: 'DRAFT',
    physicallyValid: true,
    usable: false,
    issues: [],
    source: TABLE_A,
    target: TABLE_B,
    pairs: [{ ordinal: 0, sourceColumn: COL_A1, targetColumn: COL_B1 }],
    foreignKey: null,
    declaredCardinality: 'MANY_TO_ONE',
    allowedJoinTypes: ['INNER'],
    evidence: { cardinalityAssurance: 'UNVERIFIED' },
    replacesId: null,
    createdBy: 'otra-persona',
    createdAt: '2026-01-01T10:00:00Z',
    updatedBy: 'otra-persona',
    updatedAt: '2026-01-01T10:00:00Z',
    version: 1,
    ...overrides,
  } as Relationship;
}

/** A physical object as Semantic's /objects returns it. */
export function physical(ref: { objectId: string; naturalKey: string }, type: string, parentId?: string) {
  const parts = ref.naturalKey.split('.');
  return { id: ref.objectId, type, naturalKey: ref.naturalKey, schemaName: parts[0], objectName: parts[1], childName: parts[2] ?? null, parentId: parentId ?? null, status: 'ACTIVE' };
}

export function page<T>(items: T[]) {
  return { items, page: 0, size: 200, totalItems: items.length };
}

export function suggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    id: 's-1',
    kind: 'METRIC',
    status: 'OPEN',
    evidence: [{ code: 'NUMERIC_COLUMN', detail: 'columna numérica' }],
    confidence: 0.8,
    relevance: 'HIGH',
    pending: ['BUSINESS_NAME'],
    createdAt: '2026-01-01T10:00:00Z',
    version: 3,
    definition: { relation: { objectId: 'r-1', naturalKey: 'demo.tabla_a' }, column: { objectId: 'c-1', naturalKey: 'demo.tabla_a.importe' }, aggregation: 'SUM' },
    suggestedKey: 'importe-total',
    exposure: [],
    ...overrides,
  } as Suggestion;
}

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** A tiny fake workbook body (not a real Excel: the console never opens it). */
export function xlsxResponse(headers: Record<string, string> = {}) {
  return new HttpResponse(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4]), {
    status: 200,
    headers: {
      'Content-Type': XLSX_TYPE,
      'Content-Disposition': 'attachment; filename="reporte-demo.xlsx"',
      'X-Nexora-Completeness': 'COMPLETED',
      'X-Nexora-Artifact-Sha256': 'a'.repeat(64),
      'X-Request-Id': 'corr-1',
      ...headers,
    },
  });
}
