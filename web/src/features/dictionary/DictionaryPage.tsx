import { ActionIcon, Alert, Button, Card, Group, Pagination, SegmentedControl, Select, SimpleGrid, Stack, Table, Text, TextInput, UnstyledButton } from '@mantine/core';
import { IconArrowsSort, IconLayoutGrid, IconPlus, IconSparkles, IconSearch, IconSortAscending, IconSortDescending, IconTable } from '@tabler/icons-react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { DEFINITION_KINDS, DEFINITION_STATUSES, type Definition, type DefinitionKind, type DefinitionStatus } from '@/api/semanticTypes';
import { useSession } from '@/auth/SessionProvider';
import { useSource } from '@/context/SourceContext';
import { KindBadge, StatusBadge } from '@/shared/Badges';
import { formatDateTime } from '@/shared/format';
import { LoadingState } from '@/shared/LoadingState';
import { PageHeader } from '@/shared/PageHeader';
import { ProblemAlert } from '@/shared/ProblemAlert';
import { DefinitionDrawer } from './DefinitionDrawer';
import { DictionaryTabs } from './DictionaryTabs';
import { DefinitionForm, type FormMode } from './DefinitionForm';
import { useDefinitions } from './hooks';
import { matches } from './lifecycle';

const PAGE_SIZE = 20;
const column = createColumnHelper<Definition>();

/**
 * The semantic dictionary: every definition of the selected source (all states), searched and filtered in the
 * browser (Semantic filters by kind and status only and has no text search; the console reads every page).
 */
