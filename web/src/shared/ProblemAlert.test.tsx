import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { ApiError } from '@/api/problem';
import { renderWithProviders } from '@/test/render';
import { ProblemAlert, problemItemText, semanticErrorText } from './ProblemAlert';

const t = i18n.t.bind(i18n) as unknown as (k: string, o?: Record<string, unknown>) => string;
const generic = t('dictionary.errors.generic');

/**
 * The codes exactly as Nexora Semantic sends them (ErrorCode.code() = name().toLowerCase()) for the operations of the
 * dictionary, relationships and suggestions, plus the BFF's own codes. Before B1 every one of them showed the generic
 * text, because the console looked them up in upper case.
 */
const SEMANTIC_CODES = [
  'validation_failed', 'malformed_request', 'forbidden', 'tenant_access_denied', 'not_found', 'duplicate_key',
  'precondition_failed', 'precondition_required', 'payload_too_large', 'data_source_archived', 'definition_invalid',
  'invalid_state_transition', 'self_approval_forbidden', 'non_human_approval_forbidden', 'relationship_invalid',
  'relationship_equivalent_exists', 'metadata_not_imported', 'suggestion_access_denied', 'suggestion_outdated',
  'matching_suggestion_open', 'concept_required', 'concept_selection_required', 'definition_equivalent_exists',
  'column_sensitive',
];
const BFF_CODES = [
  'bff_forbidden', 'bff_route_not_allowed', 'bff_source_not_configured', 'bff_payload_too_large', 'bff_draft_required',
  'bff_upstream_unavailable', 'bff_upstream_timeout', 'bff_upstream_broken', 'bff_upstream_too_large',
];

describe('B1: Semantic error codes', () => {
  it('every real code (lower case) has its own text, never the generic one', () => {
    for (const code of [...SEMANTIC_CODES, ...BFF_CODES]) {
      const text = semanticErrorText(t, { status: 400, code });
      expect(text, code).not.toBe(generic);
      expect(text, code).not.toContain('dictionary.errors');
    }
  });

  it('an upper-case code is read the same way; an unknown code falls back to the generic text', () => {
    expect(semanticErrorText(t, { status: 412, code: 'PRECONDITION_FAILED' })).toBe(semanticErrorText(t, { status: 412, code: 'precondition_failed' }));
    expect(semanticErrorText(t, { status: 500, code: 'internal_error_xyz' })).toBe(generic);
  });

  it('a 422 lists each specific problem, translated when the issue code is known', async () => {
    const error = new ApiError({
      status: 422,
      code: 'definition_invalid',
      correlationId: 'corr-422',
      errors: [
        { code: 'CONCEPT_NOT_APPROVED', field: 'metric.conceptId', message: 'concept is not approved' },
        { code: 'SOMETHING_NEW', field: 'x', message: 'raw message from Semantic' },
      ],
    });
    renderWithProviders(<ProblemAlert error={error} />);
    expect(await screen.findByText(t('dictionary.errors.definition_invalid'))).toBeInTheDocument();
    expect(screen.getByText('El concepto todavía no está aprobado (metric.conceptId)')).toBeInTheDocument();
    expect(screen.getByText('raw message from Semantic (x)')).toBeInTheDocument();
    expect(screen.getByText(/corr-422/)).toBeInTheDocument();
    // a 400 validation_failed carries only the invalid field
    expect(problemItemText(t, { field: 'name' })).toBe('name');
  });
});
