import { Button, Checkbox, Group, Modal, Stack, Text, Textarea } from '@mantine/core';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/** Semantic DeactivateRequest: 1–500 characters. */
export const DEACTIVATE_REASON_MAX = 500;
/** Semantic RejectRequest of a suggestion: 1–2000 characters. */
export const SUGGESTION_REASON_MAX = 2000;

/**
 * Confirmation of a sensitive action. With `requireReason`, a reason (1–`maxReason` characters, as the Semantic
 * operation requires: 500 by default) must be written; with `acknowledgeLabel`, an explicit checkbox must be ticked
 * (B4: correcting an approved element). The confirm button stays disabled until both hold, and while `busy`.
 */
export function ConfirmDialog(props: {
  opened: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  requireReason?: boolean;
  maxReason?: number;
  acknowledgeLabel?: string;
  busy?: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const max = props.maxReason ?? DEACTIVATE_REASON_MAX;
  const trimmed = reason.trim();
  const reasonValid = !props.requireReason || (trimmed.length > 0 && trimmed.length <= max);
  const ackValid = !props.acknowledgeLabel || acknowledged;
  const close = () => {
    setReason('');
    setAcknowledged(false);
    props.onClose();
  };
  return (
    <Modal opened={props.opened} onClose={close} title={props.title} centered closeButtonProps={{ 'aria-label': t('common.close') }}>
      <Stack gap="md">
        {typeof props.children === 'string' ? <Text size="sm">{props.children}</Text> : props.children}
        {props.requireReason && (
          <Textarea
            label={t('dictionary.reasonLabel', { max })}
            description={t('dictionary.reasonHint')}
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            maxLength={max}
            autosize
            minRows={2}
            required
            data-autofocus
          />
        )}
        {props.acknowledgeLabel && (
          <Checkbox checked={acknowledged} onChange={(e) => setAcknowledged(e.currentTarget.checked)} label={props.acknowledgeLabel} />
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={props.danger ? 'outline' : 'filled'}
            disabled={!reasonValid || !ackValid}
            loading={props.busy}
            onClick={() => props.onConfirm(trimmed)}
          >
            {props.confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
