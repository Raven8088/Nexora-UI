import { Badge, Button, Card, Group, List, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconBook2, IconBulb, IconCheck, IconMessageChatbot, IconX } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { countDefinitions, listSuggestions } from '@/api/semantic';
import { useSession } from '@/auth/SessionProvider';
import { useSource } from '@/context/SourceContext';

/** Home: shortcuts and two real counters (drafts pending approval, open suggestions). No invented metrics. */
export function HomePage() {
  const { t } = useTranslation();
  const session = useSession();
  const { permissions } = session;
  const { source } = useSource();
  const drafts = useQuery({
    queryKey: ['count-drafts', source?.dataSourceId],
    queryFn: () => countDefinitions(source?.dataSourceId as string, 'DRAFT'),
    enabled: !!source && permissions.catalogRead,
  });
  const open = useQuery({
    queryKey: ['count-open-suggestions', source?.dataSourceId],
    queryFn: async () => (await listSuggestions(source?.dataSourceId as string, { status: 'OPEN' })).length,
    enabled: !!source && permissions.proposalWrite,
  });
  const cards = [
    permissions.chat && { to: '/chat', icon: <IconMessageChatbot size={22} />, title: t('nav.chat'), text: t('home.chatCard') },
    permissions.catalogRead && { to: '/diccionario', icon: <IconBook2 size={22} />, title: t('nav.dictionary'), text: t('home.dictionaryCard'), count: drafts, countLabel: t('home.draftsPending') },
    permissions.proposalWrite && { to: '/sugerencias', icon: <IconBulb size={22} />, title: t('nav.suggestions'), text: t('home.suggestionsCard'), count: open, countLabel: t('home.openSuggestions') },
  ].filter(Boolean) as { to: string; icon: JSX.Element; title: string; text: string; count?: typeof drafts; countLabel?: string }[];

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={2}>{t('home.greeting', { name: session.name })}</Title>
        <Text className="nexora-secondary-text">{t('home.intro')}</Text>
      </Stack>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {cards.map((c) => (
          <Card key={c.to} style={{ borderTop: '3px solid var(--nexora-accent)' }}>
            <Stack gap="sm" h="100%" justify="space-between">
              <Stack gap="xs">
                <Group gap="sm">
                  <ThemeIcon variant="light" size="lg">{c.icon}</ThemeIcon>
                  <Text fw={600}>{c.title}</Text>
                </Group>
                <Text size="sm" className="nexora-secondary-text">{c.text}</Text>
                {c.count && (
                  <Group gap="xs">
                    <Text size="sm">{c.countLabel}:</Text>
                    <Badge variant="light">{c.count.isError ? t('home.countUnavailable') : c.count.data ?? '…'}</Badge>
                  </Group>
                )}
              </Stack>
              <Button component={Link} to={c.to} variant="light">{t('home.open')}</Button>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
      <Card>
        <Text fw={600} mb="xs">{t('home.capabilities')}</Text>
        <List spacing={4} size="sm">
          {(Object.keys(permissions) as (keyof typeof permissions)[]).map((p) => (
            <List.Item key={p} icon={<ThemeIcon size={18} variant="light" color={permissions[p] ? 'nexora' : 'gray'}>{permissions[p] ? <IconCheck size={12} /> : <IconX size={12} />}</ThemeIcon>}>
              {t(`permissions.${p}`)}
            </List.Item>
          ))}
        </List>
      </Card>
    </Stack>
  );
}
