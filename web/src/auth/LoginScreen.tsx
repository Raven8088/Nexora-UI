import { Alert, Button, Center, Paper, Stack, Text, Title } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { LOGIN_URL } from '@/api/bff';
import { BrandMark } from '@/shared/BrandMark';

/** Sign-in page. The login happens in Keycloak (Authorization Code + PKCE, handled by the BFF). */
export function LoginScreen({ expired = false, unavailable = false }: { expired?: boolean; unavailable?: boolean }) {
  const { t } = useTranslation();
  const failed = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('login') === 'failed';
  return (
    <Center mih="100vh" p="md" style={{ background: 'var(--nexora-surface-alt)' }}>
      <Paper withBorder shadow="sm" p="xl" maw={440} w="100%">
        <Stack gap="md">
          <BrandMark size={44} />
          <Title order={2}>{expired ? t('auth.expiredTitle') : t('auth.title')}</Title>
          <Text className="nexora-secondary-text">{expired ? t('auth.expiredText') : t('auth.subtitle')}</Text>
          {failed && <Alert color="red">{t('auth.loginFailed')}</Alert>}
          {unavailable && !expired && <Alert color="yellow">{t('auth.unavailable')}</Alert>}
          <Button component="a" href={LOGIN_URL} size="md" leftSection={<IconLock size={18} />}>
            {t('auth.login')}
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}
