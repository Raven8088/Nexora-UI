import { Alert, Button, Checkbox, Group, Modal, SegmentedControl, Select, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { ApiError } from '@/api/problem';
import { AGGREGATIONS, DEFINITION_KINDS, DIMENSION_TYPES, GRANULARITIES, type Definition } from '@/api/semanticTypes';
import { ProblemAlert } from '@/shared/ProblemAlert';
import { emptyForm, formOf, formSchema, toCreate, toUpdate, type FormValues } from './formModel';
import { useColumns, useCreateDefinition, useRelations, useUpdateDefinition } from './hooks';

export type FormMode = { type: 'create' } | { type: 'edit' | 'correct' | 'reactivate'; definition: Definition; etag: string };

/**
 * Creation, edition of a DRAFT, correction of an APPROVED definition (B4, after the confirmation of its consequences)
 * and reactivation of an INACTIVE one. Every save produces a DRAFT in Semantic (`revise`); the approval is a separate
 * action. Tables, columns and concepts are chosen by name, never typed as ids.
 */
export function DefinitionForm(props: {
  opened: boolean;
  mode: FormMode;
  dataSourceId: string;
  definitions: Definition[];
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { mode, dataSourceId } = props;
  const creating = mode.type === 'create';
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: creating ? emptyForm() : formOf(mode.definition),
  });
  const { control, register, handleSubmit, watch, reset, formState } = form;

  useEffect(() => {
    if (props.opened) reset(creating ? emptyForm() : formOf((mode as { definition: Definition }).definition));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.opened]);

  const kind = watch('kind');
  const conceptId = watch('conceptId');
  const aggregation = watch('aggregation');
  const dimensionType = watch('dimensionType');
  const concept = props.definitions.find((d) => d.id === conceptId);
  const relations = useRelations(dataSourceId, props.opened && kind === 'CONCEPT');
  const columns = useColumns(dataSourceId, kind === 'CONCEPT' ? undefined : concept?.concept?.relationId);

  const create = useCreateDefinition(dataSourceId);
  const update = useUpdateDefinition(dataSourceId);
  const mutation = creating ? create : update;
  const conflict = mutation.error instanceof ApiError && mutation.error.problem.status === 412;

  const err = (name: keyof FormValues) => {
    const m = formState.errors[name]?.message;
    return m ? t(`dictionary.form.errors.${m}`) : undefined;
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (creating) {
        const r = await create.mutateAsync(toCreate(values));
        notifications.show({ message: t('dictionary.form.created'), color: 'nexora' });
        props.onSaved(r.data.id);
      } else {
        const m = mode as { definition: Definition; etag: string };
        const r = await update.mutateAsync({ id: m.definition.id, etag: m.etag, body: toUpdate(values) });
        notifications.show({ message: t('dictionary.form.saved'), color: 'nexora' });
        props.onSaved(r.data.id);
      }
    } catch {
      /* the error of Semantic is shown in the form (mutation.error) */
    }
  });

  const conceptOptions = props.definitions
    .filter((d) => d.kind === 'CONCEPT' && d.status !== 'INACTIVE')
    .map((d) => ({ value: d.id, label: `${d.name} (${t(`dictionary.statusShort.${d.status}`)})` }));
  const columnOptions = (columns.data ?? []).map((c) => ({ value: c.id, label: c.childName ?? c.naturalKey }));
  const relationOptions = (relations.data ?? []).map((r) => ({ value: r.id, label: r.naturalKey }));

  const title = t(`dictionary.form.${mode.type}Title`);
  const note = mode.type === 'create' || mode.type === 'edit' ? t('dictionary.form.draftNote') : t(`dictionary.form.${mode.type}Note`);

  return (
    <Modal opened={props.opened} onClose={props.onClose} title={title} size="lg" centered closeButtonProps={{ 'aria-label': t('common.close') }}>
      <form onSubmit={onSubmit} noValidate>
        <Stack gap="sm">
          <Alert color={mode.type === 'correct' ? 'yellow' : 'nexora'} variant="light">
            {note}
          </Alert>
          {creating && (
            <Controller
              control={control}
              name="kind"
              render={({ field }) => (
                <Stack gap={4}>
                  <Text size="sm" fw={500}>{t('dictionary.form.kind')}</Text>
                  <SegmentedControl
                    value={field.value}
                    onChange={(v) => field.onChange(v)}
                    data={DEFINITION_KINDS.map((k) => ({ value: k, label: t(`dictionary.kind.${k}`) }))}
                  />
                </Stack>
              )}
            />
          )}
          <TextInput
            label={t('dictionary.form.key')}
            description={t('dictionary.form.keyHint')}
            disabled={!creating}
            required={creating}
            error={err('key')}
            {...register('key')}
          />
          <TextInput label={t('dictionary.form.name')} required maxLength={200} error={err('name')} {...register('name')} />
          <Textarea label={t('dictionary.form.description')} autosize minRows={2} maxLength={2000} error={err('description')} {...register('description')} />

          {kind === 'CONCEPT' && (
            <Controller
              control={control}
              name="relationId"
              render={({ field }) => (
                <Select
                  label={t('dictionary.form.relation')}
                  description={t('dictionary.form.relationHint')}
                  placeholder={relations.isLoading ? t('dictionary.form.loadingOptions') : undefined}
                  data={relationOptions}
                  searchable
                  required
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? '')}
                  error={err('relationId')}
                />
              )}
            />
          )}

          {kind !== 'CONCEPT' && (
            <Controller
              control={control}
              name="conceptId"
              render={({ field }) => (
                <Select
                  label={t('dictionary.form.concept')}
                  description={t('dictionary.form.conceptHint')}
                  data={conceptOptions}
                  searchable
                  required
                  value={field.value || null}
                  onChange={(v) => {
                    field.onChange(v ?? '');
                    form.setValue('columnId', '');
                  }}
                  error={err('conceptId')}
                />
              )}
            />
          )}

          {kind === 'METRIC' && (
            <Controller
              control={control}
              name="aggregation"
              render={({ field }) => (
                <Select
                  label={t('dictionary.form.aggregation')}
                  data={AGGREGATIONS.map((a) => ({ value: a, label: t(`dictionary.form.aggregationValue.${a}`) }))}
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? 'COUNT')}
                  allowDeselect={false}
                  required
                />
              )}
            />
          )}

          {kind !== 'CONCEPT' && (
            <Controller
              control={control}
              name="columnId"
              render={({ field }) => (
                <Select
                  label={t('dictionary.form.column')}
                  description={kind === 'METRIC' ? (aggregation === 'COUNT' ? t('dictionary.form.columnOptionalCount') : t('dictionary.form.columnRequired')) : undefined}
                  placeholder={columns.isLoading ? t('dictionary.form.loadingOptions') : undefined}
                  data={columnOptions}
                  searchable
                  clearable={kind === 'METRIC' && aggregation === 'COUNT'}
                  disabled={!concept}
                  required={kind === 'DIMENSION' || aggregation !== 'COUNT'}
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? '')}
                  error={err('columnId')}
                />
              )}
            />
          )}

          {kind === 'DIMENSION' && (
            <>
              <Controller
                control={control}
                name="dimensionType"
                render={({ field }) => (
                  <Select
                    label={t('dictionary.form.dimensionType')}
                    data={DIMENSION_TYPES.map((d) => ({ value: d, label: t(`dictionary.form.dimensionTypeValue.${d}`) }))}
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? 'CATEGORICAL')}
                    allowDeselect={false}
                    required
                  />
                )}
              />
              {dimensionType === 'TEMPORAL' && (
                <>
                  <Controller
                    control={control}
                    name="granularities"
                    render={({ field }) => (
                      <Checkbox.Group label={t('dictionary.form.granularities')} value={field.value} onChange={(v) => field.onChange(v)}>
                        <Group mt={4}>
                          {GRANULARITIES.map((g) => (
                            <Checkbox key={g} value={g} label={t(`dictionary.form.granularityValue.${g}`)} />
                          ))}
                        </Group>
                      </Checkbox.Group>
                    )}
                  />
                  <TextInput label={t('dictionary.form.timeZone')} maxLength={64} error={err('timeZone')} {...register('timeZone')} />
                </>
              )}
            </>
          )}

          {mutation.error && (conflict ? <Alert color="yellow">{t('dictionary.conflict')}</Alert> : <ProblemAlert error={mutation.error} />)}
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={props.onClose}>{t('common.cancel')}</Button>
            <Button type="submit" loading={mutation.isPending}>{t('common.save')}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
