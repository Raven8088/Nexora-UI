import { Text, Timeline, Stack } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listAuditEvents } from '@/api/semantic';
import type { AuditTargetType } from '@/api/semanticTypes';
import { useSession } from '@/auth/SessionProvider';
import { useActorLabel } from './actor';
import { formatDateTime } from './format';
import { LoadingState } from './LoadingState';
import { ProblemAlert } from './ProblemAlert';

export const auditKey = (targetType: AuditTargetType, id: string) => ['audit', targetType, id] as const;

/**
 * B2 / D-C: the audit history of a definition, relationship or suggestion, exactly as Semantic records it. It is only
 * requested for people with AUDIT_READ (AUDITOR); others see why it is not available. Nothing is inferred: no
 * inverse links, no differences between versions.
 */
export function AuditTimeline({ targetType, targetId }: { targetType: AuditTargetType; targetId: string }) {
  const { t, i18n } = useTranslation();
  const { permissions } = useSession();
  const actor = useActorLabel();
  const audit = useQuery({
    queryKey: auditKey(targetType, targetId),
    queryFn: () => listAuditEvents(targetId, targetType),
    enabled: permissions.audit,
  });
  if (!permissions.audit) return <Text size="sm">{t('audit.requiresAudit')}</Text>;
  if (audit.isLoading) return <LoadingState />;
  if (audit.error) return <ProblemAlert error={audit.error} />;
  const events = audit.data ?? [];
  if (events.length === 0) return <Text size="sm">{t('audit.empty')}</Text>;
  return (
    <Stack gap="sm">
      <Text size="xs" className="nexora-secondary-text">{t('audit.note')}</Text>
      <Timeline bulletSize={14} lineWidth={2}>
        {events.map((e) => (
          <Timeline.Item key={e.id} title={t(`audit.action.${e.action}`, { defaultValue: e.action })}>
            <Text size="xs" className="nexora-secondary-text">
              {formatDateTime(e.occurredAt, i18n.language)} · {t('audit.actor')}: {actor(e.actorId)}
            </Text>
            {e.details && Object.keys(e.details).length > 0 && (
              <Text size="xs" style={{ wordBreak: 'break-word' }}>
                {Object.entries(e.details).map(([k, v]) => `${k}: ${String(v)}`).join(' · ')}
              </Text>
            )}
          </Timeline.Item>
        ))}
      </Timeline>
    </Stack>
  );
}
