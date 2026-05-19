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

// Maps each dropdown label to a day count (null = no limit = All Time).
const RANGE_DAYS = {
  "Last 7 Days":    7,
  "Last 30 Days":   30,
  "Last 3 Months":  90,
  "Last 6 Months":  180,
  "Last 12 Months": 365,
  "All Time":       null,
};

/**
 * Given a preset label, return ISO date strings for [dateFrom, dateTo].
 * Both are null when "All Time" is selected (no filtering).
 */
function computeBounds(range) {
  const days = RANGE_DAYS[range] ?? null;
  if (!days) return { dateFrom: null, dateTo: null };
  const to   = new Date(DATASET_MAX_DATE);
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  return {
    dateFrom: from.toISOString().split("T")[0],
    dateTo:   to.toISOString().split("T")[0],
  };
}

const DashboardContext = createContext({
  searchQuery: "",
  setSearchQuery: () => {},
  dateRange: "Last 30 Days",
  setDateRange: () => {},
  dateFrom: null,
  dateTo:   null,
});

export function DashboardProvider({ children }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange]     = useState("Last 30 Days");

  const { dateFrom, dateTo } = useMemo(() => computeBounds(dateRange), [dateRange]);

  return (
    <DashboardContext.Provider
      value={{ searchQuery, setSearchQuery, dateRange, setDateRange, dateFrom, dateTo }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export const useDashboard = () => useContext(DashboardContext);
