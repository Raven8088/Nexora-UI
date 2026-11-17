import { Alert, List, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { ApiError, NetworkError, type Problem } from '@/api/problem';

/**
 * The code of a problem as Semantic and the BFF send it. Semantic writes `ErrorCode.name().toLowerCase()`
 * (`precondition_failed`, `definition_invalid`…); B1 fixes the console, which looked them up in upper case and
 * therefore always showed the generic text.
 */
export function problemCode(problem: Pick<Problem, 'code'>): string {
  return String(problem.code ?? '').toLowerCase();
}

/** The text of a Semantic error for a business user: by code, never the service's technical title. */
export function semanticErrorText(t: (k: string) => string, problem: Problem): string {
  const key = `dictionary.errors.${problemCode(problem)}`;
  const text = t(key);
  return text === key ? t('dictionary.errors.generic') : text;
}

/** One problem of a 422 (`definition_invalid`, `relationship_invalid`) or a 400 (`validation_failed`). */
export interface ProblemItem {
  code?: string;
  field?: string;
  message?: string;
}

/** The items Semantic attached to the problem (`errors`), as received. */
export function problemItems(problem: Problem): ProblemItem[] {
  return (problem.errors ?? []).filter((e): e is ProblemItem => !!e && typeof e === 'object');
}

/** An item in business words: a known issue code is translated; otherwise the field and Semantic's message. */
export function problemItemText(t: (k: string, o?: Record<string, unknown>) => string, item: ProblemItem): string {
  const known = item.code ? t(`dictionary.issueCode.${item.code}`, { defaultValue: '' }) : '';
  const text = known || item.message || item.code || '';
  if (!item.field) return text;
  return text ? `${text} (${item.field})` : item.field;
}

/**
 * An error of a call, with the support reference (correlation id) when there is one. B1: the specific problems of a
 * 422 (and the invalid fields of a 400) are listed, so the user knows what to change.
 */
export function ProblemAlert({ error, title }: { error: unknown; title?: string }) {
  const { t } = useTranslation();
  let text = t('common.error');
  let correlation: string | undefined;
  let items: ProblemItem[] = [];
  if (error instanceof ApiError) {
    text = semanticErrorText(t, error.problem);
    correlation = error.problem.correlationId ?? error.correlationId;
    items = problemItems(error.problem);
  } else if (error instanceof NetworkError) {
    text = t('auth.unavailable');
  }
  return (
    <Alert color="red" icon={<IconAlertTriangle size={18} />} title={title} role="alert">
      <Text size="sm">{text}</Text>
      {items.length > 0 && (
        <List size="sm" mt={4} data-testid="problem-items">
          {items.map((item, i) => (
            <List.Item key={`${item.code ?? item.field ?? ''}-${i}`}>{problemItemText(t, item)}</List.Item>
          ))}
        </List>
      )}
      {correlation && (
        <Text size="xs" mt={4} className="nexora-secondary-text">
          {t('common.correlation')}: {correlation}
        </Text>
      )}
    </Alert>
  );
}
