import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSession, subscribeToSession } from './auth';
import { startFreshBuyerSession } from './queries/session';

type AuthContextValue = {
  ready: boolean;
  session: Session | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let mounted = true;
    void getSession().then((restored) => {
      if (!mounted) return;
      setSession(restored);
      setReady(true);
    });

    const unsubscribe = subscribeToSession((next, event) => {
      if (!mounted) return;
      setSession(next);
      setReady(true);

      if (event === 'SIGNED_OUT') {
        queryClient.clear();
        return;
      }

      // A real sign-in starts a clean buyer workspace. Token refresh and
      // page restore must not wipe cart or favourites.
      if (event === 'SIGNED_IN' && next) {
        void startFreshBuyerSession(next.user.id).finally(() => {
          queryClient.clear();
        });
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [queryClient]);

  const value = useMemo(() => ({ ready, session }), [ready, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthSession(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthSession must be used within AuthProvider');
  }
  return context;
}
