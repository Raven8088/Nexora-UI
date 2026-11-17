import { Alert, Badge, Button, Code, Drawer, Group, List, Select, Stack, Table, Text, Timeline, UnstyledButton } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getSuggestion, listSuggestions, rejectSuggestion, reopenSuggestion, suggestionHistory } from '@/api/semantic';
import { useSession } from '@/auth/SessionProvider';
import { useSource } from '@/context/SourceContext';
import { useActorLabel } from '@/shared/actor';
import { AuditTimeline, auditKey } from '@/shared/AuditTimeline';
import { ConfirmDialog, SUGGESTION_REASON_MAX } from '@/shared/ConfirmDialog';
import { formatDateTime } from '@/shared/format';
import { LoadingState } from '@/shared/LoadingState';
import { PageHeader } from '@/shared/PageHeader';
import { ProblemAlert } from '@/shared/ProblemAlert';
import { endpoints } from '../relationships/model';
import { AcceptDefinitionForm } from './AcceptDefinitionForm';
import { AcceptRelationshipForm } from './AcceptRelationshipForm';

const KINDS = ['CONCEPT', 'METRIC', 'DIMENSION', 'RELATIONSHIP'];
const STATUSES = ['OPEN', 'ACCEPTED', 'REJECTED', 'STALE', 'SUPERSEDED'];
const RELEVANCES = ['HIGH', 'MEDIUM', 'LOW'];
const DEFINITION_KINDS = new Set(['CONCEPT', 'METRIC', 'DIMENSION']);

