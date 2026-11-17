import { Alert, Button, Stack, Table, Text } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useChat } from '../chat/ChatProvider';
import { formatBytes, formatDateTime } from '@/shared/format';
import { PageHeader } from '@/shared/PageHeader';

/** D8: the Excel files generated in this session (in memory; lost when the page is closed or reloaded). */
export function SessionReportsPage() {
  const { t, i18n } = useTranslation();
  const { state } = useChat();
  return (
    <Stack gap="md">
      <PageHeader title={t('reports.title')} subtitle={t('reports.subtitle')} />
      <Alert color="yellow" variant="light">{t('chat.downloadWarning')}</Alert>
      {state.reports.length === 0 ? (
        <Text className="nexora-secondary-text">{t('reports.empty')}</Text>
      ) : (
        <Table.ScrollContainer minWidth={640}>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('reports.question')}</Table.Th>
                <Table.Th>{t('reports.source')}</Table.Th>
                <Table.Th>{t('reports.generatedAt')}</Table.Th>
                <Table.Th>{t('reports.file')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {state.reports.map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td>{r.question}</Table.Td>
                  <Table.Td>{r.sourceLabel}</Table.Td>
                  <Table.Td>{formatDateTime(new Date(r.createdAt).toISOString(), i18n.language)}</Table.Td>
                  <Table.Td>
                    <Button component="a" href={r.url} download={r.fileName} size="xs" variant="light" leftSection={<IconDownload size={14} />}>
                      {r.fileName} ({formatBytes(r.size)})
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Stack>
  );
}
