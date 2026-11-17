import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSession, type SessionView } from '@/api/bff';
import { SESSION_EXPIRED_EVENT } from '@/api/http';
import { SessionExpiredError } from '@/api/problem';
import { LoginScreen } from './LoginScreen';
import { LoadingState } from '@/shared/LoadingState';

interface SessionContextValue {
  session: SessionView;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/** The signed-in user. Every screen below it can rely on a session. */
export function useSession(): SessionView {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession outside SessionProvider');
  return value.session;
}

/**
 * Loads the session from the BFF. Without a session, the login screen; when any call finds the session ended (401),
 * the login screen again with an explanation (whatever was on the page is lost).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [expired, setExpired] = useState(false);
  const session = useQuery({ queryKey: ['session'], queryFn: fetchSession, retry: false, staleTime: 60_000, enabled: !expired });
  const signedIn = useRef(false);
  signedIn.current = !!session.data;

  useEffect(() => {
    // A 401 after signing in means the session ended. The session query is disabled (not removed) so the 401 is not
    // repeated in a loop; the cached data of the previous session is discarded.
    const onExpired = () => {
      if (!signedIn.current) return;
      setExpired(true);
      void queryClient.cancelQueries();
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' });
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [queryClient]);

  if (expired) return <LoginScreen expired />;
  if (session.isPending) return <LoadingState fullPage labelKey="auth.loading" />;
  if (session.error instanceof SessionExpiredError) return <LoginScreen />;
  if (session.isError || !session.data) return <LoginScreen unavailable />;
  return <SessionContext.Provider value={{ session: session.data }}>{children}</SessionContext.Provider>;
}
