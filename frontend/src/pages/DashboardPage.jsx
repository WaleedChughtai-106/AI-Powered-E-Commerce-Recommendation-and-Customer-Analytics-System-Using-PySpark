import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Sparkles, AlertTriangle, CheckCircle2, ArrowRight, Search, X } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/cards/PageHeader";
import KpiCard from "@/components/cards/KpiCard";
import InsightCard from "@/components/cards/InsightCard";
import SegmentPieChart from "@/charts/SegmentPieChart";
import RevenueBarChart from "@/charts/RevenueBarChart";
import RevenueAreaChart from "@/charts/RevenueAreaChart";
import LoadingSkeleton from "@/components/common/LoadingSkeleton";
import SectionError from "@/components/common/SectionError";
import useSupabaseQuery from "@/hooks/useSupabaseQuery";
import {
  fetchKpiCards,
  fetchRevenueLast7Days,
  fetchRevenueMonthlyWithForecast,
  fetchRecentOrders,
  fetchSegmentDistribution,
} from "@/services/dashboardService";
import { useDashboard } from "@/context/DashboardContext";
import { formatCurrency, formatShortDate } from "@/utils/formatters";
import { cn } from "@/lib/utils";

const STATUS_PILL = {
  Delivered: "pill-emerald",
  Processing: "pill-purple",
  Cancelled: "pill-coral",
};

