import { supabase } from "./supabaseClient";

/**
 * dashboardService — every Supabase fetch the DashboardPage needs.
 *
 * Each function:
 *   - hits exactly one view (see database/views.sql)
 *   - reshapes the row(s) into the shape the chart / card component already
 *     expects from the Phase 3 mockData.js (so swapping mock → live is a
 *     one-line change in the page itself)
 *   - throws on Supabase error so useSupabaseQuery's catch path surfaces it
 *     to the SectionError component.
 *
 * Why reshape here instead of in the component?
 *   The components were written against the mock-data shapes long before the
 *   Postgres column names were finalised (e.g. mock used `name`, the view
 *   returns `segment_label`). Reshaping here keeps every component bound to
 *   one stable shape regardless of how the SQL evolves.
 */

/* ------------------------------------------------------------------ */
/* Helper: throw on Supabase error so the caller doesn't have to       */
/* destructure manually every time.                                    */
/* ------------------------------------------------------------------ */
function unwrap({ data, error }) {
  if (error) throw error;
  return data ?? [];
}

/* ------------------------------------------------------------------ */
/* KPI cards (DashboardPage top row)                                   */
/* ------------------------------------------------------------------ */

/**
 * Returns the four headline KPIs in the exact shape KpiCard expects:
 *   [{ key, label, value, change, type, icon, accent }, ...]
 *
 * View: v_kpi_summary (latest row + LAG-computed deltas).
 * `*_delta` columns are decimals in [-1, 1]; we multiply by 100 so KpiCard's
 * `formatPercent` renders "12.4%" not "0.124%".
 */
export async function fetchKpiCards() {
  const rows = unwrap(
    await supabase
      .from("v_kpi_summary")
      .select(
        "total_revenue, total_orders, active_customers, avg_order_value, " +
        "revenue_delta, orders_delta, active_customers_delta, aov_delta"
      )
      .limit(1)
  );
  if (rows.length === 0) return [];

  const r = rows[0];
  const toPct = (d) => (d == null ? 0 : Number(d) * 100);

  return [
    {
      key: "revenue",
      label: "Total Revenue",
      value: Number(r.total_revenue ?? 0),
      change: toPct(r.revenue_delta),
      type: "currency",
      icon: "wallet",
      accent: "emerald",
    },
    {
      key: "orders",
      label: "Total Orders",
      value: Number(r.total_orders ?? 0),
      change: toPct(r.orders_delta),
      type: "number",
      icon: "shopping-bag",
      accent: "blue",
    },
    {
      key: "aov",
      label: "Avg Order Value",
      value: Number(r.avg_order_value ?? 0),
      change: toPct(r.aov_delta),
      type: "currency",
      icon: "receipt",
      accent: "purple",
    },
    {
      key: "active",
      label: "Active Customers",
      value: Number(r.active_customers ?? 0),
      change: toPct(r.active_customers_delta),
      type: "number",
      icon: "trending-up",
      accent: "emerald",
    },
  ];
}

/* ------------------------------------------------------------------ */
/* 7-day revenue bar chart                                             */
/* ------------------------------------------------------------------ */

/**
 * Returns `[{ day, revenue }]` where `day` is a 3-letter weekday label
 * matching what RevenueBarChart's X-axis expects.
 *
 * View: v_revenue_daily_7d (columns: day, order_count, revenue).
 * View's `day` is a Postgres date; we convert to "Mon" / "Tue" / ... here.
 */
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function fetchRevenueLast7Days() {
  const rows = unwrap(
    await supabase
      .from("v_revenue_daily_7d")
      .select("day, revenue")
      .order("day", { ascending: true })
  );
  return rows.map((r) => ({
    day: WEEKDAYS[new Date(r.day).getUTCDay()],
    date: r.day,
    revenue: Number(r.revenue ?? 0),
    // RevenueBarChart only cares about {day, revenue}; the rest is for tooltips
    // we might add in Phase 10.
    predicted: Number(r.revenue ?? 0),
  }));
}

/* ------------------------------------------------------------------ */
/* 12-month revenue area chart                                         */
/* ------------------------------------------------------------------ */

/**
 * Returns `[{ month, actual, predicted }]` shaped for RevenueAreaChart.
 *
 * `actual` comes from v_revenue_monthly (Phase 5 view over orders+payments).
 * `predicted` comes from the optional sklearn forecaster's output joined on
 * month. If the forecaster wasn't run, `predicted` mirrors `actual` so the
 * dashed line in the chart visually overlays the solid line instead of
 * disappearing.
 *
 * We trim to the *trailing 12 months* of v_revenue_monthly so the chart shows
 * a clean 12-point series regardless of how many months of Olist data the
 * pipeline ingested.
 */
