import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { SourceView } from '@/api/bff';
import { useSession } from '@/auth/SessionProvider';

interface SourceContextValue {
  sources: SourceView[];
  source: SourceView | undefined;
  select: (alias: string) => void;
}

const SourceContext = createContext<SourceContextValue | null>(null);
const STORAGE_KEY = 'nexora.source';

function remembered(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * D7: the data source the user works on, among those the BFF offers to its tenant. The choice is remembered in this
 * browser (a convenience; the BFF and the services check every call).
 */
export function SourceProvider({ children }: { children: ReactNode }) {
  const { sources } = useSession();
  const [alias, setAlias] = useState<string | null>(() => remembered());
  const value = useMemo<SourceContextValue>(() => {
    const source = sources.find((s) => s.alias === alias) ?? sources[0];
    return {
      sources,
      source,
      select: (next) => {
        setAlias(next);
        try {
          window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
          /* preference only */
        }
      },
    };
  }, [sources, alias]);
  return <SourceContext.Provider value={value}>{children}</SourceContext.Provider>;
}

export function useSource(): SourceContextValue {
  const value = useContext(SourceContext);
  if (!value) throw new Error('useSource outside SourceProvider');
  return value;
}
