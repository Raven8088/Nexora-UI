import { Checkbox, Group, Select, Stack } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { CARDINALITIES, JOIN_TYPES, type Cardinality, type JoinType } from '@/api/semanticTypes';

/**
 * The declared cardinality and the allowed JOIN types of a relationship (Semantic DeclaredCardinality and JoinType):
 * a person's declaration, kept apart from the physical evidence Semantic computes. At least one JOIN type.
 */
export function SemanticsFields(props: {
  cardinality: Cardinality;
  joinTypes: JoinType[];
  onCardinality: (c: Cardinality) => void;
  onJoinTypes: (j: JoinType[]) => void;
  joinTypesError?: string;
}) {
  const { t } = useTranslation();
  return (
    <Stack gap="sm">
      <Select
        label={t('relationships.form.cardinality')}
        description={t('relationships.form.cardinalityHint')}
        data={CARDINALITIES.map((c) => ({ value: c, label: t(`relationships.cardinality.${c}`) }))}
        value={props.cardinality}
        onChange={(v) => props.onCardinality((v ?? props.cardinality) as Cardinality)}
        allowDeselect={false}
        required
      />
      <Checkbox.Group
        label={t('relationships.form.joinTypes')}
        description={t('relationships.form.joinTypesHint')}
        value={props.joinTypes}
        onChange={(v) => props.onJoinTypes(v as JoinType[])}
        error={props.joinTypesError}
        required
      >
        <Group mt={4}>
          {JOIN_TYPES.map((j) => (
            <Checkbox key={j} value={j} label={t(`relationships.joinType.${j}`)} />
          ))}
        </Group>
      </Checkbox.Group>
    </Stack>
  );
}
