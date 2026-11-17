import { Alert, Button, Checkbox, Group, Modal, Select, Stack, Switch, Text, TextInput, Textarea } from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { acceptRelationshipSuggestionAsDraft, type AcceptRelationship } from '@/api/semantic';
import { MAX_PAIRS, type Cardinality, type JoinType, type Suggestion } from '@/api/semanticTypes';
import { ProblemAlert } from '@/shared/ProblemAlert';
import { useRelations } from '../dictionary/hooks';
import { DESCRIPTION_MAX, NAME_MAX, endpoints, type PairDraft } from '../relationships/model';
import { PairsEditor } from '../relationships/PairsEditor';
import { SemanticsFields } from '../relationships/SemanticsFields';

/**
 * B3: accepting a RELATIONSHIP suggestion (Semantic `/accept`). D-B: `result` is always DRAFT (added by the API call;
 * the BFF refuses anything else), never omitted: without it Semantic would approve at once for an approver.
 * The person declares the cardinality and JOIN types, confirms every pending point and may correct the target and
 * the column pairs (the source stays: Semantic DEC-G1C-4). A name is required except for an uncorrected foreign key.
 */
export function AcceptRelationshipForm(props: {
  suggestion: Suggestion;
  etag: string;
  dataSourceId: string;
  onClose: () => void;
  onAccepted: (relationshipId?: string) => void;
}) {
  const { t } = useTranslation();
  const s = props.suggestion;
  const content = s.relationship;
  const pending = s.pending ?? [];
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cardinality, setCardinality] = useState<Cardinality>('MANY_TO_ONE');
  const [joinTypes, setJoinTypes] = useState<JoinType[]>(['INNER']);
  const [acknowledged, setAcknowledged] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [targetObjectId, setTarget] = useState(content?.target?.objectId ?? '');
  const [pairs, setPairs] = useState<PairDraft[]>(
    (content?.pairs ?? []).map((p) => ({ sourceColumnId: p.sourceColumn?.objectId ?? '', targetColumnId: p.targetColumn?.objectId ?? '' })),
  );
  const relations = useRelations(props.dataSourceId, correcting);
  const accept = useMutation({
    mutationFn: (body: AcceptRelationship) => acceptRelationshipSuggestionAsDraft(props.dataSourceId, s.id, props.etag, body),
  });
  const isForeignKey = !!content?.foreignKeyId;
  const nameRequired = !isForeignKey || correcting;
  const pairsValid =
    !correcting ||
    (!!targetObjectId && pairs.length > 0 && pairs.length <= MAX_PAIRS && pairs.every((p) => p.sourceColumnId && p.targetColumnId));
  const valid =
    (!nameRequired || name.trim().length > 0) &&
    name.length <= NAME_MAX &&
    description.length <= DESCRIPTION_MAX &&
    joinTypes.length > 0 &&
    pairsValid &&
    (pending.length === 0 || acknowledged);

  const body = (): AcceptRelationship => ({
    ...(name.trim() ? { name: name.trim() } : {}),
    ...(description.trim() ? { description: description.trim() } : {}),
    declaredCardinality: cardinality,
    allowedJoinTypes: [...joinTypes],
    ...(pending.length ? { acknowledgedPending: pending } : {}),
    ...(correcting ? { correction: { targetObjectId, pairs: pairs.map((p) => ({ sourceColumnId: p.sourceColumnId, targetColumnId: p.targetColumnId })) } } : {}),
  });

  return (
    <Modal opened onClose={props.onClose} title={t('suggestions.acceptRelationshipTitle')} centered size="xl" closeButtonProps={{ 'aria-label': t('common.close') }}>
      <Stack gap="sm">
        <Alert color="nexora" variant="light">{t('suggestions.acceptRelationshipNote')}</Alert>
        <Text size="sm">
          {t('suggestions.proposed')}: <b>{content ? endpoints(content) : '—'}</b>
        </Text>
        <TextInput
          label={t('relationships.form.name')}
          description={nameRequired ? undefined : t('relationships.form.nameOptionalFk')}
          required={nameRequired}
          maxLength={NAME_MAX}
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <Textarea label={t('relationships.form.description')} autosize minRows={2} maxLength={DESCRIPTION_MAX} value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
        <SemanticsFields cardinality={cardinality} joinTypes={joinTypes} onCardinality={setCardinality} onJoinTypes={setJoinTypes} />
        <Switch
          checked={correcting}
          onChange={(e) => setCorrecting(e.currentTarget.checked)}
          label={t('suggestions.correctRelationship')}
          description={t('suggestions.correctRelationshipHint')}
        />
        {correcting && content?.source && (
          <Stack gap="xs" data-testid="relationship-correction">
            <Text size="sm">
              {t('relationships.form.source')}: <b>{content.source.naturalKey ?? content.source.objectId}</b>
            </Text>
            <Select
              label={t('relationships.form.target')}
              data={(relations.data ?? []).map((r) => ({ value: r.id, label: r.naturalKey }))}
              searchable
              required
              value={targetObjectId || null}
              onChange={(v) => {
                setTarget(v ?? '');
                setPairs(pairs.map((p) => ({ ...p, targetColumnId: '' })));
              }}
            />
            <PairsEditor dataSourceId={props.dataSourceId} sourceObjectId={content.source.objectId} targetObjectId={targetObjectId} pairs={pairs} onChange={setPairs} />
          </Stack>
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
          <Button disabled={!valid} loading={accept.isPending} onClick={() => accept.mutate(body(), { onSuccess: (r) => props.onAccepted(r.relationshipId) })}>
            {t('suggestions.accept')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
