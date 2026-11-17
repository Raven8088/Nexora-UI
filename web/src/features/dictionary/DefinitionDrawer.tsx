import { Alert, Anchor, Badge, Button, Code, Divider, Drawer, Group, List, Stack, Table, Tabs, Text, Tooltip } from '@mantine/core';
import { IconCheck, IconEditCircle, IconHistory, IconPencil, IconPlayerStop, IconRefresh, IconX } from '@tabler/icons-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { ApiError } from '@/api/problem';
import type { Definition } from '@/api/semanticTypes';
import { useSession } from '@/auth/SessionProvider';
import { KindBadge, StatusBadge } from '@/shared/Badges';
import { useActorLabel, useIsOwnWork } from '@/shared/actor';
import { AuditTimeline } from '@/shared/AuditTimeline';
import { ConfirmDialog } from '@/shared/ConfirmDialog';
import { CorrectionConsequences } from '@/shared/CorrectionConsequences';
import { formatDateTime } from '@/shared/format';
import { LoadingState } from '@/shared/LoadingState';
import { ProblemAlert } from '@/shared/ProblemAlert';
import { actionsFor, conceptOf, dependentsOf, type Action } from './lifecycle';
import { useApproveDefinition, useDeactivateDefinition, useDefinition } from './hooks';
import type { FormMode } from './DefinitionForm';

const ICONS: Record<Action, JSX.Element> = {
  edit: <IconPencil size={16} />,
  correct: <IconEditCircle size={16} />,
  approve: <IconCheck size={16} />,
  reject: <IconX size={16} />,
  retire: <IconPlayerStop size={16} />,
  reactivate: <IconRefresh size={16} />,
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Group gap="xs" align="flex-start" wrap="nowrap">
      <Text size="sm" className="nexora-secondary-text" w={190} style={{ flexShrink: 0 }}>{label}</Text>
      <Text size="sm" component="div" style={{ wordBreak: 'break-word' }}>{children}</Text>
    </Group>
  );
}

