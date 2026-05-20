import { createContext, useContext, useMemo, useState } from "react";

/**
 * DashboardContext
 * ─────────────────
 * Provides shared state used by the Topbar (which renders search + date
 * controls) and all dashboard pages (which filter/display based on them).
 *
 * - searchQuery  : the current search string typed in the Topbar
 * - dateRange    : selected preset label, e.g. "Last 30 Days"
 * - dateFrom     : ISO date string for the start of the selected range
 * - dateTo       : ISO date string for the end of the selected range (always the Olist max date)
 *
 * NOTE: The Olist dataset is historical — data runs through 2018-10-17.
 * Date bounds are computed relative to that max date so filtering returns
 * real rows instead of an empty set.
 */

// Olist dataset ceiling date (latest order in the dataset).
const DATASET_MAX_DATE = "2018-10-17";

// How many calendar months each preset covers (null = all months = no slice).
// Used by pages to do data.slice(-nMonths) on already-sorted monthly trend data,
// which is robust regardless of the exact date string format Supabase returns.
const RANGE_MONTHS = {
  "Last 7 Days":    1,
  "Last 30 Days":   2,
  "Last 3 Months":  3,
  "Last 6 Months":  6,
  "Last 12 Months": 12,
  "All Time":       null,
};

// Maps each dropdown label to a day count — used for exact-date filtering
// on tables that have full timestamps (e.g. the orders table).
const RANGE_DAYS = {
  "Last 7 Days":    7,
  "Last 30 Days":   30,
  "Last 3 Months":  90,
  "Last 6 Months":  180,
  "Last 12 Months": 365,
  "All Time":       null,
};

/**
 * Given a preset label, return:
 *  - dateFrom / dateTo  : ISO "YYYY-MM-DD" strings relative to DATASET_MAX_DATE
 *                         (null for "All Time"; used to filter order timestamps)
 *  - nMonths            : integer for slicing monthly trend arrays
 *                         (null for "All Time" = keep all rows)
 */
function computeBounds(range) {
  const nMonths = RANGE_MONTHS[range] ?? null;
  const days    = RANGE_DAYS[range]   ?? null;

  if (!days) return { dateFrom: null, dateTo: null, nMonths };

  const to   = new Date(DATASET_MAX_DATE);
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  return {
    dateFrom: from.toISOString().split("T")[0],
    dateTo:   to.toISOString().split("T")[0],
    nMonths,
  };
}

const DashboardContext = createContext({
  searchQuery: "",
  setSearchQuery: () => {},
  dateRange: "Last 30 Days",
  setDateRange: () => {},
  dateFrom: null,
  dateTo:   null,
  nMonths:  null,
});

export function DashboardProvider({ children }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange]     = useState("Last 30 Days");

  const { dateFrom, dateTo, nMonths } = useMemo(() => computeBounds(dateRange), [dateRange]);

  return (
    <DashboardContext.Provider
      value={{ searchQuery, setSearchQuery, dateRange, setDateRange, dateFrom, dateTo, nMonths }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export const useDashboard = () => useContext(DashboardContext);
