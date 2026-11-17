import { Alert, Anchor, Badge, Button, Group, Loader, Paper, Stack, Text } from '@mantine/core';
import { IconAlertTriangle, IconClockExclamation, IconDownload, IconFileSpreadsheet, IconHelpCircle, IconRefresh } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Problem } from '@/api/problem';
import { useSession } from '@/auth/SessionProvider';
import { formatBytes, formatDateTime } from '@/shared/format';
import { clarificationState, type NexoraEntry } from './chatModel';
import { useChat } from './ChatProvider';

/**
 * DEC-D-FE-1: codes of Intelligence that point at a configuration of the platform, not at the question. Every user gets
 * a neutral text; only users with diagnostics (PLATFORM_ADMIN) also get the administrative cause. No token, identity
 * or internal address is ever shown.
 */
const ADMIN_HINTS = new Set(['local_only', 'authentication_required']);

/** Codes of Intelligence that ask to repeat the same operation with the same key. */
const RETRY_SAME_KEY = new Set(['request_in_progress', 'busy']);

function useNow(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [enabled]);
  return now;
}

/** The text of a problem of the chat: the console's own text for its code, plus the service's business explanation. */
export function chatProblemText(t: (k: string, o?: Record<string, unknown>) => string, problem: Problem): string {
  if (problem.reason === 'CLARIFICATION_EXPIRED') return t('chat.errors.expired');
  if (problem.reason === 'CLARIFICATION_CONFLICT') return t('chat.errors.conflict');
  switch (problem.code) {
    case 'request_in_progress':
      return t('chat.inProgress');
    case 'request_completed':
      return t('chat.completed');
    case 'request_unresolved':
      return t('chat.unresolved');
    case 'busy':
      return t('chat.busy');
  }
  const key = `chat.errors.${problem.code}`;
  const text = t(key);
  return text === key ? t('chat.errors.generic') : text;
}

function Clarification({ entry }: { entry: NexoraEntry }) {
  const { t, i18n } = useTranslation();
  const { answer, busy } = useChat();
  const o = entry.outcome;
  const state = clarificationState(entry, useNow(true));
  if (!o || o.kind !== 'clarification') return null;
  const locked = state !== 'answerable' || busy;
  return (
    <Stack gap="sm">
      <Group gap="xs">
        <IconHelpCircle size={18} color="var(--nexora-accent)" aria-hidden />
        <Text fw={600} size="sm">{t('chat.clarificationTitle')}</Text>
      </Group>
      <Text>{o.question}</Text>
      <Group gap="xs" role="group" aria-label={t('chat.clarificationTitle')}>
        {o.options.map((label, i) => {
          const chosen = entry.answeredOptionId !== undefined && o.optionIds?.[i] === entry.answeredOptionId;
          const negative = o.optionIds?.[i] === 'none';
          return (
            <Button
              key={`${label}-${i}`}
              variant={chosen ? 'filled' : negative ? 'default' : 'outline'}
              disabled={locked && !chosen}
              onClick={() => answer(entry, i, t('chat.chose', { option: label }))}
              aria-pressed={chosen}
            >
              {label}
            </Button>
          );
        })}
      </Group>
      {state === 'answerable' && o.expiresAt && (
        <Text size="xs" className="nexora-secondary-text">
          {t('chat.expiresIn', { time: formatDateTime(o.expiresAt, i18n.language) })}
        </Text>
      )}
      {state === 'expired' && (
        <Alert color="yellow" icon={<IconClockExclamation size={18} />}>{t('chat.expired')}</Alert>
      )}
      {state === 'notAnswerable' && <Alert color="gray">{t('chat.notAnswerable')}</Alert>}
      {state === 'answered' && <Badge variant="light" w="fit-content">{t('chat.answered')}</Badge>}
    </Stack>
  );
}

