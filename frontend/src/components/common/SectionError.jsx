import { AlertTriangle, RefreshCcw } from "lucide-react";

/**
 * SectionError — small error block rendered inside an InsightCard when a
 * Supabase query fails (RLS misconfig, paused project, table missing, etc.).
 *
 * We do NOT print the raw error to end users in production builds — show a
 * generic message, and only surface the technical detail in dev so the
 * console.error in useSupabaseQuery is the source of truth.
 *
 * Props
 *   message : friendly headline (e.g. "Couldn't load revenue trend")
 *   error   : the Error object from useSupabaseQuery (for dev-only detail)
 *   onRetry : optional refetch handler from the same hook
 */
export default function SectionError({ message = "Something went wrong.", error, onRetry }) {
  const isDev = typeof import.meta !== "undefined" && import.meta.env?.DEV;
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] p-4 text-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/15 ring-1 ring-red-500/30">
          <AlertTriangle className="h-4 w-4 text-red-400" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-red-500 dark:text-red-300">{message}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            The dashboard is connected to Supabase but the analytics tables didn&apos;t respond.
            {" "}
            Check that the Phase 7 pipeline (<code className="font-mono text-[11px]">seed_supabase.py</code>) ran
            and that your Supabase project isn&apos;t paused.
          </p>
          {isDev && error && (
            <p className="mt-2 break-words font-mono text-[10px] text-red-300/70">
              {String(error.message || error)}
            </p>
          )}
        </div>
        {onRetry && (
          <button onClick={onRetry} className="btn-secondary shrink-0 !py-1.5 text-xs">
            <RefreshCcw className="h-3.5 w-3.5" /> Retry
          </button>
        )}
      </div>
    </div>
  );
}
