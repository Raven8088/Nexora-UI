import { Group, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <Group justify="space-between" align="flex-start" mb="lg" wrap="wrap" gap="sm">
      <Stack gap={4} maw={760}>
        <Title order={2}>{title}</Title>
        {subtitle && <Text className="nexora-secondary-text">{subtitle}</Text>}
      </Stack>
      {actions}
    </Group>
  );
}