function SuggestionDrawer({ id, dataSourceId, onClose }: { id: string | undefined; dataSourceId: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const navigate = useNavigate();
  const actor = useActorLabel();
  const detail = useQuery({ queryKey: ['suggestion', dataSourceId, id], queryFn: () => getSuggestion(dataSourceId, id as string), enabled: !!id });
  const history = useQuery({ queryKey: ['suggestion-history', dataSourceId, id], queryFn: () => suggestionHistory(dataSourceId, id as string), enabled: !!id });
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['suggestions', dataSourceId] });
    void client.invalidateQueries({ queryKey: ['suggestion', dataSourceId, id] });
    void client.invalidateQueries({ queryKey: ['suggestion-history', dataSourceId, id] });
    void client.invalidateQueries({ queryKey: ['definitions', dataSourceId] });
    void client.invalidateQueries({ queryKey: ['relationships', dataSourceId] });
    if (id) void client.invalidateQueries({ queryKey: auditKey('SEMANTIC_SUGGESTION', id) });
  };
  const reject = useMutation({
    mutationFn: (reason: string) => rejectSuggestion(dataSourceId, id as string, detail.data?.etag as string, reason),
    onSuccess: () => {
      setRejecting(false);
      notifications.show({ color: 'nexora', message: t('suggestions.rejected') });
      refresh();
    },
  });
  const reopen = useMutation({
    mutationFn: () => reopenSuggestion(dataSourceId, id as string, detail.data?.etag as string),
    onSuccess: () => {
      notifications.show({ color: 'nexora', message: t('suggestions.reopened') });
      refresh();
    },
  });
  const s = detail.data?.data;
  const def = s?.definition;
  return (
    <Drawer opened={!!id} onClose={onClose} position="right" size="lg" closeButtonProps={{ 'aria-label': t('common.close') }} title={s ? t(`suggestions.kind.${s.kind}`, { defaultValue: s.kind }) : t('common.loading')}>
      {detail.isLoading && <LoadingState />}
      {detail.error && <ProblemAlert error={detail.error} />}
      {s && (
        <Stack gap="md">
          <Group gap="xs">
            <Badge variant="light">{t(`suggestions.status.${s.status}`, { defaultValue: s.status })}</Badge>
            {s.relevance && <Badge variant="outline">{t(`suggestions.relevance.${s.relevance}`, { defaultValue: s.relevance })}</Badge>}
            {typeof s.confidence === 'number' && <Badge variant="outline">{t('suggestions.confidence')}: {Math.round(s.confidence * 100)}%</Badge>}
          </Group>
          {s.objectsChanged && <Alert color="yellow">{t('suggestions.objectsChanged')}</Alert>}
          {s.relationship && (
            <Stack gap={4} data-testid="relationship-content">
              <Text fw={600} size="sm">{t('suggestions.content')}</Text>
              <Text size="sm">{endpoints(s.relationship)}</Text>
              {s.relationship.pairs.map((p, i) => (
                <Text key={i} size="sm">
                  {p.sourceColumn?.naturalKey ?? p.sourceColumn?.objectId ?? '—'} = {p.targetColumn?.naturalKey ?? p.targetColumn?.objectId ?? '—'}
                </Text>
              ))}
              {s.relationship.foreignKeyId && <Text size="xs" className="nexora-secondary-text">{t('suggestions.fromForeignKey')}</Text>}
            </Stack>
          )}
          {def && (
            <Stack gap={4}>
              <Text fw={600} size="sm">{t('suggestions.content')}</Text>
              {def.relation?.naturalKey && <Text size="sm">{t('suggestions.relation')}: {def.relation.naturalKey}</Text>}
              {def.column?.naturalKey && <Text size="sm">{t('suggestions.column')}: {def.column.naturalKey}</Text>}
              {def.aggregation && <Text size="sm">{t('suggestions.aggregation')}: {def.aggregation}</Text>}
              {def.dimensionType && <Text size="sm">{t('suggestions.dimensionType')}: {def.dimensionType}</Text>}
              {s.suggestedKey && <Text size="sm">{t('dictionary.form.key')}: <Code>{s.suggestedKey}</Code></Text>}
            </Stack>
          )}
          <Stack gap={4}>
            <Text fw={600} size="sm">{t('suggestions.evidence')}</Text>
            {(s.evidence ?? []).length === 0 ? (
              <Text size="sm">{t('suggestions.noEvidence')}</Text>
            ) : (
              <List size="sm">
                {(s.evidence ?? []).map((e, i) => (
                  <List.Item key={`${e.code}-${i}`}><Code>{e.code}</Code> {e.detail ?? ''}</List.Item>
                ))}
              </List>
            )}
          </Stack>
          {(s.pending ?? []).length > 0 && (
            <Stack gap={4}>
              <Text fw={600} size="sm">{t('suggestions.pending')}</Text>
              <List size="sm">{(s.pending ?? []).map((p) => <List.Item key={p}>{t(`suggestions.pendingValue.${p}`, { defaultValue: p })}</List.Item>)}</List>
            </Stack>
          )}
          {(s.exposure ?? []).length > 0 && (
            <Stack gap={4}>
              <Text fw={600} size="sm">{t('suggestions.exposure')}</Text>
              <List size="sm">{(s.exposure ?? []).map((x) => <List.Item key={x.objectId}>{x.naturalKey ?? x.objectId}: {x.state}</List.Item>)}</List>
            </Stack>
          )}
          {s.createdVia === 'ASSISTED' && (
            <Text size="sm" data-testid="assisted-origin">
              {t('suggestions.assistedOrigin', { actor: actor(s.openedBy?.id) })}
            </Text>
          )}
          {s.decision && (
            <Stack gap={4}>
              <Text fw={600} size="sm">{t('suggestions.decision')}</Text>
              <Text size="sm">
                {actor(s.decision.decidedBy?.id)} · {s.decision.resultMode ? t(`suggestions.resultMode.${s.decision.resultMode}`, { defaultValue: s.decision.resultMode }) : ''}
                {s.decision.reason ? ` · ${s.decision.reason}` : ''}
              </Text>
              {s.decision.resultDefinitionId && (
                <Button size="xs" variant="subtle" w="fit-content" onClick={() => navigate(`/diccionario?id=${s.decision?.resultDefinitionId}`)}>{t('suggestions.openDefinition')}</Button>
              )}
              {s.decision.resultRelationshipId && (
                <Button size="xs" variant="subtle" w="fit-content" onClick={() => navigate(`/diccionario/relaciones?id=${s.decision?.resultRelationshipId}`)}>{t('suggestions.openRelationship')}</Button>
              )}
            </Stack>
          )}
          <Group gap="xs">
            {s.status === 'OPEN' && (DEFINITION_KINDS.has(s.kind) || (s.kind === 'RELATIONSHIP' && !!s.relationship)) && (
              <Button size="xs" onClick={() => setAccepting(true)}>{t('suggestions.accept')}</Button>
            )}
            {s.status === 'OPEN' && <Button size="xs" variant="outline" onClick={() => setRejecting(true)}>{t('suggestions.reject')}</Button>}
            {s.status === 'REJECTED' && <Button size="xs" variant="light" loading={reopen.isPending} onClick={() => reopen.mutate()}>{t('suggestions.reopen')}</Button>}
          </Group>
          {(reject.error ?? reopen.error) && <ProblemAlert error={reject.error ?? reopen.error} />}
          {(history.data ?? []).length > 1 && (
            <Stack gap={4}>
              <Text fw={600} size="sm">{t('suggestions.history')}</Text>
              <Timeline bulletSize={12}>
                {(history.data ?? []).map((v) => (
                  <Timeline.Item key={v.id} title={t(`suggestions.status.${v.status}`, { defaultValue: v.status })}>
                    <Text size="xs" className="nexora-secondary-text">{formatDateTime(v.createdAt, i18n.language)}</Text>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Stack>
          )}
          <Stack gap={4}>
            <Text fw={600} size="sm">{t('suggestions.audit')}</Text>
            <AuditTimeline targetType="SEMANTIC_SUGGESTION" targetId={s.id} />
          </Stack>
          {accepting && detail.data && s.kind === 'RELATIONSHIP' && (
            <AcceptRelationshipForm
              suggestion={s}
              etag={detail.data.etag}
              dataSourceId={dataSourceId}
              onClose={() => setAccepting(false)}
              onAccepted={(relationshipId) => {
                setAccepting(false);
                notifications.show({ color: 'nexora', message: t('suggestions.acceptedRelationship') });
                refresh();
                if (relationshipId) navigate(`/diccionario/relaciones?id=${relationshipId}`);
              }}
            />
          )}
          {accepting && detail.data && s.kind !== 'RELATIONSHIP' && (
            <AcceptDefinitionForm
              suggestion={s}
              etag={detail.data.etag}
              dataSourceId={dataSourceId}
              onClose={() => setAccepting(false)}
              onAccepted={(definitionId) => {
                setAccepting(false);
                notifications.show({ color: 'nexora', message: t('suggestions.accepted') });
                refresh();
                if (definitionId) navigate(`/diccionario?id=${definitionId}`);
              }}
            />
          )}
          <ConfirmDialog
            opened={rejecting}
            title={t('suggestions.rejectTitle')}
            confirmLabel={t('suggestions.reject')}
            danger
            requireReason
            maxReason={SUGGESTION_REASON_MAX}
            busy={reject.isPending}
            onClose={() => setRejecting(false)}
            onConfirm={(reason) => reject.mutate(reason)}
          />
        </Stack>
      )}
    </Drawer>
  );
}

export function SuggestionsPage() {
  const { t, i18n } = useTranslation();
  const { permissions } = useSession();
  const { source } = useSource();
  const [kind, setKind] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>('OPEN');
  const [relevance, setRelevance] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | undefined>();
  const list = useQuery({
    queryKey: ['suggestions', source?.dataSourceId, kind, status, relevance],
    queryFn: () => listSuggestions(source?.dataSourceId as string, { kind: kind ?? undefined, status: status ?? undefined, relevance: relevance ?? undefined }),
    enabled: !!source && permissions.proposalWrite,
  });
  if (!permissions.proposalWrite) return <Alert color="gray">{t('suggestions.noPermission')}</Alert>;
  if (!source) return <Alert color="yellow">{t('common.noSource')}</Alert>;
  return (
    <Stack gap="md">
      <PageHeader title={t('suggestions.title')} subtitle={t('suggestions.subtitle')} />
      <Group gap="sm" wrap="wrap">
        <Select label={t('suggestions.kindFilter')} w={170} clearable placeholder={t('common.all')} value={kind} onChange={setKind} data={KINDS.map((k) => ({ value: k, label: t(`suggestions.kind.${k}`) }))} />
        <Select label={t('suggestions.statusFilter')} w={170} clearable placeholder={t('common.all')} value={status} onChange={setStatus} data={STATUSES.map((k) => ({ value: k, label: t(`suggestions.status.${k}`) }))} />
        <Select label={t('suggestions.relevanceFilter')} w={170} clearable placeholder={t('common.all')} value={relevance} onChange={setRelevance} data={RELEVANCES.map((k) => ({ value: k, label: t(`suggestions.relevance.${k}`) }))} />
      </Group>
      {list.isLoading && <LoadingState />}
      {list.error && <ProblemAlert error={list.error} />}
      {list.data && list.data.length === 0 && <Alert color="gray">{t('suggestions.empty')}</Alert>}
      {list.data && list.data.length > 0 && (
        <Table.ScrollContainer minWidth={640}>
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('suggestions.kindFilter')}</Table.Th>
                <Table.Th>{t('suggestions.content')}</Table.Th>
                <Table.Th>{t('suggestions.relevanceFilter')}</Table.Th>
                <Table.Th>{t('suggestions.statusFilter')}</Table.Th>
                <Table.Th>{t('dictionary.columns.updated')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {list.data.map((s) => (
                <Table.Tr key={s.id}>
                  <Table.Td>{t(`suggestions.kind.${s.kind}`, { defaultValue: s.kind })}</Table.Td>
                  <Table.Td>
                    <UnstyledButton onClick={() => setSelected(s.id)}>
                      <Text size="sm" fw={600} c="var(--nexora-accent)">
                        {s.suggestedKey ?? (s.relationship ? endpoints(s.relationship) : undefined) ?? s.definition?.column?.naturalKey ?? s.definition?.relation?.naturalKey ?? s.id}
                      </Text>
                    </UnstyledButton>
                  </Table.Td>
                  <Table.Td>{s.relevance ? t(`suggestions.relevance.${s.relevance}`, { defaultValue: s.relevance }) : '—'}</Table.Td>
                  <Table.Td>{t(`suggestions.status.${s.status}`, { defaultValue: s.status })}</Table.Td>
                  <Table.Td>{formatDateTime(s.createdAt, i18n.language)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
      <SuggestionDrawer id={selected} dataSourceId={source.dataSourceId} onClose={() => setSelected(undefined)} />
    </Stack>
  );
}
