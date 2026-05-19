import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useSupabaseQuery — generic loading-state wrapper for any async fetcher.
 *
 * Why a hook (instead of letting each page useEffect its own fetch)?
 *   - One loading/error/data tri-state shape across every page, so the
 *     LoadingSkeleton and SectionError helpers can render uniformly.
 *   - Cancels stale results when the dependency array changes — without this,
 *     a slow first request can clobber a fast second one on the same screen.
 *   - Returns a `refetch` so the UI's "Retry" buttons and date-range pickers
 *     can re-pull without reloading the whole page.
 *
 * @template T
 * @param {() => Promise<T>} fetcher   Async function that runs the actual
 *                                     supabase.from(...).select(...) call. It
 *                                     should resolve to the chart-ready shape.
 * @param {any[]} deps                 Re-run when any of these change.
 *
 * @returns {{
 *   data:    T|null,
 *   loading: boolean,
 *   error:   Error|null,
 *   refetch: () => void
 * }}
 */
export function useSupabaseQuery(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Bumping this counter forces a re-run even when deps haven't changed.
  const [tick, setTick] = useState(0);

  // Tracks the latest in-flight request so older resolutions don't overwrite
  // newer ones. (Classic race-condition fix for useEffect + async.)
  const reqIdRef = useRef(0);

  useEffect(() => {
    const myReqId = ++reqIdRef.current;
    let cancelled = false;

    setLoading(true);
    setError(null);

    Promise.resolve()
      .then(fetcher)
      .then((value) => {
        if (cancelled || myReqId !== reqIdRef.current) return;
        setData(value);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled || myReqId !== reqIdRef.current) return;
        // eslint-disable-next-line no-console
        console.error("[useSupabaseQuery]", err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const refetch = useCallback(() => setTick((n) => n + 1), []);

  return { data, loading, error, refetch };
}

export default useSupabaseQuery;