function Report({ entry }: { entry: NexoraEntry }) {
  const { t } = useTranslation();
  const { state } = useChat();
  const report = state.reports.find((r) => r.id === entry.reportId);
  if (!report) return null;
  return (
    <Stack gap="sm">
      <Group gap="xs">
        <IconFileSpreadsheet size={20} color="var(--nexora-accent)" aria-hidden />
        <Text fw={600}>{t('chat.reportReady')}</Text>
      </Group>
      <Group gap="xs">
        <Badge variant="light">{report.sourceLabel}</Badge>
        {report.completeness && (
          <Badge color="nexora" variant="light" style={report.completeness === 'COMPLETED' ? undefined : { background: 'var(--nexora-status-draft-bg)', color: 'var(--nexora-status-draft-text)' }}>
            {t(`chat.completeness.${report.completeness}`, { defaultValue: report.completeness })}
          </Badge>
        )}
      </Group>
      <Text size="sm">{report.fileName} · {t('chat.size')}: {formatBytes(report.size)}</Text>
      {report.warnings.length > 0 && (
        <Text size="sm" className="nexora-secondary-text">{t('chat.warnings')}: {report.warnings.join(', ')}</Text>
      )}
      <Group>
        <Button component="a" href={report.url} download={report.fileName} leftSection={<IconDownload size={18} />}>
          {t('chat.download')}
        </Button>
      </Group>
      <Text size="xs" className="nexora-secondary-text">{t('chat.downloadWarning')}</Text>
    </Stack>
  );
}

export function ChatAnswer({ entry }: { entry: NexoraEntry }) {
  const { t } = useTranslation();
  const { retry, busy } = useChat();
  const { permissions } = useSession();
  if (entry.state === 'pending') {
    return (
      <Group gap="sm" role="status" aria-live="polite">
        <Loader size="sm" />
        <Text size="sm">{t('chat.sending')}</Text>
      </Group>
    );
  }
  const o = entry.outcome;
  if (!o) return null;
  switch (o.kind) {
    case 'clarification':
      return <Clarification entry={entry} />;
    case 'report':
      return <Report entry={entry} />;
    case 'unknown': {
      const notSent = o.outcome === 'NOT_SENT';
      return (
        <Alert color="yellow" icon={<IconAlertTriangle size={18} />} title={t(notSent ? 'chat.notSentTitle' : 'chat.unknownTitle')}>
          <Stack gap="xs">
            <Text size="sm">{t(notSent ? 'chat.notSentText' : 'chat.unknownText')}</Text>
            <Button size="xs" variant="outline" w="fit-content" leftSection={<IconRefresh size={14} />} disabled={busy} onClick={() => retry(entry)}>
              {t('chat.retrySame')}
            </Button>
          </Stack>
        </Alert>
      );
    }
    case 'problem': {
      const p = o.problem;
      const warning = ['request_in_progress', 'request_completed', 'request_unresolved', 'busy'].includes(p.code)
        || p.reason === 'CLARIFICATION_EXPIRED';
      return (
        <Stack gap="xs">
          {p.explanation && <Text>{p.explanation}</Text>}
          <Alert color={warning ? 'yellow' : p.code === 'not_answerable' ? 'gray' : 'red'} icon={<IconAlertTriangle size={18} />}>
            <Stack gap={4}>
              <Text size="sm">{chatProblemText(t, p)}</Text>
              {permissions.diagnostics && ADMIN_HINTS.has(p.code) && (
                <Text size="xs" data-testid="admin-hint">{t(`chat.adminHints.${p.code}`)}</Text>
              )}
              {(o.correlationId ?? p.correlationId) && (
                <Text size="xs" className="nexora-secondary-text">
                  {t('common.correlation')}: {o.correlationId ?? p.correlationId}
                </Text>
              )}
              {RETRY_SAME_KEY.has(p.code) && (
                <Anchor component="button" size="sm" disabled={busy} onClick={() => retry(entry)}>
                  {t('chat.retrySame')}
                </Anchor>
              )}
            </Stack>
          </Alert>
        </Stack>
      );
    }
  }
}

export function NexoraBubble({ entry, selected, onSelect, selectable }: { entry: NexoraEntry; selected: boolean; onSelect: () => void; selectable: boolean }) {
  const { t } = useTranslation();
  return (
    <Paper
      p="md"
      maw={720}
      style={{
        background: 'var(--nexora-nexora-bubble-bg)',
        border: `1px solid ${selected && selectable ? 'var(--nexora-accent)' : 'var(--nexora-nexora-bubble-border)'}`,
        cursor: selectable ? 'pointer' : undefined,
      }}
      onClick={selectable ? onSelect : undefined}
      aria-label={t('chat.nexora')}
    >
      <Text size="xs" fw={600} c="var(--nexora-accent)" mb={6}>{t('chat.nexora')}</Text>
      <ChatAnswer entry={entry} />
    </Paper>
  );
}
