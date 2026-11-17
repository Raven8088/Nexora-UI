import { Center, Loader, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';

export function LoadingState({ labelKey = 'common.loading', fullPage = false }: { labelKey?: string; fullPage?: boolean }) {
  const { t } = useTranslation();
  return (
    <Center mih={fullPage ? '100vh' : 160} role="status" aria-live="polite">
      <Stack align="center" gap="xs">
        <Loader />
        <Text size="sm" className="nexora-secondary-text">{t(labelKey)}</Text>
      </Stack>
    </Center>
  );
}
