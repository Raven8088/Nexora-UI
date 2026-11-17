import { ActionIcon, Button, Group, Select, Stack, Text } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { MAX_PAIRS } from '@/api/semanticTypes';
import { useColumns } from '../dictionary/hooks';
import type { PairDraft } from './model';

/**
 * The ordered column pairs of a relationship (source column = target column), chosen by name among the ACTIVE columns
 * of each table; at most 16 (Semantic MAX_PAIRS). In a suggestion correction the source table is the suggestion's
 * (a correction cannot change it), so only its columns are offered on the left.
 */
export function PairsEditor(props: {
  dataSourceId: string;
  sourceObjectId: string;
  targetObjectId: string;
  pairs: PairDraft[];
  onChange: (pairs: PairDraft[]) => void;
  error?: string;
}) {
  const { t } = useTranslation();
  const sourceColumns = useColumns(props.dataSourceId, props.sourceObjectId || undefined);
  const targetColumns = useColumns(props.dataSourceId, props.targetObjectId || undefined);
  const options = (cols: typeof sourceColumns) => (cols.data ?? []).map((c) => ({ value: c.id, label: c.childName ?? c.naturalKey }));
  const set = (i: number, patch: Partial<PairDraft>) => props.onChange(props.pairs.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <Stack gap={6}>
      <Text size="sm" fw={500}>
        {t('relationships.form.pairs')} <Text span c="red">*</Text>
      </Text>
      <Text size="xs" className="nexora-secondary-text">{t('relationships.form.pairsHint', { max: MAX_PAIRS })}</Text>
      {props.pairs.map((p, i) => (
        <Group key={i} gap="xs" wrap="nowrap" align="flex-end">
          <Select
            style={{ flex: 1 }}
            label={t('relationships.form.sourceColumn', { n: i + 1 })}
            data={options(sourceColumns)}
            searchable
            disabled={!props.sourceObjectId}
            value={p.sourceColumnId || null}
            onChange={(v) => set(i, { sourceColumnId: v ?? '' })}
          />
          <Text pb={8} aria-hidden>=</Text>
          <Select
            style={{ flex: 1 }}
            label={t('relationships.form.targetColumn', { n: i + 1 })}
            data={options(targetColumns)}
            searchable
            disabled={!props.targetObjectId}
            value={p.targetColumnId || null}
            onChange={(v) => set(i, { targetColumnId: v ?? '' })}
          />
          <ActionIcon
            variant="subtle"
            size="lg"
            mb={2}
            disabled={props.pairs.length <= 1}
            aria-label={t('relationships.form.removePair', { n: i + 1 })}
            onClick={() => props.onChange(props.pairs.filter((_, j) => j !== i))}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      ))}
      {props.error && (
        <Text size="xs" c="red" role="alert">{props.error}</Text>
      )}
      <Button
        variant="subtle"
        size="xs"
        w="fit-content"
        leftSection={<IconPlus size={14} />}
        disabled={props.pairs.length >= MAX_PAIRS}
        onClick={() => props.onChange([...props.pairs, { sourceColumnId: '', targetColumnId: '' }])}
      >
        {t('relationships.form.addPair')}
      </Button>
    </Stack>
  );
}