export default function DashboardPage() {
  const [range, setRange] = useState("7D");
  const [orderSearch, setOrderSearch] = useState("");

  // ── Date range from global context ──────────────────────────────────
  const { dateFrom, dateTo, nMonths } = useDashboard();

  const kpis     = useSupabaseQuery(fetchKpiCards);
  const trend7d  = useSupabaseQuery(fetchRevenueLast7Days);
  const trend12m = useSupabaseQuery(fetchRevenueMonthlyWithForecast);
  const orders   = useSupabaseQuery(() => fetchRecentOrders(50));
  const segments = useSupabaseQuery(fetchSegmentDistribution);

  // ── Filter monthly trend by selected date range ──────────────────────
  // Use slice(-nMonths) on the already-sorted array — robust regardless of
  // the exact date string format Supabase returns for the month column.
  const filteredTrend12m = useMemo(() => {
    const data = trend12m.data ?? [];
    if (!nMonths) return data;           // "All Time" → keep everything
    return data.slice(-nMonths);         // last N calendar months
  }, [trend12m.data, nMonths]);

  // ── Derive KPI values from filtered trend (overrides static view) ────
  // When a date range is active we sum from the monthly trend rows so
  // every KPI card reflects only the chosen period.
  const displayKpis = useMemo(() => {
    const base = kpis.data ?? [];
    if (!nMonths || filteredTrend12m.length === 0) return base;

    const revenue   = filteredTrend12m.reduce((s, r) => s + (r.actual ?? 0), 0);
    const ordersSum = filteredTrend12m.reduce((s, r) => s + (r.orderCount ?? 0), 0);
    const customers = Math.max(...filteredTrend12m.map((r) => r.customerCount ?? 0));
    const aov       = ordersSum > 0 ? revenue / ordersSum : 0;

    return [
      { key: "revenue", label: "Total Revenue",    value: revenue,   change: 0, type: "currency", icon: "wallet",       accent: "emerald" },
      { key: "orders",  label: "Total Orders",      value: ordersSum, change: 0, type: "number",   icon: "shopping-bag", accent: "blue"    },
      { key: "aov",     label: "Avg Order Value",   value: aov,       change: 0, type: "currency", icon: "receipt",      accent: "purple"  },
      { key: "active",  label: "Active Customers",  value: customers, change: 0, type: "number",   icon: "trending-up",  accent: "emerald" },
    ];
  }, [kpis.data, filteredTrend12m, dateFrom]);

  // ── Filter orders by date range + search query ───────────────────────
  const filteredOrders = useMemo(() => {
    let data = orders.data ?? [];
    if (dateFrom) {
      // o.date is a full timestamp string; slice to "YYYY-MM-DD" for comparison
      data = data.filter((o) => {
        const d = String(o.date ?? "").slice(0, 10);
        return d >= dateFrom && d <= dateTo;
      });
    }
    if (!orderSearch.trim()) return data.slice(0, 6);
    const q = orderSearch.toLowerCase();
    return data.filter(
      (o) =>
        o.id.toLowerCase().includes(q) ||
        o.customer.toLowerCase().includes(q) ||
        o.status.toLowerCase().includes(q)
    );
  }, [orders.data, orderSearch, dateFrom, dateTo]);

  return (
    <DashboardLayout>
      <PageHeader
        title="Dashboard"
        description="Realtime overview of revenue, orders, customer engagement and AI-recommended actions."
      />

      {/* KPI Row */}
      {kpis.loading ? (
        <LoadingSkeleton variant="kpi" rows={4} />
      ) : kpis.error ? (
        <SectionError
          message="Couldn't load KPI summary"
          error={kpis.error}
          onRetry={kpis.refetch}
        />
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {displayKpis.map((k) => (
            <KpiCard key={k.key} {...k} />
          ))}
        </div>
      )}

      {/* Trend + Daily Snapshot */}
      <div className="mt-6 grid gap-4 grid-cols-1 lg:grid-cols-3">
        <InsightCard
          title="Revenue Trend"
          subtitle={
            range === "7D"
              ? "Daily gross revenue across all channels"
              : "Monthly revenue with AI-predicted overlay"
          }
          className="lg:col-span-2"
          action={
            <div className="inline-flex rounded-lg border border-white/[0.08] bg-surface-2 p-1 text-xs">
              {["7D", "12M"].map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={cn(
                    "px-3 py-1 rounded-md transition",
                    range === r
                      ? "bg-emerald-500 text-black font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          }
        >
          {range === "7D"
            ? renderTrend(trend7d, RevenueBarChart)
            : renderTrend({ ...trend12m, data: filteredTrend12m }, RevenueAreaChart)}
        </InsightCard>

        {/* Daily Snapshot — static narrative copy (Phase 11 candidate to replace with live anomaly feed) */}
        <div className="glass-card relative overflow-hidden p-5 bg-gradient-to-br from-violet-500/10 via-transparent to-transparent">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 ring-1 ring-violet-500/30">
              <Sparkles className="h-4 w-4 text-violet-300" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Daily Snapshot</h3>
              <p className="kpi-label">AI Recommended</p>
            </div>
          </div>

          <div className="mt-5">
            <p className="kpi-label text-emerald-400">Top Performing</p>
            <ul className="mt-2.5 space-y-2.5 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>
                  Electronics category increased by{" "}
                  <span className="font-semibold text-emerald-400">18%</span>{" "}
                  since Tuesday.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>
                  "Summer Glow" collection is{" "}
                  <span className="font-semibold text-emerald-400">94%</span>{" "}
                  sold out.
                </span>
              </li>
            </ul>
          </div>

          <div className="mt-5">
            <p className="kpi-label text-red-400">Risk Alert</p>
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <span>
                <span className="font-semibold">Customer churn risk</span> rising
                in mid-market segment.
              </span>
            </div>
          </div>

          <Link
            to="/ml-insights"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500/20 px-4 py-2.5 text-sm font-semibold text-violet-200 ring-1 ring-violet-500/30 hover:bg-violet-500/30 transition"
          >
            View Full Insight Report <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Recent Orders + Segments */}
      <div className="mt-6 grid gap-4 grid-cols-1 lg:grid-cols-3">
        <InsightCard
          title="Recent Orders"
          subtitle="Latest transactions across all channels"
          className="lg:col-span-2"
          action={
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search orders..."
                  className="h-8 w-44 rounded-lg border border-white/[0.06] bg-surface-1 pl-8 pr-7 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
                {orderSearch && (
                  <button onClick={() => setOrderSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <Link to="/sales" className="text-sm font-semibold text-emerald-400 hover:text-emerald-300 whitespace-nowrap">
                View All →
              </Link>
            </div>
          }
        >
          {orders.loading ? (
            <LoadingSkeleton variant="table" rows={6} columns={5} />
          ) : orders.error ? (
            <SectionError
              message="Couldn't load recent orders"
              error={orders.error}
              onRetry={orders.refetch}
            />
          ) : (
            <div className="overflow-x-auto">
              {orderSearch.trim() && (
                <p className="mb-2 text-xs text-muted-foreground">
                  {filteredOrders.length} result{filteredOrders.length !== 1 ? "s" : ""} for "{orderSearch}"
                </p>
              )}
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-3 py-3 text-left">Order ID</th>
                    <th className="px-3 py-3 text-left">Customer</th>
                    <th className="px-3 py-3 text-left">Status</th>
                    <th className="px-3 py-3 text-left">Date</th>
                    <th className="px-3 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="text-foreground">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                        No orders matching "{orderSearch}".
                      </td>
                    </tr>
                  ) : filteredOrders.map((o) => (
                    <tr key={o.rawId} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition">
                      <td className="px-3 py-3.5 font-mono text-xs text-muted-foreground">#{o.id}</td>
                      <td className="px-3 py-3.5 font-medium">{o.customer}</td>
                      <td className="px-3 py-3.5">
                        <span className={cn("pill", STATUS_PILL[o.status])}>{o.status}</span>
                      </td>
                      <td className="px-3 py-3.5 text-muted-foreground">{formatShortDate(o.date)}</td>
                      <td className="px-3 py-3.5 text-right font-semibold">
                        {formatCurrency(o.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </InsightCard>

        <InsightCard title="Customer Segments" subtitle="K-Means cluster distribution">
          {segments.loading ? (
            <LoadingSkeleton variant="chart" height={220} />
          ) : segments.error ? (
            <SectionError
              message="Couldn't load segments"
              error={segments.error}
              onRetry={segments.refetch}
            />
          ) : (
            <>
              <SegmentPieChart data={segments.data ?? []} />
              <ul className="mt-3 space-y-2 text-sm">
                {(segments.data ?? []).map((s) => (
                  <li key={s.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          background: {
                            VIP: "#10b981",
                            Loyal: "#60a5fa",
                            "At Risk": "#f87171",
                            New: "#a78bfa",
                          }[s.name],
                        }}
                      />
                      {s.name}
                    </span>
                    <span className="font-semibold">{s.value}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </InsightCard>
      </div>
    </DashboardLayout>
  );
}

/**
 * Tiny helper: render a chart with consistent loading/error states.
 * Kept inline so the page reads top-to-bottom without indirection.
 */
function renderTrend(query, ChartComponent) {
  if (query.loading) return <LoadingSkeleton variant="chart" height={280} />;
  if (query.error)
    return (
      <SectionError
        message="Couldn't load revenue trend"
        error={query.error}
        onRetry={query.refetch}
      />
    );
  return <ChartComponent data={query.data ?? []} />;
}
