import { Code, Paper, ScrollArea, Stack, Table, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { functionalStatus, type NexoraEntry } from './chatModel';

/** Fields of a structured answer that are never shown (none are expected; defense in depth). */
const HIDDEN = new Set(['accessToken', 'token', 'authorization', 'password', 'secret']);

function sanitized(value: unknown): string {
  return JSON.stringify(value, (k, v) => (HIDDEN.has(k.toLowerCase()) ? '[oculto]' : v), 2);
}

/**
 * D9: technical details of an answer, for administrators only (the BFF also withholds plan and run ids from others).
 * Never a token, a cookie or the content of a file.
 */
export function DiagnosticsPanel({ entry }: { entry: NexoraEntry | undefined }) {
  const { t } = useTranslation();
  if (!entry) {
    return <Text size="sm" className="nexora-secondary-text">{t('diagnostics.empty')}</Text>;
  }
  const o = entry.outcome;
  const problem = o?.kind === 'problem' ? o.problem : o?.kind === 'unknown' ? o.problem : undefined;
  const rows: [string, string | number | undefined][] = [
    [t('diagnostics.source'), entry.request.sourceAlias],
    [t('diagnostics.key'), entry.request.key],
    [t('diagnostics.httpStatus'), entry.meta?.httpStatus],
    [t('diagnostics.functionalStatus'), functionalStatus(entry)],
    [t('diagnostics.code'), problem?.code],
    [t('diagnostics.gapCodes'), problem?.gapCodes?.join(', ')],
    [t('diagnostics.stage'), problem?.stage],
    [t('diagnostics.reason'), problem?.reason],
    [t('diagnostics.correlationId'), o?.kind === 'clarification' || o?.kind === 'report' || o?.kind === 'problem' ? o.correlationId ?? problem?.correlationId : problem?.correlationId],
    [t('diagnostics.clarificationId'), o?.kind === 'clarification' ? o.clarificationId : 'clarification' in entry.request.body ? entry.request.body.clarification.id : undefined],
    [t('diagnostics.planId'), o?.kind === 'report' ? o.reportPlanId : (problem?.reportPlanId as string | undefined)],
    [t('diagnostics.runId'), o?.kind === 'report' ? o.runId : (problem?.runId as string | undefined)],
    [t('diagnostics.elapsed'), entry.meta ? `${Math.round(entry.meta.elapsedMs)} ms` : undefined],
    [t('diagnostics.bffElapsed'), entry.meta?.bffElapsedMs !== undefined ? `${entry.meta.bffElapsedMs} ms` : undefined],
  ];
  const structured = o?.kind === 'clarification' ? o.raw : problem;
  return (
    <Stack gap="sm">
      <Title order={5}>{t('diagnostics.title')}</Title>
      <Text size="xs" className="nexora-secondary-text">{t('diagnostics.note')}</Text>
      <Paper withBorder p="xs">
        <Text size="xs" fw={600}>{t('diagnostics.request')}</Text>
        <Code block tabIndex={0}>{sanitized(entry.request.body)}</Code>
      </Paper>
      <Table withRowBorders={false} verticalSpacing={2} fz="xs">
        <Table.Tbody>
          {rows.filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => (
            <Table.Tr key={k}>
              <Table.Th w={160}>{k}</Table.Th>
              <Table.Td style={{ wordBreak: 'break-all' }}>{String(v)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {structured !== undefined && (
        <Paper withBorder p="xs">
          <Text size="xs" fw={600}>{t('diagnostics.body')}</Text>
          <ScrollArea.Autosize mah={260}>
            <Code block tabIndex={0}>{sanitized(structured)}</Code>
          </ScrollArea.Autosize>
        </Paper>
      )}
    </Stack>
  );
}
