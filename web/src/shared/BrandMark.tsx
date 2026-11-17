import { Group, Text } from '@mantine/core';

/** The Nexora mark: a burgundy tile with an «N», drawn with theme colors only. */
export function BrandMark({ size = 32, withName = false, inverted = false }: { size?: number; withName?: boolean; inverted?: boolean }) {
  return (
    <Group gap="xs" wrap="nowrap">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <rect width="32" height="32" rx="7" fill={inverted ? 'var(--nexora-sidebar-text)' : 'var(--nexora-accent)'} />
        <path d="M9 23V9h2.6l7.8 9.6V9H22v14h-2.6l-7.8-9.6V23z" fill={inverted ? 'var(--nexora-sidebar-bg)' : 'var(--nexora-sidebar-text)'} />
      </svg>
      {withName && (
        <Text fw={700} size="lg" c={inverted ? 'var(--nexora-sidebar-text)' : undefined}>
          Nexora AI
        </Text>
      )}
    </Group>
  );
}
