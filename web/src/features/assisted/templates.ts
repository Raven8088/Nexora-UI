import type { Proposal } from '@/api/assisted';

type T = (key: string, options?: Record<string, unknown>) => string;

/**
 * AD-ASIS-3: the suggested name and description are fixed templates filled with the person's own words and the
 * approved name of the concept — never text written by a model. The person edits and confirms them.
 */
/** «por fecha de medición» → «fecha de medición»: the leading «por», «cada», «según» are not part of a name. */
export function plainWords(words: string | null | undefined): string {
  return (words ?? '').trim().replace(/^(?:(?:por|cada|según|segun)\s+)+/i, '');
}

export function nameTemplate(t: T, p: Proposal): string {
  if (p.kind === 'METRIC') return t('assisted.template.metricName', { words: (p.words ?? '').trim() || p.conceptName });
  const plain = plainWords(p.words) || p.conceptName;
  return plain.charAt(0).toUpperCase() + plain.slice(1);
}

export function descriptionTemplate(t: T, p: Proposal): string {
  if (p.kind === 'METRIC') return t('assisted.template.metricDescription', { concept: p.conceptName });
  return t('assisted.template.dimensionDescription', { concept: p.conceptName, words: plainWords(p.words) || p.conceptName });
}
