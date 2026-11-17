import { Badge, Card, Group, SegmentedControl, Stack, Text, useMantineColorScheme } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/auth/SessionProvider';
import { setLanguage, type UiLanguage } from '@/i18n';
import { PageHeader } from '@/shared/PageHeader';

/** Personal preferences that really exist: language and appearance; and what the account can do. */
export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const session = useSession();
  return (
    <Stack gap="md" maw={760}>
      <PageHeader title={t('settings.title')} />
      <Card>
        <Stack gap="xs">
          <Text fw={600}>{t('settings.language')}</Text>
          <SegmentedControl
            w="fit-content"
            value={i18n.language}
            onChange={(v) => setLanguage(v as UiLanguage)}
            data={[
              { value: 'es', label: 'Español' },
              { value: 'en', label: 'English' },
              { value: 'fr', label: 'Français' },
            ]}
          />
          <Text size="xs" className="nexora-secondary-text">{t('settings.languageNote')}</Text>
        </Stack>
      </Card>
      <Card>
        <Stack gap="xs">
          <Text fw={600}>{t('settings.theme')}</Text>
          <SegmentedControl
            w="fit-content"
            value={colorScheme}
            onChange={(v) => setColorScheme(v as 'light' | 'dark' | 'auto')}
            data={[
              { value: 'light', label: t('settings.light') },
              { value: 'dark', label: t('settings.dark') },
              { value: 'auto', label: t('settings.auto') },
            ]}
          />
        </Stack>
      </Card>
      <Card>
        <Stack gap="xs">
          <Text fw={600}>{t('settings.account')}</Text>
          <Text size="sm">{session.name}{session.username ? ` (${session.username})` : ''}</Text>
          {session.tenant && <Text size="sm" className="nexora-secondary-text">{t('header.tenant')}: {session.tenant}</Text>}
          <Group gap={4}>
            <Text size="sm">{t('settings.roles')}:</Text>
            {session.roles.map((r) => <Badge key={r} variant="light">{r}</Badge>)}
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
