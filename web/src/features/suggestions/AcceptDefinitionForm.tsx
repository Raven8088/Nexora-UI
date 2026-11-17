import { Alert, Button, Checkbox, Group, Modal, Select, Stack, TextInput, Textarea } from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { acceptSuggestionAsDraft, type AcceptDefinition } from '@/api/semantic';
import { DIMENSION_TYPES, GRANULARITIES, type DimensionType, type Granularity, type Suggestion } from '@/api/semanticTypes';
import { ProblemAlert } from '@/shared/ProblemAlert';
import { KEY_PATTERN } from '../dictionary/formModel';
import { useDefinitions } from '../dictionary/hooks';

/**
 * Accepting a CONCEPT, METRIC or DIMENSION suggestion. D10 / D-B: always a DRAFT (the BFF refuses anything else).
 * B1:
 *  - the concept of a METRIC or DIMENSION is chosen among the concepts in use (DRAFT or APPROVED) bound to the
 *    suggestion's table, as Semantic requires (DEC-G2-2); with exactly one it is preselected;
 *  - a DIMENSION may be corrected (Semantic DEC-G2-4): its type, sent only when it differs from the suggested one;
 *    granularities and time zone when the resulting type is TEMPORAL.
 */
export function AcceptDefinitionForm(props: {
  suggestion: Suggestion;
  etag: string;
  dataSourceId: string;
  onClose: () => void;
  onAccepted: (definitionId?: string) => void;
}) {
  const { t } = useTranslation();
  const s = props.suggestion;
  const definitions = useDefinitions(props.dataSourceId);
  const relationId = s.definition?.relation?.objectId ?? undefined;
  const concepts = (definitions.data ?? []).filter(
    (d) => d.kind === 'CONCEPT' && d.status !== 'INACTIVE' && (!relationId || d.concept?.relationId === relationId),
  );
  const suggestedType = (DIMENSION_TYPES as readonly string[]).includes(s.definition?.dimensionType ?? '')
    ? (s.definition?.dimensionType as DimensionType)
    : 'CATEGORICAL';
  const [key, setKey] = useState(s.suggestedKey ?? '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [chosenConcept, setConceptId] = useState<string | null>(null);
  const [dimensionType, setDimensionType] = useState<DimensionType>(suggestedType);
  const [granularities, setGranularities] = useState<Granularity[]>([]);
  const [timeZone, setTimeZone] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const pending = s.pending ?? [];
  const needsConcept = s.kind === 'METRIC' || s.kind === 'DIMENSION';
  const isDimension = s.kind === 'DIMENSION';
  const conceptId = chosenConcept ?? (concepts.length === 1 ? concepts[0]?.id ?? null : null);
  const accept = useMutation({
    mutationFn: (body: AcceptDefinition) => acceptSuggestionAsDraft(props.dataSourceId, s.id, props.etag, body),
  });
  const valid =
    KEY_PATTERN.test(key) &&
    name.trim().length > 0 &&
    name.length <= 200 &&
    timeZone.length <= 64 &&
    (!needsConcept || !!conceptId) &&
    (pending.length === 0 || acknowledged);

  const body = (): AcceptDefinition => ({
    key,
    name: name.trim(),
    ...(description.trim() ? { description: description.trim() } : {}),
    ...(needsConcept && conceptId ? { conceptId } : {}),
    ...(isDimension && dimensionType !== suggestedType ? { dimensionType } : {}),
    ...(isDimension && dimensionType === 'TEMPORAL' && granularities.length ? { granularities } : {}),
    ...(isDimension && dimensionType === 'TEMPORAL' && timeZone.trim() ? { timeZone: timeZone.trim() } : {}),
    ...(pending.length ? { acknowledgedPending: pending } : {}),
  });

  return (
    <Modal opened onClose={props.onClose} title={t('suggestions.acceptTitle')} centered size="lg" closeButtonProps={{ 'aria-label': t('common.close') }}>
      <Stack gap="sm">
        <Alert color="nexora" variant="light">{t('suggestions.acceptNote')}</Alert>
        <TextInput
          label={t('dictionary.form.key')}
          description={t('dictionary.form.keyHint')}
          value={key}
          onChange={(e) => setKey(e.currentTarget.value)}
          required
          error={key && !KEY_PATTERN.test(key) ? t('dictionary.form.errors.key') : undefined}
        />
        <TextInput label={t('dictionary.form.name')} value={name} onChange={(e) => setName(e.currentTarget.value)} required maxLength={200} />
        <Textarea label={t('dictionary.form.description')} value={description} onChange={(e) => setDescription(e.currentTarget.value)} maxLength={2000} autosize minRows={2} />
        {needsConcept && (
          <>
            <Select
              label={t('dictionary.form.concept')}
              description={t('suggestions.conceptOfTable', { table: s.definition?.relation?.naturalKey ?? '—' })}
              required
              searchable
              value={conceptId}
              onChange={setConceptId}
              data={concepts.map((c) => ({ value: c.id, label: `${c.name} (${t(`dictionary.statusShort.${c.status}`)})` }))}
            />
            {definitions.data && concepts.length === 0 && (
              <Alert color="yellow" data-testid="no-concept">{t('suggestions.noConceptForTable', { table: s.definition?.relation?.naturalKey ?? '—' })}</Alert>
            )}
          </>
        )}
        {isDimension && (
          <>
            <Select
              label={t('dictionary.form.dimensionType')}
              description={t('suggestions.dimensionTypeHint', { type: t(`dictionary.form.dimensionTypeValue.${suggestedType}`) })}
              data={DIMENSION_TYPES.map((d) => ({ value: d, label: t(`dictionary.form.dimensionTypeValue.${d}`) }))}
              value={dimensionType}
              onChange={(v) => setDimensionType((v ?? suggestedType) as DimensionType)}
              allowDeselect={false}
            />
            {dimensionType === 'TEMPORAL' && (
              <>
                <Checkbox.Group label={t('dictionary.form.granularities')} description={t('suggestions.granularitiesHint')} value={granularities} onChange={(v) => setGranularities(v as Granularity[])}>
                  <Group mt={4}>
                    {GRANULARITIES.map((g) => (
                      <Checkbox key={g} value={g} label={t(`dictionary.form.granularityValue.${g}`)} />
                    ))}
                  </Group>
                </Checkbox.Group>
                <TextInput label={t('dictionary.form.timeZone')} maxLength={64} value={timeZone} onChange={(e) => setTimeZone(e.currentTarget.value)} />
              </>
            )}
          </>
        )}
        {pending.length > 0 && (
          <Checkbox
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.currentTarget.checked)}
            label={`${t('suggestions.acknowledge')}: ${pending.map((p) => t(`suggestions.pendingValue.${p}`, { defaultValue: p })).join(', ')}`}
          />
        )}
        {accept.error && <ProblemAlert error={accept.error} />}
        <Group justify="flex-end">
          <Button variant="default" onClick={props.onClose}>{t('common.cancel')}</Button>
          <Button
            disabled={!valid}
            loading={accept.isPending}
            onClick={() => accept.mutate(body(), { onSuccess: (r) => props.onAccepted(r.definitionId) })}
          >
            {t('suggestions.accept')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