const MONTHS_LABEL = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export async function fetchRevenueMonthly() {
  const rows = unwrap(
    await supabase
      .from("v_revenue_monthly")
      .select("month, revenue, order_count, customer_count")
      .order("month", { ascending: true })
  );

  const last12 = rows.slice(-12);
  return last12.map((r) => {
    const d = new Date(r.month);
    return {
      month:         MONTHS_LABEL[d.getUTCMonth()],
      monthDate:     r.month,                          // "YYYY-MM-DD" — used for date filtering
      actual:        Number(r.revenue      ?? 0),
      predicted:     Number(r.revenue      ?? 0),
      orderCount:    Number(r.order_count   ?? 0),     // needed by date-range KPI derivation
      customerCount: Number(r.customer_count ?? 0),   // needed by date-range KPI derivation
    };
  });
}

/**
 * Optional: join the forecast series onto monthly revenue.
 * Returns the same shape as fetchRevenueMonthly() but with `predicted` taken
 * from public.sales_forecasts where a date matches.
 *
 * The forecast is daily and the monthly chart bucketises, so we sum forecast
 * rows by month. If no forecast rows exist, falls back to the historical
 * revenue (same as fetchRevenueMonthly).
 */
export async function fetchRevenueMonthlyWithForecast() {
  const [actuals, forecasts] = await Promise.all([
    fetchRevenueMonthly(),
    supabase
      .from("sales_forecasts")
      .select("forecast_date, predicted_revenue")
      .then(unwrap),
  ]);

  if (!forecasts || forecasts.length === 0) return actuals;

  // Bucketise forecast rows by YYYY-MM.
  const forecastByMonth = forecasts.reduce((acc, row) => {
    const key = String(row.forecast_date).slice(0, 7); // 'YYYY-MM'
    acc[key] = (acc[key] ?? 0) + Number(row.predicted_revenue ?? 0);
    return acc;
  }, {});

  return actuals.map((row) => {
    const key = String(row.monthDate).slice(0, 7);
    const forecastForMonth = forecastByMonth[key];
    return forecastForMonth != null
      ? { ...row, predicted: forecastForMonth }
      : row;
  });
}

/* ------------------------------------------------------------------ */
/* Recent orders table                                                 */
/* ------------------------------------------------------------------ */

const STATUS_LABEL = {
  delivered: "Delivered",
  shipped: "Delivered",     // treat shipped as delivered for the pill colours
  invoiced: "Processing",
  processing: "Processing",
  approved: "Processing",
  created: "Processing",
  canceled: "Cancelled",
  unavailable: "Cancelled",
};

/**
 * Returns `[{ id, customer, status, date, amount }]` for the dashboard table.
 *
 * View: v_recent_orders (last 50 orders, joined with customers + payments).
 * Olist doesn't store a customer *name*, so we display the truncated
 * `customer_unique_id` — close enough for a demo and viva-defendable.
 */
export async function fetchRecentOrders(limit = 6) {
  const rows = unwrap(
    await supabase
      .from("v_recent_orders")
      .select(
        "order_id, order_status, order_purchase_timestamp, customer_unique_id, customer_state, order_total"
      )
      .limit(limit)
  );

  return rows.map((r) => ({
    id: String(r.order_id).slice(0, 8).toUpperCase(),
    rawId: r.order_id,
    customer:
      r.customer_unique_id
        ? `Customer ${String(r.customer_unique_id).slice(0, 8).toUpperCase()}` +
          (r.customer_state ? ` · ${r.customer_state}` : "")
        : "Anonymous",
    status: STATUS_LABEL[String(r.order_status).toLowerCase()] ?? "Processing",
    date: r.order_purchase_timestamp,
    amount: Number(r.order_total ?? 0),
  }));
}

/* ------------------------------------------------------------------ */
/* Segment donut + legend                                              */
/* ------------------------------------------------------------------ */

/**
 * Returns `[{ name, value, customers }]` for SegmentPieChart.
 *  - name      : VIP | Loyal | At Risk | New
 *  - value     : pct as integer (so the donut centre reads "100%")
 *  - customers : raw count, displayed in the page summary line
 */
export async function fetchSegmentDistribution() {
  const rows = unwrap(
    await supabase
      .from("v_segment_distribution")
      .select("segment_label, customer_count, pct")
      .order("customer_count", { ascending: false })
  );

  return rows.map((r) => ({
    name: r.segment_label,
    value: Math.round(Number(r.pct ?? 0)),
    customers: Number(r.customer_count ?? 0),
  }));
}
