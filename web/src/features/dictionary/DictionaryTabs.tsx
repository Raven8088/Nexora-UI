import { Button, Group } from '@mantine/core';
import { IconArrowsJoin2, IconBook2 } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

/**
 * B3: the two sections of the semantic dictionary (definitions and relationships), under the same menu entry. They
 * are two pages, so they are links in a navigation landmark (the current one with aria-current), not ARIA tabs.
 */
export function DictionaryTabs({ active }: { active: 'definitions' | 'relationships' }) {
  const { t } = useTranslation();
  const items = [
    { key: 'definitions', to: '/diccionario', icon: <IconBook2 size={16} />, label: t('dictionary.tabs.definitions') },
    { key: 'relationships', to: '/diccionario/relaciones', icon: <IconArrowsJoin2 size={16} />, label: t('dictionary.tabs.relationships') },
  ] as const;
  return (
    <nav aria-label={t('dictionary.sections')}>
      <Group gap={4} style={{ borderBottom: '1px solid var(--nexora-border)' }}>
        {items.map((i) => (
          <Button
            key={i.key}
            component={Link}
            to={i.to}
            variant={active === i.key ? 'light' : 'subtle'}
            leftSection={i.icon}
            aria-current={active === i.key ? 'page' : undefined}
            radius={0}
            style={active === i.key ? { borderBottom: '2px solid var(--nexora-accent)' } : undefined}
          >
            {i.label}
          </Button>
        ))}
      </Group>
    </nav>
  );
}
