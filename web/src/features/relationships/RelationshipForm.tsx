import { Alert, Badge, Button, Group, Modal, SegmentedControl, Select, Stack, Table, Text, TextInput, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/api/problem';
import type { Relationship } from '@/api/semanticTypes';
import { ProblemAlert } from '@/shared/ProblemAlert';
import { useRelations } from '../dictionary/hooks';
import {
  DESCRIPTION_MAX,
  NAME_MAX,
  emptyValues,
  endpoints,
  toCreate,
  toFromForeignKey,
  toUpdate,
  validate,
  valuesFromCandidate,
  valuesOf,
  type RelationshipValues,
} from './model';
import { useCandidates, useCreateFromForeignKey, useCreateRelationship, useUpdateRelationship } from './hooks';
import { PairsEditor } from './PairsEditor';
import { SemanticsFields } from './SemanticsFields';

export type RelationshipFormMode =
  | { type: 'create' }
  | { type: 'edit' | 'correct' | 'reactivate'; relationship: Relationship; etag: string };

/**
 * B3: creation (manual SEMANTIC relationship, or from a detected foreign key or candidate) and the edition of an
 * existing one (DRAFT edit, B4 correction of an APPROVED one after its confirmation, reactivation of an INACTIVE one).
 * Every save produces a DRAFT in Semantic; approving is a separate action. Objects and pairs are immutable after
 * creation (Semantic): editing changes only the name, description, declared cardinality and JOIN types.
 */
export function RelationshipForm(props: {
  mode: RelationshipFormMode;
  dataSourceId: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { mode, dataSourceId } = props;
  const creating = mode.type === 'create';
  const [values, setValues] = useState<RelationshipValues>(() => (creating ? emptyValues() : valuesOf(mode.relationship)));
  const [step, setStep] = useState<'manual' | 'candidates'>('manual');
  const [focus, setFocus] = useState('');
  const [searched, setSearched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const relations = useRelations(dataSourceId, creating);
  const candidates = useCandidates(dataSourceId, focus, creating && step === 'candidates' && searched);
  const create = useCreateRelationship(dataSourceId);
  const fromFk = useCreateFromForeignKey(dataSourceId);
  const update = useUpdateRelationship(dataSourceId);
  const mutation = creating ? (values.origin === 'foreignKey' ? fromFk : create) : update;
  const errors = validate(values, creating);
  const valid = Object.keys(errors).length === 0;
  const shown = (k: keyof typeof errors) => (submitted && errors[k] ? t(`relationships.form.errors.${errors[k]}`) : undefined);
  const conflict = mutation.error instanceof ApiError && mutation.error.problem.status === 412;
  const set = (patch: Partial<RelationshipValues>) => setValues((v) => ({ ...v, ...patch }));

  useEffect(() => {
    if (!creating) setValues(valuesOf(mode.relationship));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const relationOptions = (relations.data ?? []).map((r) => ({ value: r.id, label: r.naturalKey }));
  const relationName = (id: string) => relationOptions.find((o) => o.value === id)?.label ?? id;
  const title = t(`relationships.form.${mode.type}Title`);
  const note = mode.type === 'create' || mode.type === 'edit' ? t('relationships.form.draftNote') : t(`relationships.form.${mode.type}Note`);

  const submit = async () => {
    setSubmitted(true);
    if (!valid || mutation.isPending) return;
    try {
      let id: string;
      if (!creating) {
        id = (await update.mutateAsync({ id: mode.relationship.id, etag: mode.etag, body: toUpdate(values) })).data.id;
      } else if (values.origin === 'foreignKey') {
        id = (await fromFk.mutateAsync(toFromForeignKey(values))).data.id;
      } else {
        id = (await create.mutateAsync(toCreate(values))).data.id;
      }
      notifications.show({ color: 'nexora', message: creating ? t('relationships.form.created') : t('relationships.form.saved') });
      props.onSaved(id);
    } catch {
      /* Semantic's error is shown in the form */
    }
  };

  return (
    <Modal opened onClose={props.onClose} title={title} size="xl" centered closeButtonProps={{ 'aria-label': t('common.close') }}>
      <Stack gap="sm">
        <Alert color={mode.type === 'correct' ? 'yellow' : 'nexora'} variant="light">{note}</Alert>

        {creating && (
          <SegmentedControl
            aria-label={t('relationships.form.how')}
            value={step}
            onChange={(v) => setStep(v as 'manual' | 'candidates')}
            data={[
              { value: 'manual', label: t('relationships.form.manual') },
              { value: 'candidates', label: t('relationships.form.fromCandidates') },
            ]}
          />
        )}

        {creating && step === 'candidates' && (
          <Stack gap="xs">
            <Text size="xs" className="nexora-secondary-text">{t('relationships.candidates.note')}</Text>
            <Group align="flex-end" gap="xs">
              <Select
                style={{ flex: 1 }}
                label={t('relationships.candidates.focus')}
                placeholder={t('relationships.candidates.allTables')}
                data={relationOptions}
                searchable
                clearable
                value={focus || null}
                onChange={(v) => {
                  setFocus(v ?? '');
                  setSearched(false);
                }}
              />
              <Button variant="light" onClick={() => setSearched(true)} loading={candidates.isFetching}>
                {t('relationships.candidates.search')}
              </Button>
            </Group>
            {candidates.error && <ProblemAlert error={candidates.error} />}
            {candidates.data && (
              <>
                {candidates.data.truncated && <Alert color="gray" variant="light">{t('relationships.candidates.truncated')}</Alert>}
                {candidates.data.candidates.length === 0 ? (
                  <Alert color="gray">{t('relationships.candidates.empty')}</Alert>
                ) : (
                  <Table.ScrollContainer minWidth={560} mah={280}>
                    <Table fz="sm" verticalSpacing={4}>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>{t('relationships.columns.endpoints')}</Table.Th>
                          <Table.Th>{t('relationships.columns.pairs')}</Table.Th>
                          <Table.Th>{t('relationships.columns.origin')}</Table.Th>
                          <Table.Th />
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {candidates.data.candidates.map((c, i) => (
                          <Table.Tr key={`${c.source.objectId}-${c.target.objectId}-${i}`}>
                            <Table.Td>{endpoints(c)}</Table.Td>
                            <Table.Td>{c.pairs.map((p) => `${p.sourceColumn.naturalKey ?? ''} = ${p.targetColumn.naturalKey ?? ''}`).join('; ')}</Table.Td>
                            <Table.Td>
                              <Badge variant="outline" color="nexora">{t(`relationships.origin.${c.suggestedOrigin}`)}</Badge>
                            </Table.Td>
                            <Table.Td>
                              <Button
                                size="xs"
                                variant="light"
                                aria-label={`${t('relationships.candidates.use')}: ${endpoints(c)}`}
                                onClick={() => {
                                  setValues(valuesFromCandidate(c));
                                  setStep('manual');
                                }}
                              >
                                {t('relationships.candidates.use')}
                              </Button>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                )}
              </>
            )}
          </Stack>
        )}

        {(!creating || step === 'manual') && (
          <>
            {creating && values.origin === 'foreignKey' && (
              <Alert color="nexora" variant="light" data-testid="from-foreign-key">
                {t('relationships.form.fromForeignKey', { fk: values.foreignKeyLabel })}{' '}
                <Button size="compact-xs" variant="subtle" onClick={() => setValues(emptyValues())}>
                  {t('relationships.form.startOver')}
                </Button>
              </Alert>
            )}
            <TextInput
              label={t('relationships.form.name')}
              description={creating && values.origin === 'foreignKey' ? t('relationships.form.nameOptionalFk') : undefined}
              required={!(creating && values.origin === 'foreignKey')}
              maxLength={NAME_MAX}
              value={values.name}
              onChange={(e) => set({ name: e.currentTarget.value })}
              error={shown('name')}
            />
            <Textarea
              label={t('relationships.form.description')}
              autosize
              minRows={2}
              maxLength={DESCRIPTION_MAX}
              value={values.description}
              onChange={(e) => set({ description: e.currentTarget.value })}
              error={shown('description')}
            />

            {creating && values.origin === 'manual' ? (
              <>
                <Group grow align="flex-start">
                  <Select
                    label={t('relationships.form.source')}
                    data={relationOptions}
                    searchable
                    required
                    placeholder={relations.isLoading ? t('dictionary.form.loadingOptions') : undefined}
                    value={values.sourceObjectId || null}
                    onChange={(v) => set({ sourceObjectId: v ?? '', pairs: values.pairs.map((p) => ({ ...p, sourceColumnId: '' })) })}
                    error={shown('source')}
                  />
                  <Select
                    label={t('relationships.form.target')}
                    data={relationOptions}
                    searchable
                    required
                    placeholder={relations.isLoading ? t('dictionary.form.loadingOptions') : undefined}
                    value={values.targetObjectId || null}
                    onChange={(v) => set({ targetObjectId: v ?? '', pairs: values.pairs.map((p) => ({ ...p, targetColumnId: '' })) })}
                    error={shown('target')}
                  />
                </Group>
                <PairsEditor
                  dataSourceId={dataSourceId}
                  sourceObjectId={values.sourceObjectId}
                  targetObjectId={values.targetObjectId}
                  pairs={values.pairs}
                  onChange={(pairs) => set({ pairs })}
                  error={shown('pairs')}
                />
              </>
            ) : (
              <Stack gap={4} data-testid="immutable-structure">
                <Text size="sm" fw={500}>{t('relationships.form.structure')}</Text>
                <Text size="sm">
                  {creating
                    ? `${relationName(values.sourceObjectId)} → ${relationName(values.targetObjectId)}`
                    : endpoints(mode.relationship)}
                </Text>
                {!creating && (
                  <Text size="xs" className="nexora-secondary-text">
                    {mode.relationship.pairs.map((p) => `${p.sourceColumn.naturalKey ?? ''} = ${p.targetColumn.naturalKey ?? ''}`).join('; ')}
                  </Text>
                )}
                <Text size="xs" className="nexora-secondary-text">{t('relationships.form.structureImmutable')}</Text>
              </Stack>
            )}

            <SemanticsFields
              cardinality={values.declaredCardinality}
              joinTypes={values.allowedJoinTypes}
              onCardinality={(declaredCardinality) => set({ declaredCardinality })}
              onJoinTypes={(allowedJoinTypes) => set({ allowedJoinTypes })}
              joinTypesError={shown('joinTypes')}
            />
          </>
        )}

        {mutation.error && (conflict ? <Alert color="yellow">{t('relationships.conflict')}</Alert> : <ProblemAlert error={mutation.error} />)}
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={props.onClose}>{t('common.cancel')}</Button>
          <Button onClick={() => void submit()} loading={mutation.isPending} disabled={creating && step === 'candidates'}>
            {t('common.save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
