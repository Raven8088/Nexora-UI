import { Badge } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { DefinitionKind, DefinitionStatus } from '@/api/semanticTypes';

/** Approved: filled burgundy; draft (pending approval) and inactive: their design-system tokens (WCAG AA). */
const STATUS_STYLE: Record<DefinitionStatus, { background: string; color: string } | undefined> = {
  DRAFT: { background: 'var(--nexora-status-draft-bg)', color: 'var(--nexora-status-draft-text)' },
  APPROVED: undefined,
  INACTIVE: { background: 'var(--nexora-status-inactive-bg)', color: 'var(--nexora-status-inactive-text)' },
};

export function StatusBadge({ status, short = false }: { status: DefinitionStatus; short?: boolean }) {
  const { t } = useTranslation();
  const style = STATUS_STYLE[status];
  return (
    <Badge color="nexora" variant="filled" style={style}>
      {t(short ? `dictionary.statusShort.${status}` : `dictionary.status.${status}`)}
    </Badge>
  );
}

export function KindBadge({ kind }: { kind: DefinitionKind }) {
  const { t } = useTranslation();
  return (
    <Badge color="nexora" variant="outline">
      {t(`dictionary.kind.${kind}`)}
    </Badge>
  );
}
