import { Alert, Badge, Button, Group, Pagination, Select, Stack, Table, Text, TextInput, UnstyledButton } from '@mantine/core';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { DEFINITION_STATUSES, RELATIONSHIP_ORIGINS, type DefinitionStatus, type RelationshipOrigin } from '@/api/semanticTypes';
import { useSession } from '@/auth/SessionProvider';
import { useSource } from '@/context/SourceContext';
import { StatusBadge } from '@/shared/Badges';
import { formatDateTime } from '@/shared/format';
import { LoadingState } from '@/shared/LoadingState';
import { PageHeader } from '@/shared/PageHeader';
import { ProblemAlert } from '@/shared/ProblemAlert';
import { DictionaryTabs } from '../dictionary/DictionaryTabs';
import { useRelationships } from './hooks';
import { endpoints, matchesRelationship } from './model';
import { RelationshipDrawer } from './RelationshipDrawer';
import { RelationshipForm, type RelationshipFormMode } from './RelationshipForm';

const PAGE_SIZE = 20;

/**
 * B3: the semantic relationships of the selected source (all states), searched and filtered in the browser (Semantic
 * filters by status, origin and object only; the console reads every page, like the definitions).
 */
export function RelationshipsPage() {
  const { t, i18n } = useTranslation();
  const { permissions } = useSession();
  const { source } = useSource();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<DefinitionStatus | ''>('');
  const [origin, setOrigin] = useState<RelationshipOrigin | ''>('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<RelationshipFormMode | null>(null);
  const selectedId = params.get('id') ?? undefined;
  const open = (id: string) => setParams({ id });

  const relationships = useRelationships(source?.dataSourceId);
  const filtered = useMemo(
    () =>
      (relationships.data ?? [])
        .filter((r) => (!status || r.status === status) && (!origin || r.origin === origin) && matchesRelationship(r, search))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [relationships.data, status, origin, search],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  if (!permissions.catalogRead) return <Alert color="gray">{t('common.noPermission')}</Alert>;
  if (!source) return <Alert color="yellow">{t('common.noSource')}</Alert>;

  return (
    <Stack gap="md">
      <PageHeader
        title={t('dictionary.title')}
        subtitle={t('relationships.subtitle')}
        actions={
          permissions.proposalWrite && (
            <Button leftSection={<IconPlus size={18} />} onClick={() => setForm({ type: 'create' })}>
              {t('relationships.new')}
            </Button>
          )
        }
      />
      <DictionaryTabs active="relationships" />
      <Text size="xs" className="nexora-secondary-text">{t('relationships.lifecycleNote')}</Text>
      <Group gap="sm" align="flex-end" wrap="wrap">
        <TextInput
          style={{ flex: 1, minWidth: 220 }}
          leftSection={<IconSearch size={16} />}
          placeholder={t('relationships.searchPlaceholder')}
          aria-label={t('common.search')}
          value={search}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            setPage(1);
          }}
        />
        <Select
          label={t('dictionary.statusFilter')}
          w={170}
          clearable
          placeholder={t('common.all')}
          value={status || null}
          onChange={(v) => {
            setStatus((v ?? '') as DefinitionStatus | '');
            setPage(1);
          }}
          data={DEFINITION_STATUSES.map((s) => ({ value: s, label: t(`dictionary.statusShort.${s}`) }))}
        />
        <Select
          label={t('relationships.originFilter')}
          w={200}
          clearable
          placeholder={t('common.all')}
          value={origin || null}
          onChange={(v) => {
            setOrigin((v ?? '') as RelationshipOrigin | '');
            setPage(1);
          }}
          data={RELATIONSHIP_ORIGINS.map((o) => ({ value: o, label: t(`relationships.origin.${o}`) }))}
        />
      </Group>

      {relationships.isLoading && <LoadingState />}
      {relationships.error && <ProblemAlert error={relationships.error} />}
      {relationships.data && (
        <>
          <Text size="sm" className="nexora-secondary-text">{t('relationships.count', { count: filtered.length })}</Text>
          {filtered.length === 0 ? (
            <Alert color="gray">{t('relationships.empty')}</Alert>
          ) : (
            <Table.ScrollContainer minWidth={820}>
              <Table highlightOnHover verticalSpacing="sm" style={{ background: 'var(--nexora-surface)' }}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('relationships.columns.name')}</Table.Th>
                    <Table.Th>{t('relationships.columns.endpoints')}</Table.Th>
                    <Table.Th>{t('relationships.columns.cardinality')}</Table.Th>
                    <Table.Th>{t('relationships.columns.origin')}</Table.Th>
                    <Table.Th>{t('relationships.columns.status')}</Table.Th>
                    <Table.Th>{t('relationships.columns.usable')}</Table.Th>
                    <Table.Th>{t('dictionary.columns.updated')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((r) => (
                    <Table.Tr key={r.id}>
                      <Table.Td>
                        <UnstyledButton onClick={() => open(r.id)} aria-label={`${t('dictionary.open')}: ${r.name}`}>
                          <Text fw={600} c="var(--nexora-accent)" size="sm">{r.name}</Text>
                          {r.issues.length > 0 && (
                            <Text size="xs" className="nexora-secondary-text">{t('relationships.issuesCount', { count: r.issues.length })}</Text>
                          )}
                        </UnstyledButton>
                      </Table.Td>
                      <Table.Td><Text size="sm">{endpoints(r)}</Text></Table.Td>
                      <Table.Td><Text size="sm">{t(`relationships.cardinality.${r.declaredCardinality}`)}</Text></Table.Td>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}><Badge variant="outline" color="nexora" style={{ overflow: 'visible' }}>{t(`relationships.originShort.${r.origin}`)}</Badge></Table.Td>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}><StatusBadge status={r.status} short /></Table.Td>
                      <Table.Td><Text size="sm">{r.usable ? t('common.yes') : t('common.no')}</Text></Table.Td>
                      <Table.Td><Text size="sm">{formatDateTime(r.updatedAt, i18n.language)}</Text></Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
          {pages > 1 && (
            <Group justify="center">
              <Pagination total={pages} value={current} onChange={setPage} getControlProps={(control) => ({ 'aria-label': control })} />
            </Group>
          )}
        </>
      )}

      <RelationshipDrawer dataSourceId={source.dataSourceId} relationshipId={selectedId} onClose={() => setParams({})} onForm={setForm} />
      {form && (
        <RelationshipForm
          mode={form}
          dataSourceId={source.dataSourceId}
          onClose={() => setForm(null)}
          onSaved={(id) => {
            setForm(null);
            open(id);
          }}
        />
      )}
    </Stack>
  );
}
