import { Navigate, Outlet, useLocation } from "react-router-dom";
import { BrainCog } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

/**
 * ProtectedLayout
 * ────────────────
 * Wraps the eight authenticated dashboard routes (/dashboard, /customers, …).
 *
 * Behaviour:
 *   - While the initial session check is in flight (`loading === true`) we
 *     render a centered brand splash. This avoids the "flash of login page"
 *     that happens if you redirect before Supabase has hydrated from
 *     localStorage.
 *   - If there is no session, redirect to /login and remember where the user
 *     was trying to go via `location.state.from`, so we can send them back
 *     after sign-in (wired in LoginPage).
 *   - Otherwise render the matched child route via <Outlet />. Each child
 *     page provides its own <DashboardLayout> (sidebar + topbar) so this
 *     wrapper stays auth-only — single responsibility.
 */
export default function ProtectedLayout() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center bg-background text-foreground">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-emerald-glow opacity-50" />
        <div className="relative flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/40 animate-pulse">
            <BrainCog className="h-5 w-5 text-emerald-400" />
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Loading workspace…
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
