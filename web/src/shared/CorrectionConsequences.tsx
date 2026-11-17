import { Alert, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';

/**
 * B4 / D-A: what correcting an APPROVED definition or relationship means, shown before the explicit confirmation.
 * Semantic's `revise` returns it to DRAFT (there is no parallel version: no versioning is implemented, by decision).
 */
const LIST = { margin: 0, paddingInlineStart: 20, display: 'grid', gap: 4 } as const;

export function CorrectionConsequences({ name, dependents = [] }: { name: string; dependents?: string[] }) {
  const { t } = useTranslation();
  return (
    <Stack gap="xs">
      <Text size="sm">{t('correction.intro', { name })}</Text>
      {/* A plain list: Mantine's List items (inline-flex, indented) overflow the Alert on long lines and are clipped. */}
      <Alert color="yellow" variant="light" data-testid="correction-consequences">
        <ul style={LIST}>
          {(['backToDraft', 'notUsable', 'plansStale', 'excelUnchanged'] as const).map((k) => (
            <Text key={k} component="li" size="sm">{t(`correction.${k}`)}</Text>
          ))}
        </ul>
      </Alert>
      {dependents.length > 0 && (
        <Alert color="gray" variant="light">
          <Text size="sm">{t('correction.dependents')}</Text>
          <ul style={LIST}>
            {dependents.map((n) => (
              <Text key={n} component="li" size="sm">{n}</Text>
            ))}
          </ul>
        </Alert>
      )}
    </Stack>
  );
}