/** The detail of a definition, its references, problems, dependencies, history and the governance actions. */
export function DefinitionDrawer(props: {
  dataSourceId: string;
  definitionId: string | undefined;
  definitions: Definition[];
  onClose: () => void;
  onOpen: (id: string) => void;
  onForm: (mode: FormMode) => void;
}) {
  const { t, i18n } = useTranslation();
  const { permissions } = useSession();
  const query = useDefinition(props.dataSourceId, props.definitionId);
  const actor = useActorLabel();
  const isOwnWork = useIsOwnWork();
  const approve = useApproveDefinition(props.dataSourceId);
  const deactivate = useDeactivateDefinition(props.dataSourceId);
  const [dialog, setDialog] = useState<Action | null>(null);

  const d = query.data?.data;
  const etag = query.data?.etag;
  const nameOf = (id: string | null | undefined) => props.definitions.find((x) => x.id === id)?.name ?? id ?? '—';
  const dependents = d ? dependentsOf(d, props.definitions) : [];
  const concept = d ? conceptOf(d, props.definitions) : undefined;
  const conflictOf = (e: unknown) => e instanceof ApiError && e.problem.status === 412;

  const run = (action: Action, reason: string) => {
    if (!d || !etag) return;
    const done = () => {
      setDialog(null);
      notifications.show({ color: 'nexora', message: t(`dictionary.${action === 'approve' ? 'approve' : action}.done`) });
    };
    if (action === 'approve') approve.mutate({ id: d.id, etag }, { onSuccess: done });
    if (action === 'reject' || action === 'retire') deactivate.mutate({ id: d.id, etag, reason }, { onSuccess: done });
  };

  const onAction = (action: Action) => {
    if (!d || !etag) return;
    if (action === 'edit') props.onForm({ type: 'edit', definition: d, etag });
    // B4: correcting an APPROVED definition first needs the explicit confirmation of its consequences
    else if (action === 'correct') setDialog('correct');
    else if (action === 'reactivate') props.onForm({ type: 'reactivate', definition: d, etag });
    else setDialog(action);
  };

  const mutationError = approve.error ?? deactivate.error;

  return (
    <Drawer opened={!!props.definitionId} onClose={props.onClose} position="right" size="xl" closeButtonProps={{ 'aria-label': t('common.close') }} title={d?.name ?? t('common.loading')}>
      {query.isLoading && <LoadingState />}
      {query.error && <ProblemAlert error={query.error} />}
      {d && (
        <Stack gap="md">
          <Group gap="xs">
            <KindBadge kind={d.kind} />
            <StatusBadge status={d.status} />
            <Badge color="nexora" variant="light" style={d.usable ? undefined : { background: 'var(--nexora-status-inactive-bg)', color: 'var(--nexora-status-inactive-text)' }}>{t(`dictionary.usable.${d.usable}`)}</Badge>
          </Group>
          <Text size="xs" className="nexora-secondary-text">{t('dictionary.lifecycleNote')}</Text>

          <Group gap="xs">
            {actionsFor(d, permissions).map((a) =>
              a.allowed ? (
                <Button key={a.action} size="xs" variant={a.action === 'approve' ? 'filled' : a.action === 'reject' || a.action === 'retire' ? 'outline' : 'light'} leftSection={ICONS[a.action]} onClick={() => onAction(a.action)} disabled={approve.isPending || deactivate.isPending}>
                  {t(`dictionary.actions.${a.action}`)}
                </Button>
              ) : (
                <Tooltip key={a.action} label={t(a.reasonKey ?? '')} multiline w={320} withArrow>
                  <span>
                    <Button size="xs" variant="light" disabled leftSection={ICONS[a.action]}>{t(`dictionary.actions.${a.action}`)}</Button>
                  </span>
                </Tooltip>
              ),
            )}
          </Group>
          {mutationError && (conflictOf(mutationError) ? (
            <Alert color="yellow">
              {t('dictionary.conflict')}{' '}
              <Anchor component="button" onClick={() => void query.refetch()}>{t('common.reload')}</Anchor>
            </Alert>
          ) : <ProblemAlert error={mutationError} />)}

          <Tabs defaultValue="summary" keepMounted={false}>
            <Tabs.List>
              <Tabs.Tab value="summary">{t('dictionary.detail.tabs.summary')}</Tabs.Tab>
              <Tabs.Tab value="references">{t('dictionary.detail.tabs.references')}</Tabs.Tab>
              <Tabs.Tab value="issues">
                {t('dictionary.detail.tabs.issues')} {d.issues.length > 0 && <Badge size="xs" color="nexora" ml={4}>{d.issues.length}</Badge>}
              </Tabs.Tab>
              <Tabs.Tab value="dependencies">{t('dictionary.detail.tabs.dependencies')}</Tabs.Tab>
              <Tabs.Tab value="history" leftSection={<IconHistory size={14} />}>{t('dictionary.detail.tabs.history')}</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="summary" pt="md">
              <Stack gap="xs">
                <Text fw={600} size="sm">{t('dictionary.detail.description')}</Text>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{d.description || t('dictionary.detail.noDescription')}</Text>
                <Divider my="xs" />
                <Field label={t('dictionary.form.key')}>{d.key}</Field>
                <Field label={t('dictionary.detail.version')}>{d.version}</Field>
                <Field label={t('dictionary.detail.origin')}>
                  {t(`dictionary.detail.originValue.${d.origin ?? 'MANUAL'}`, { defaultValue: d.origin ?? '—' })}
                  <Text size="xs" className="nexora-secondary-text">{t('dictionary.detail.originNote')}</Text>
                </Field>
                <Field label={t('dictionary.detail.createdBy')}>{actor(d.createdBy)} · {formatDateTime(d.createdAt, i18n.language)}</Field>
                <Field label={t('dictionary.detail.updatedBy')}>{actor(d.updatedBy)} · {formatDateTime(d.updatedAt, i18n.language)}</Field>
                {d.approvedBy && <Field label={t('dictionary.detail.approvedBy')}>{actor(d.approvedBy)} · {formatDateTime(d.approvedAt, i18n.language)}</Field>}
                {d.inactiveReason && <Field label={t('dictionary.detail.inactiveReason')}>{d.inactiveReason}</Field>}
                <Field label={t('dictionary.detail.technicalId')}><Code>{d.id}</Code></Field>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="references" pt="md">
              <Stack gap="xs">
                {d.concept && <Field label={t('dictionary.detail.relation')}>{d.concept.relationNaturalKey ?? d.concept.relationId}</Field>}
                {d.metric && (
                  <>
                    <Field label={t('dictionary.detail.concept')}>
                      <Anchor component="button" onClick={() => props.onOpen(d.metric!.conceptId)}>{nameOf(d.metric.conceptId)}</Anchor>
                    </Field>
                    <Field label={t('dictionary.detail.aggregation')}>{t(`dictionary.form.aggregationValue.${d.metric.aggregation}`)}</Field>
                    <Field label={t('dictionary.detail.column')}>{d.metric.columnNaturalKey ?? t('dictionary.detail.countsRows')}</Field>
                  </>
                )}
                {d.dimension && (
                  <>
                    <Field label={t('dictionary.detail.concept')}>
                      <Anchor component="button" onClick={() => props.onOpen(d.dimension!.conceptId)}>{nameOf(d.dimension.conceptId)}</Anchor>
                    </Field>
                    <Field label={t('dictionary.detail.column')}>{d.dimension.columnNaturalKey ?? d.dimension.columnId}</Field>
                    <Field label={t('dictionary.detail.dimensionType')}>{t(`dictionary.form.dimensionTypeValue.${d.dimension.type}`)}</Field>
                    {d.dimension.valueType && <Field label={t('dictionary.detail.valueType')}>{d.dimension.valueType}</Field>}
                    {d.dimension.type === 'TEMPORAL' && (
                      <>
                        <Field label={t('dictionary.detail.granularities')}>{(d.dimension.granularities ?? []).map((g) => t(`dictionary.form.granularityValue.${g}`, { defaultValue: g })).join(', ') || '—'}</Field>
                        <Field label={t('dictionary.detail.timeZone')}>{d.dimension.timeZone ?? '—'}</Field>
                      </>
                    )}
                  </>
                )}
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="issues" pt="md">
              {d.issues.length === 0 ? (
                <Text size="sm">{t('dictionary.detail.noIssues')}</Text>
              ) : (
                <Stack gap="xs">
                  <Alert color="red" variant="light">{t('dictionary.detail.issuesIntro')}</Alert>
                  <Table fz="sm">
                    <Table.Tbody>
                      {d.issues.map((issue, i) => (
                        <Table.Tr key={`${issue.code}-${i}`}>
                          <Table.Td><Code>{issue.code}</Code></Table.Td>
                          <Table.Td>{issue.field ?? ''}</Table.Td>
                          <Table.Td>{issue.message ?? ''}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Stack>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="dependencies" pt="md">
              <Stack gap="sm">
                {concept && (
                  <Field label={t('dictionary.detail.dependsOn')}>
                    <Anchor component="button" onClick={() => props.onOpen(concept.id)}>{concept.name}</Anchor> <StatusBadge status={concept.status} short />
                  </Field>
                )}
                {d.kind === 'CONCEPT' && (
                  <>
                    <Text fw={600} size="sm">{t('dictionary.detail.usedBy')}</Text>
                    {dependents.length === 0 ? (
                      <Text size="sm">{t('dictionary.detail.noDependents')}</Text>
                    ) : (
                      <List size="sm">
                        {dependents.map((x) => (
                          <List.Item key={x.id}>
                            <Anchor component="button" onClick={() => props.onOpen(x.id)}>{x.name}</Anchor> · {t(`dictionary.kind.${x.kind}`)} · {t(`dictionary.statusShort.${x.status}`)}
                          </List.Item>
                        ))}
                      </List>
                    )}
                  </>
                )}
                <Alert color="gray" variant="light">{t('dictionary.detail.hiddenDependencies')}</Alert>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="history" pt="md">
              <AuditTimeline targetType="SEMANTIC_DEFINITION" targetId={d.id} />
            </Tabs.Panel>
          </Tabs>
        </Stack>
      )}

      {d && (
        <>
          <ConfirmDialog
            opened={dialog === 'approve'}
            title={t('dictionary.approve.title')}
            confirmLabel={t('dictionary.actions.approve')}
            busy={approve.isPending}
            onClose={() => setDialog(null)}
            onConfirm={(reason) => run('approve', reason)}
          >
            <Stack gap="xs">
              <Text size="sm">{t('dictionary.approve.text', { name: d.name })}</Text>
              {isOwnWork(d.createdBy, d.updatedBy) && (
                <Alert color="yellow" data-testid="self-approval">{t('dictionary.approve.selfApproval')}</Alert>
              )}
              {d.issues.length > 0 && <Alert color="yellow">{t('dictionary.approve.issuesWarning')}</Alert>}
            </Stack>
          </ConfirmDialog>
          <ConfirmDialog
            opened={dialog === 'correct'}
            title={t('dictionary.correct.title')}
            confirmLabel={t('dictionary.correct.continue')}
            acknowledgeLabel={t('correction.acknowledge')}
            onClose={() => setDialog(null)}
            onConfirm={() => {
              setDialog(null);
              if (etag) props.onForm({ type: 'correct', definition: d, etag });
            }}
          >
            <CorrectionConsequences name={d.name} dependents={dependents.map((x) => x.name)} />
          </ConfirmDialog>
          <ConfirmDialog
            opened={dialog === 'reject'}
            title={t('dictionary.reject.title')}
            confirmLabel={t('dictionary.actions.reject')}
            danger
            requireReason
            busy={deactivate.isPending}
            onClose={() => setDialog(null)}
            onConfirm={(reason) => run('reject', reason)}
          >
            {t('dictionary.reject.text')}
          </ConfirmDialog>
          <ConfirmDialog
            opened={dialog === 'retire'}
            title={t('dictionary.retire.title')}
            confirmLabel={t('dictionary.actions.retire')}
            danger
            requireReason
            busy={deactivate.isPending}
            onClose={() => setDialog(null)}
            onConfirm={(reason) => run('retire', reason)}
          >
            <Stack gap="xs">
              <Text size="sm">{t('dictionary.retire.text')}</Text>
              {dependents.length > 0 && (
                <Alert color="yellow">
                  {t('dictionary.retire.dependents')}
                  <List size="sm" mt={4}>
                    {dependents.map((x) => <List.Item key={x.id}>{x.name}</List.Item>)}
                  </List>
                </Alert>
              )}
              <Text size="xs" className="nexora-secondary-text">{t('dictionary.detail.hiddenDependencies')}</Text>
            </Stack>
          </ConfirmDialog>
        </>
      )}
    </Drawer>
  );
}
