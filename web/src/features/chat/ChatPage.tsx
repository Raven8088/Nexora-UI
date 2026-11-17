import { Alert, Badge, Box, Button, Grid, Group, Paper, Stack, Text, Textarea } from '@mantine/core';
import { IconInfoCircle, IconMessagePlus, IconSend } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/auth/SessionProvider';
import { useSource } from '@/context/SourceContext';
import { PageHeader } from '@/shared/PageHeader';
import { NexoraBubble } from './ChatAnswer';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { useChat } from './ChatProvider';
import type { NexoraEntry } from './chatModel';

/** Maximum length of a question (Intelligence RequestText). */
const MAX_QUESTION = 2000;

export function ChatPage() {
  const { t } = useTranslation();
  const { permissions } = useSession();
  const { source } = useSource();
  const { state, busy, ask, reset, select } = useChat();
  const [text, setText] = useState('');
  const [showDiagnostics, setShowDiagnostics] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [state.entries.length]);

  if (!permissions.chat) return <Alert color="gray">{t('common.noPermission')}</Alert>;

  const selected = state.entries.find((e): e is NexoraEntry => e.id === state.selectedId && e.role === 'nexora');
  const canSend = !!source && text.trim().length > 0 && !busy;
  const submit = () => {
    if (!canSend || !source) return;
    ask(text, source);
    setText('');
  };
  const diagnostics = permissions.diagnostics && showDiagnostics;

  return (
    <Stack gap="md" h="100%">
      <PageHeader
        title={t('chat.title')}
        subtitle={t('chat.subtitle')}
        actions={
          <Group gap="xs">
            {permissions.diagnostics && (
              <Button variant="subtle" onClick={() => setShowDiagnostics((v) => !v)}>
                {showDiagnostics ? t('diagnostics.hide') : t('diagnostics.show')}
              </Button>
            )}
            <Button variant="default" leftSection={<IconMessagePlus size={18} />} onClick={reset} disabled={busy}>
              {t('chat.newConversation')}
            </Button>
          </Group>
        }
      />
      {!source && <Alert color="yellow">{t('common.noSource')}</Alert>}
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: diagnostics ? 8 : 12 }}>
          <Paper withBorder p="md" style={{ background: 'var(--nexora-surface)' }}>
            <Stack gap="md" mih={320} aria-live="polite">
              {state.entries.length === 0 && (
                <Group gap="xs" c="var(--nexora-text-secondary)">
                  <IconInfoCircle size={18} aria-hidden />
                  <Text size="sm">{t('chat.empty')}</Text>
                </Group>
              )}
              {state.entries.map((entry) =>
                entry.role === 'user' ? (
                  <Box key={entry.id} style={{ alignSelf: 'flex-end' }} maw={620}>
                    <Paper p="sm" px="md" style={{ background: 'var(--nexora-user-bubble-bg)', color: 'var(--nexora-user-bubble-text)' }}>
                      <Text size="xs" fw={600} opacity={0.85}>{t('chat.you')}</Text>
                      <Text style={{ whiteSpace: 'pre-wrap' }}>{entry.text}</Text>
                    </Paper>
                  </Box>
                ) : (
                  <NexoraBubble
                    key={entry.id}
                    entry={entry}
                    selectable={permissions.diagnostics}
                    selected={entry.id === state.selectedId}
                    onSelect={() => select(entry.id)}
                  />
                ),
              )}
              <div ref={endRef} />
            </Stack>
          </Paper>
          <Stack gap={6} mt="md">
            <Group gap="xs">
              {source && <Badge variant="light">{t('chat.sourceLabel', { source: source.label })}</Badge>}
              <Text size="xs" className="nexora-secondary-text">{t('chat.sessionWarning')}</Text>
            </Group>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <Group align="flex-end" gap="sm" wrap="nowrap">
                <Textarea
                  style={{ flex: 1 }}
                  aria-label={t('chat.placeholder')}
                  placeholder={t('chat.placeholder')}
                  value={text}
                  maxLength={MAX_QUESTION}
                  autosize
                  minRows={2}
                  maxRows={6}
                  disabled={!source}
                  onChange={(e) => setText(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                />
                <Button type="submit" disabled={!canSend} loading={busy} leftSection={<IconSend size={18} />}>
                  {t('chat.send')}
                </Button>
              </Group>
            </form>
          </Stack>
        </Grid.Col>
        {diagnostics && (
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Paper withBorder p="md" style={{ background: 'var(--nexora-surface-alt)' }}>
              <DiagnosticsPanel entry={selected} />
            </Paper>
          </Grid.Col>
        )}
      </Grid>
    </Stack>
  );
}
