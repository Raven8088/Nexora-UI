import { ActionIcon, AppShell, Badge, Burger, Group, NavLink, ScrollArea, Select, Stack, Text, Tooltip, UnstyledButton, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconBook2,
  IconBulb,
  IconDatabase,
  IconFileSpreadsheet,
  IconHome,
  IconLogout,
  IconMessageChatbot,
  IconMoon,
  IconSettings,
  IconShieldLock,
  IconSun,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink as RouterLink, useLocation } from 'react-router-dom';
import { logout } from '@/api/bff';
import { useSession } from '@/auth/SessionProvider';
import { useSource } from '@/context/SourceContext';
import { BrandMark } from '@/shared/BrandMark';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  visible: boolean;
  soon?: boolean;
}

const navStyles = {
  root: { color: 'var(--nexora-sidebar-text)', borderRadius: 8 },
  label: { color: 'var(--nexora-sidebar-text)' },
  section: { color: 'var(--nexora-sidebar-text)' },
};

/** The frame of the console: burgundy navigation, header with the data source, theme and sign-out. */
export function Shell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [opened, { toggle, close }] = useDisclosure();
  const session = useSession();
  const { permissions } = session;
  const { sources, source, select } = useSource();
  const location = useLocation();
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('light');

  const items: NavItem[] = [
    { to: '/', label: t('nav.home'), icon: <IconHome size={18} />, visible: true },
    { to: '/chat', label: t('nav.chat'), icon: <IconMessageChatbot size={18} />, visible: permissions.chat },
    { to: '/reportes', label: t('nav.reports'), icon: <IconFileSpreadsheet size={18} />, visible: permissions.chat },
    { to: '/diccionario', label: t('nav.dictionary'), icon: <IconBook2 size={18} />, visible: permissions.catalogRead },
    { to: '/sugerencias', label: t('nav.suggestions'), icon: <IconBulb size={18} />, visible: permissions.proposalWrite },
    { to: '/fuentes', label: t('nav.sources'), icon: <IconDatabase size={18} />, visible: true, soon: true },
    { to: '/administracion', label: t('nav.admin'), icon: <IconShieldLock size={18} />, visible: permissions.diagnostics, soon: true },
    { to: '/configuracion', label: t('nav.settings'), icon: <IconSettings size={18} />, visible: true },
  ];

  const active = (to: string) => (to === '/' ? location.pathname === '/' : location.pathname.startsWith(to));

  const signOut = async () => {
    const target = await logout().catch(() => '/');
    window.location.assign(target);
  };

  return (
    <AppShell header={{ height: 60 }} navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !opened } }} padding="md">
      <AppShell.Header style={{ background: 'var(--nexora-surface)', borderBottom: '1px solid var(--nexora-border)' }}>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label={t('header.menu')} />
            <Group hiddenFrom="sm"><BrandMark size={28} /></Group>
            {sources.length === 0 ? (
              <Badge color="nexora" variant="light" style={{ background: 'var(--nexora-status-draft-bg)', color: 'var(--nexora-status-draft-text)' }}>{t('header.noSource')}</Badge>
            ) : (
              <Select
                aria-label={t('header.source')}
                placeholder={t('header.source')}
                w={{ base: 160, sm: 240 }}
                allowDeselect={false}
                value={source?.alias ?? null}
                onChange={(v) => v && select(v)}
                data={sources.map((s) => ({ value: s.alias, label: s.label }))}
              />
            )}
          </Group>
          <Group gap="xs" wrap="nowrap">
            <Text size="sm" visibleFrom="md" className="nexora-secondary-text">{session.name}</Text>
            <Tooltip label={t('header.theme')}>
              <ActionIcon variant="subtle" size="lg" aria-label={t('header.theme')} onClick={() => setColorScheme(scheme === 'dark' ? 'light' : 'dark')}>
                {scheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('header.logout')}>
              <ActionIcon variant="subtle" size="lg" aria-label={t('header.logout')} onClick={() => void signOut()}>
                <IconLogout size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="sm" style={{ background: 'var(--nexora-sidebar-bg)', borderRight: 'none' }}>
        <AppShell.Section mb="md" px="xs" pt="xs">
          <UnstyledButton component={RouterLink} to="/" onClick={close} aria-label={t('nav.home')}>
            <BrandMark size={32} withName inverted />
          </UnstyledButton>
        </AppShell.Section>
        <AppShell.Section grow component={ScrollArea}>
          <nav aria-label={t('nav.main')}>
            <Stack gap={2}>
              {items.filter((i) => i.visible).map((i) =>
                i.soon ? (
                  <NavLink
                    key={i.to}
                    label={i.label}
                    leftSection={i.icon}
                    disabled
                    description={t('nav.soon')}
                    styles={{ ...navStyles, description: { color: 'var(--nexora-sidebar-text-muted)' } }}
                    style={{ opacity: 0.75 }}
                  />
                ) : (
                  <NavLink
                    key={i.to}
                    component={RouterLink}
                    to={i.to}
                    label={i.label}
                    leftSection={i.icon}
                    onClick={close}
                    active={active(i.to)}
                    aria-current={active(i.to) ? 'page' : undefined}
                    styles={navStyles}
                    style={active(i.to) ? { background: 'var(--nexora-sidebar-bg-active)', fontWeight: 600 } : undefined}
                  />
                ),
              )}
            </Stack>
          </nav>
        </AppShell.Section>
        {session.tenant && (
          <AppShell.Section px="xs" pb="xs">
            <Text size="xs" c="var(--nexora-sidebar-text-muted)">{t('header.tenant')}: {session.tenant}</Text>
          </AppShell.Section>
        )}
      </AppShell.Navbar>
      <AppShell.Main style={{ background: 'var(--nexora-body-bg)' }}>{children}</AppShell.Main>
    </AppShell>
  );
}
