import { Alert } from '@mantine/core';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes } from 'react-router-dom';
import { SessionProvider, useSession } from '@/auth/SessionProvider';
import { SourceProvider } from '@/context/SourceContext';
import { ChatProvider } from '@/features/chat/ChatProvider';
import { ChatPage } from '@/features/chat/ChatPage';
import { DictionaryPage } from '@/features/dictionary/DictionaryPage';
import { HomePage } from '@/features/home/HomePage';
import { RelationshipsPage } from '@/features/relationships/RelationshipsPage';
import { AssistedPage } from '@/features/assisted/AssistedPage';
import { ConceptAssistPage } from '@/features/concepts/ConceptAssistPage';
import { SessionReportsPage } from '@/features/reports/SessionReportsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { SuggestionsPage } from '@/features/suggestions/SuggestionsPage';
import { Shell } from './Shell';

function Guard({ allowed, children }: { allowed: boolean; children: ReactNode }) {
  const { t } = useTranslation();
  return allowed ? <>{children}</> : <Alert color="gray">{t('common.noPermission')}</Alert>;
}

function Routed() {
  const { permissions } = useSession();
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/chat" element={<Guard allowed={permissions.chat}><ChatPage /></Guard>} />
        <Route path="/reportes" element={<Guard allowed={permissions.chat}><SessionReportsPage /></Guard>} />
        <Route path="/diccionario" element={<Guard allowed={permissions.catalogRead}><DictionaryPage /></Guard>} />
        <Route path="/diccionario/relaciones" element={<Guard allowed={permissions.catalogRead}><RelationshipsPage /></Guard>} />
        <Route path="/diccionario/crear-con-ayuda" element={<Guard allowed={permissions.proposalWrite}><AssistedPage /></Guard>} />
        <Route path="/diccionario/nuevo-concepto" element={<Guard allowed={permissions.proposalWrite}><ConceptAssistPage /></Guard>} />
        <Route path="/sugerencias" element={<SuggestionsPage />} />
        <Route path="/configuracion" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

/** The console after sign-in. The chat lives above the routes so it survives navigation within the session. */
export function App() {
  return (
    <SessionProvider>
      <SourceProvider>
        <ChatProvider>
          <Routed />
        </ChatProvider>
      </SourceProvider>
    </SessionProvider>
  );
}
