import { createContext, useContext, useEffect, useState } from "react";
import { getSession, onAuthStateChange, signOut as svcSignOut } from "@/services/authService";

/**
 * AuthContext
 * ────────────
 * Holds the current Supabase session + user, and exposes a single source of
 * truth for "is the user signed in?" across the whole app.
 *
 * On mount it does two things:
 *   1. `getSession()` — reads the persisted session out of localStorage so a
 *      hard refresh doesn't briefly flash the login page.
 *   2. `onAuthStateChange(...)` — subscribes to live events (SIGNED_IN,
 *      SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED) so every consumer reacts
 *      immediately when auth state changes anywhere in the app.
 *
 * `loading` is true ONLY until the initial session check resolves. We need
 * this flag because `ProtectedLayout` would otherwise redirect users to
 * /login during the brief window before getSession() returns.
 */

const AuthContext = createContext({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // 1) Hydrate from localStorage on mount.
    getSession().then((s) => {
      if (!mounted) return;
      setSession(s);
      setLoading(false);
    });

    // 2) Subscribe to future auth changes.
    const unsubscribe = onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      // After the first event fires we definitely know the auth state.
      setLoading(false);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    signOut: async () => {
      await svcSignOut();
      // onAuthStateChange will null out the session for us.
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth — convenience hook so components don't import the context directly.
 *  Usage: const { user, loading, signOut } = useAuth();
 */
export const useAuth = () => useContext(AuthContext);
