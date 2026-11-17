import { useTranslation } from 'react-i18next';
import { useSession } from '@/auth/SessionProvider';

/**
 * B2: how the console names whoever Semantic recorded (author, editor, approver, audit actor). Semantic records the
 * token subject, the same identifier the BFF gives the console in the session: when they match it says «You»;
 * otherwise it shows the identifier as Semantic recorded it (the console has no directory of people and invents
 * no names).
 */
export function useActorLabel(): (id: string | null | undefined) => string {
  const { t } = useTranslation();
  const { subject } = useSession();
  return (id) => {
    if (!id) return '—';
    return subject && id === subject ? t('common.you') : id;
  };
}

/** B1: whether the signed-in person created or last edited the element (Semantic allows it and audits it, D-DIC-15). */
export function useIsOwnWork(): (createdBy?: string | null, updatedBy?: string | null) => boolean {
  const { subject } = useSession();
  return (createdBy, updatedBy) => !!subject && (createdBy === subject || updatedBy === subject);
}
