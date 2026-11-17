import { Alert, Anchor, Badge, Button, Code, Drawer, Group, Stack, Table, Tabs, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconEditCircle, IconHistory, IconPencil, IconPlayerStop, IconRefresh, IconX } from '@tabler/icons-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/api/problem';
import { useSession } from '@/auth/SessionProvider';
import { useActorLabel, useIsOwnWork } from '@/shared/actor';
import { AuditTimeline } from '@/shared/AuditTimeline';
import { StatusBadge } from '@/shared/Badges';
import { ConfirmDialog } from '@/shared/ConfirmDialog';
import { CorrectionConsequences } from '@/shared/CorrectionConsequences';
import { formatDateTime } from '@/shared/format';
import { LoadingState } from '@/shared/LoadingState';
import { ProblemAlert } from '@/shared/ProblemAlert';
import { actionsFor, type Action } from '../dictionary/lifecycle';
import { useApproveRelationship, useDeactivateRelationship, useRelationship } from './hooks';
import { endpoints } from './model';
import type { RelationshipFormMode } from './RelationshipForm';

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

/** B3: a semantic relationship: what it joins, how, its validity, history and the governance actions. */
export function RelationshipDrawer(props: {
  dataSourceId: string;
  relationshipId: string | undefined;
  onClose: () => void;
  onForm: (mode: RelationshipFormMode) => void;
}) {
  const { t, i18n } = useTranslation();
  const { permissions } = useSession();
  const actor = useActorLabel();
  const isOwnWork = useIsOwnWork();
  const query = useRelationship(props.dataSourceId, props.relationshipId);
  const approve = useApproveRelationship(props.dataSourceId);
  const deactivate = useDeactivateRelationship(props.dataSourceId);
  const [dialog, setDialog] = useState<Action | null>(null);
  const r = query.data?.data;
  const etag = query.data?.etag;
  const busy = approve.isPending || deactivate.isPending;
  const mutationError = approve.error ?? deactivate.error;
  const conflict = mutationError instanceof ApiError && mutationError.problem.status === 412;

  const done = (key: string) => {
    setDialog(null);
    notifications.show({ color: 'nexora', message: t(key) });
  };
  const onAction = (action: Action) => {
    if (!r || !etag) return;
    if (action === 'edit' || action === 'reactivate') props.onForm({ type: action, relationship: r, etag });
    else setDialog(action);
  };

  return (
    <Drawer opened={!!props.relationshipId} onClose={props.onClose} position="right" size="xl" closeButtonProps={{ 'aria-label': t('common.close') }} title={r?.name ?? t('common.loading')}>
      {query.isLoading && <LoadingState />}
      {query.error && <ProblemAlert error={query.error} />}
      {r && (
        <Stack gap="md">
          <Group gap="xs">
            <Badge color="nexora" variant="outline">{t(`relationships.origin.${r.origin}`)}</Badge>
            <StatusBadge status={r.status} />
            <Badge color="nexora" variant="light" style={r.usable ? undefined : { background: 'var(--nexora-status-inactive-bg)', color: 'var(--nexora-status-inactive-text)' }}>
              {t(`relationships.usable.${r.usable}`)}
            </Badge>
          </Group>
          <Text size="xs" className="nexora-secondary-text">{t('relationships.lifecycleNote')}</Text>

          <Group gap="xs">
            {actionsFor(r, permissions).map((a) => (
              <Button
                key={a.action}
                size="xs"
                variant={a.action === 'approve' ? 'filled' : a.action === 'reject' || a.action === 'retire' ? 'outline' : 'light'}
                leftSection={ICONS[a.action]}
                disabled={busy}
                onClick={() => onAction(a.action)}
              >
                {t(`relationships.actions.${a.action}`)}
              </Button>
            ))}
          </Group>
          {mutationError &&
            (conflict ? (
              <Alert color="yellow">
                {t('relationships.conflict')}{' '}
                <Anchor component="button" onClick={() => void query.refetch()}>{t('common.reload')}</Anchor>
              </Alert>
            ) : (
              <ProblemAlert error={mutationError} />
            ))}

          <Tabs defaultValue="summary" keepMounted={false}>
            <Tabs.List>
              <Tabs.Tab value="summary">{t('relationships.detail.tabs.summary')}</Tabs.Tab>
              <Tabs.Tab value="structure">{t('relationships.detail.tabs.structure')}</Tabs.Tab>
              <Tabs.Tab value="issues">
                {t('relationships.detail.tabs.issues')} {r.issues.length > 0 && <Badge size="xs" color="nexora" ml={4}>{r.issues.length}</Badge>}
              </Tabs.Tab>
              <Tabs.Tab value="history" leftSection={<IconHistory size={14} />}>{t('relationships.detail.tabs.history')}</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="summary" pt="md">
              <Stack gap="xs">
                <Text fw={600} size="sm">{t('dictionary.detail.description')}</Text>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{r.description || t('dictionary.detail.noDescription')}</Text>
                <Field label={t('relationships.detail.endpoints')}>{endpoints(r)}</Field>
                <Field label={t('relationships.detail.origin')}>
                  {t(`relationships.origin.${r.origin}`)}
                  <Text size="xs" className="nexora-secondary-text">{t(`relationships.originNote.${r.origin}`)}</Text>
                </Field>
                <Field label={t('relationships.detail.physicallyValid')}>{r.physicallyValid ? t('common.yes') : t('common.no')}</Field>
                <Field label={t('dictionary.detail.version')}>{r.version}</Field>
                <Field label={t('dictionary.detail.createdBy')}>{actor(r.createdBy)} · {formatDateTime(r.createdAt, i18n.language)}</Field>
                <Field label={t('dictionary.detail.updatedBy')}>{actor(r.updatedBy)} · {formatDateTime(r.updatedAt, i18n.language)}</Field>
                {r.approvedBy && <Field label={t('dictionary.detail.approvedBy')}>{actor(r.approvedBy)} · {formatDateTime(r.approvedAt, i18n.language)}</Field>}
                {r.inactiveReason && <Field label={t('dictionary.detail.inactiveReason')}>{r.inactiveReason}</Field>}
                {r.replacesId && <Field label={t('relationships.detail.replaces')}><Code>{r.replacesId}</Code></Field>}
                <Field label={t('dictionary.detail.technicalId')}><Code>{r.id}</Code></Field>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="structure" pt="md">
              <Stack gap="xs">
                <Field label={t('relationships.form.source')}>{r.source.naturalKey ?? r.source.objectId}</Field>
                <Field label={t('relationships.form.target')}>{r.target.naturalKey ?? r.target.objectId}</Field>
                {r.foreignKey && <Field label={t('relationships.detail.foreignKey')}>{r.foreignKey.naturalKey ?? r.foreignKey.objectId}</Field>}
                <Field label={t('relationships.form.cardinality')}>{t(`relationships.cardinality.${r.declaredCardinality}`)}</Field>
                <Field label={t('relationships.form.joinTypes')}>{r.allowedJoinTypes.map((j) => t(`relationships.joinType.${j}`)).join(', ')}</Field>
                <Text fw={600} size="sm" mt="xs">{t('relationships.form.pairs')}</Text>
                <Table fz="sm" withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>#</Table.Th>
                      <Table.Th>{t('relationships.detail.sourceColumn')}</Table.Th>
                      <Table.Th>{t('relationships.detail.targetColumn')}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {r.pairs.map((p) => (
                      <Table.Tr key={p.ordinal}>
                        <Table.Td>{p.ordinal + 1}</Table.Td>
                        <Table.Td>{p.sourceColumn.naturalKey ?? p.sourceColumn.objectId}</Table.Td>
                        <Table.Td>{p.targetColumn.naturalKey ?? p.targetColumn.objectId}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
                {r.evidence && (
                  <>
                    <Text fw={600} size="sm" mt="xs">{t('relationships.detail.evidence')}</Text>
                    <Text size="xs" className="nexora-secondary-text">{t('relationships.detail.evidenceNote')}</Text>
                    {Object.entries(r.evidence)
                      .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
                      .map(([k, v]) => (
                        <Field key={k} label={t(`relationships.evidence.${k}`, { defaultValue: k })}>
                          {t(`relationships.evidenceValue.${String(v)}`, { defaultValue: String(v) })}
                        </Field>
                      ))}
                  </>
                )}
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="issues" pt="md">
              {r.issues.length === 0 ? (
                <Text size="sm">{t('relationships.detail.noIssues')}</Text>
              ) : (
                <Stack gap="xs">
                  <Alert color="red" variant="light">{t('relationships.detail.issuesIntro')}</Alert>
                  <Table fz="sm">
                    <Table.Tbody>
                      {r.issues.map((issue, i) => (
                        <Table.Tr key={`${issue.code}-${i}`}>
                          <Table.Td>{t(`dictionary.issueCode.${issue.code}`, { defaultValue: issue.code })}</Table.Td>
                          <Table.Td>{issue.field ?? ''}</Table.Td>
                          <Table.Td>{issue.message ?? ''}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Stack>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="history" pt="md">
              <AuditTimeline targetType="SEMANTIC_RELATIONSHIP" targetId={r.id} />
            </Tabs.Panel>
          </Tabs>

          <ConfirmDialog
            opened={dialog === 'approve'}
            title={t('relationships.approve.title')}
            confirmLabel={t('relationships.actions.approve')}
            busy={approve.isPending}
            onClose={() => setDialog(null)}
            onConfirm={() => etag && approve.mutate({ id: r.id, etag }, { onSuccess: () => done('relationships.approve.done') })}
          >
            <Stack gap="xs">
              <Text size="sm">{t('relationships.approve.text', { name: r.name })}</Text>
              {isOwnWork(r.createdBy, r.updatedBy) && <Alert color="yellow" data-testid="self-approval">{t('dictionary.approve.selfApproval')}</Alert>}
              {r.issues.length > 0 && <Alert color="yellow">{t('relationships.approve.issuesWarning')}</Alert>}
            </Stack>
          </ConfirmDialog>
          <ConfirmDialog
            opened={dialog === 'reject' || dialog === 'retire'}
            title={t(`relationships.${dialog === 'retire' ? 'retire' : 'reject'}.title`)}
            confirmLabel={t(`relationships.actions.${dialog === 'retire' ? 'retire' : 'reject'}`)}
            danger
            requireReason
            busy={deactivate.isPending}
            onClose={() => setDialog(null)}
            onConfirm={(reason) =>
              etag &&
              deactivate.mutate(
                { id: r.id, etag, reason },
                { onSuccess: () => done(`relationships.${dialog === 'retire' ? 'retire' : 'reject'}.done`) },
              )
            }
          >
            {t(`relationships.${dialog === 'retire' ? 'retire' : 'reject'}.text`)}
          </ConfirmDialog>
          <ConfirmDialog
            opened={dialog === 'correct'}
            title={t('relationships.correct.title')}
            confirmLabel={t('dictionary.correct.continue')}
            acknowledgeLabel={t('correction.acknowledge')}
            onClose={() => setDialog(null)}
            onConfirm={() => {
              setDialog(null);
              if (etag) props.onForm({ type: 'correct', relationship: r, etag });
            }}
          >
            <CorrectionConsequences name={r.name} />
          </ConfirmDialog>
        </Stack>
      )}
    </Drawer>
  );
}