export function DictionaryPage() {
  const { t, i18n } = useTranslation();
  const { permissions } = useSession();
  const { source } = useSource();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<DefinitionKind | ''>('');
  const [status, setStatus] = useState<DefinitionStatus | ''>('');
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const [form, setForm] = useState<FormMode | null>(null);
  const selectedId = params.get('id') ?? undefined;
  const open = (id: string) => setParams({ id });
  const close = () => setParams({});

  const definitions = useDefinitions(source?.dataSourceId);
  const all = definitions.data ?? [];
  const filtered = useMemo(
    () => all.filter((d) => (!kind || d.kind === kind) && (!status || d.status === status) && matches(d, search)),
    [all, kind, status, search],
  );

  const columns = useMemo(
    () => [
      column.accessor('name', {
        header: () => t('dictionary.columns.name'),
        cell: (c) => (
          <UnstyledButton onClick={() => open(c.row.original.id)} aria-label={`${t('dictionary.open')}: ${c.getValue()}`}>
            <Text fw={600} c="var(--nexora-accent)" size="sm">{c.getValue()}</Text>
            {c.row.original.description && (
              <Text size="xs" className="nexora-secondary-text" lineClamp={1}>{c.row.original.description}</Text>
            )}
          </UnstyledButton>
        ),
      }),
      column.accessor('key', { header: () => t('dictionary.columns.key'), cell: (c) => <Text size="sm" ff="monospace">{c.getValue()}</Text> }),
      column.accessor('kind', { header: () => t('dictionary.columns.kind'), cell: (c) => <KindBadge kind={c.getValue()} /> }),
      column.accessor('status', { header: () => t('dictionary.columns.status'), cell: (c) => <StatusBadge status={c.getValue()} short /> }),
      column.accessor('usable', { header: () => t('dictionary.columns.usable'), cell: (c) => <Text size="sm">{c.getValue() ? t('common.yes') : t('common.no')}</Text> }),
      column.accessor('version', { header: () => t('dictionary.columns.version') }),
      column.accessor((d) => d.updatedAt ?? '', {
        id: 'updatedAt',
        header: () => t('dictionary.columns.updated'),
        cell: (c) => <Text size="sm">{formatDateTime(c.getValue(), i18n.language)}</Text>,
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: PAGE_SIZE } },
    autoResetPageIndex: true,
  });

  if (!permissions.catalogRead) return <Alert color="gray">{t('common.noPermission')}</Alert>;
  if (!source) return <Alert color="yellow">{t('common.noSource')}</Alert>;

  const rows = table.getRowModel().rows;
  const pages = table.getPageCount();

  return (
    <Stack gap="md">
      <PageHeader
        title={t('dictionary.title')}
        subtitle={t('dictionary.subtitle')}
        actions={
          permissions.proposalWrite && (
            <Group gap="sm">
              <Button leftSection={<IconSparkles size={18} />} component={Link} to="/diccionario/crear-con-ayuda">
                {t('dictionary.assisted')}
              </Button>
              <Button variant="default" leftSection={<IconPlus size={18} />} onClick={() => setForm({ type: 'create' })}>
                {t('dictionary.new')}
              </Button>
            </Group>
          )
        }
      />
      <DictionaryTabs active="definitions" />
      <Text size="xs" className="nexora-secondary-text">{t('dictionary.lifecycleNote')}</Text>
      <Group gap="sm" align="flex-end" wrap="wrap">
        <TextInput
          style={{ flex: 1, minWidth: 220 }}
          leftSection={<IconSearch size={16} />}
          placeholder={t('dictionary.searchPlaceholder')}
          aria-label={t('common.search')}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
        <Select
          label={t('dictionary.kindFilter')}
          w={170}
          value={kind || null}
          onChange={(v) => setKind((v ?? '') as DefinitionKind | '')}
          clearable
          placeholder={t('common.all')}
          data={DEFINITION_KINDS.map((k) => ({ value: k, label: t(`dictionary.kind.${k}`) }))}
        />
        <Select
          label={t('dictionary.statusFilter')}
          w={170}
          value={status || null}
          onChange={(v) => setStatus((v ?? '') as DefinitionStatus | '')}
          clearable
          placeholder={t('common.all')}
          data={DEFINITION_STATUSES.map((s) => ({ value: s, label: t(`dictionary.statusShort.${s}`) }))}
        />
        <SegmentedControl
          aria-label={t('dictionary.view')}
          value={view}
          onChange={(v) => setView(v as 'table' | 'cards')}
          data={[
            { value: 'table', label: <Group gap={4} wrap="nowrap"><IconTable size={16} />{t('dictionary.viewTable')}</Group> },
            { value: 'cards', label: <Group gap={4} wrap="nowrap"><IconLayoutGrid size={16} />{t('dictionary.viewCards')}</Group> },
          ]}
        />
      </Group>

      {definitions.isLoading && <LoadingState />}
      {definitions.error && <ProblemAlert error={definitions.error} />}
      {definitions.data && (
        <>
          <Text size="sm" className="nexora-secondary-text">{t('dictionary.count', { count: filtered.length })}</Text>
          {filtered.length === 0 ? (
            <Alert color="gray">{t('dictionary.empty')}</Alert>
          ) : view === 'table' ? (
            <Table.ScrollContainer minWidth={760}>
              <Table highlightOnHover verticalSpacing="sm" style={{ background: 'var(--nexora-surface)' }}>
                <Table.Thead>
                  {table.getHeaderGroups().map((hg) => (
                    <Table.Tr key={hg.id}>
                      {hg.headers.map((h) => {
                        const sorted = h.column.getIsSorted();
                        return (
                          <Table.Th key={h.id} aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}>
                            <Group gap={4} wrap="nowrap">
                              {flexRender(h.column.columnDef.header, h.getContext())}
                              {h.column.getCanSort() && (
                                <ActionIcon size="xs" variant="subtle" onClick={h.column.getToggleSortingHandler()} aria-label={`sort ${h.id}`}>
                                  {sorted === 'asc' ? <IconSortAscending size={14} /> : sorted === 'desc' ? <IconSortDescending size={14} /> : <IconArrowsSort size={14} />}
                                </ActionIcon>
                              )}
                            </Group>
                          </Table.Th>
                        );
                      })}
                    </Table.Tr>
                  ))}
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((r) => (
                    <Table.Tr key={r.id}>
                      {r.getVisibleCells().map((c) => (
                        <Table.Td key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</Table.Td>
                      ))}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {rows.map(({ original: d }) => (
                <Card key={d.id} style={{ borderTop: '3px solid var(--nexora-accent)', background: 'var(--nexora-surface)' }}>
                  <Stack gap="xs">
                    <Group justify="space-between" wrap="nowrap">
                      <KindBadge kind={d.kind} />
                      <StatusBadge status={d.status} short />
                    </Group>
                    <Text fw={600}>{d.name}</Text>
                    <Text size="xs" ff="monospace" className="nexora-secondary-text">{d.key} · v{d.version}</Text>
                    <Text size="sm" lineClamp={3} className="nexora-secondary-text">{d.description || t('dictionary.detail.noDescription')}</Text>
                    <Button variant="light" size="xs" onClick={() => open(d.id)}>{t('dictionary.open')}</Button>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          )}
          {pages > 1 && (
            <Group justify="center">
              <Pagination
                total={pages}
                value={table.getState().pagination.pageIndex + 1}
                onChange={(p) => table.setPageIndex(p - 1)}
                getControlProps={(control) => ({ 'aria-label': control })}
              />
            </Group>
          )}
        </>
      )}

      <DefinitionDrawer
        dataSourceId={source.dataSourceId}
        definitionId={selectedId}
        definitions={all}
        onClose={close}
        onOpen={open}
        onForm={setForm}
      />
      {form && (
        <DefinitionForm
          opened
          mode={form}
          dataSourceId={source.dataSourceId}
          definitions={all}
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
