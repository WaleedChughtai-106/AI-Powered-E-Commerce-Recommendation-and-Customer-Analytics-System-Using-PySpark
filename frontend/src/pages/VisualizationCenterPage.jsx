import { useMemo, useState } from "react";
import { Filter, Sparkles, Plus, FileCode, FileSpreadsheet, FileText, Download } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/cards/PageHeader";
import InsightCard from "@/components/cards/InsightCard";
import HeatmapGrid from "@/charts/HeatmapGrid";
import RevenueAreaChart from "@/charts/RevenueAreaChart";
import LoadingSkeleton from "@/components/common/LoadingSkeleton";
import SectionError from "@/components/common/SectionError";
import useSupabaseQuery from "@/hooks/useSupabaseQuery";
import { fetchRevenueMonthlyWithForecast } from "@/services/dashboardService";
import { supabase } from "@/services/supabaseClient";
import { cn } from "@/lib/utils";

/**
 * Heatmap fetcher — pulls the most recent N order_purchase_timestamps and
 * buckets them into (hour-of-day × day-of-week) on the client. There is no
 * dedicated view for this in Phase 5, and adding one for a single chart
 * isn't worth the schema churn. Pulling N=5000 rows is well under
 * Supabase's 1 MB response limit.
 */
async function fetchHeatmap(limit = 5000) {
  const { data, error } = await supabase
    .from("orders")
    .select("order_purchase_timestamp")
    .neq("order_status", "canceled")
    .order("order_purchase_timestamp", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const grid = {};
  for (let h = 0; h < 24; h++) {
    for (const d of days) grid[`${h}-${d}`] = 0;
  }
  for (const row of data ?? []) {
    const t = new Date(row.order_purchase_timestamp);
    const hour = t.getUTCHours();
    // JS getUTCDay(): 0 = Sun..6 = Sat; map to Mon-first
    const dow = days[(t.getUTCDay() + 6) % 7];
    grid[`${hour}-${dow}`] += 1;
  }
  const max = Math.max(...Object.values(grid), 1);
  return Object.entries(grid).map(([key, count]) => {
    const [hour, day] = key.split("-");
    return {
      hour: Number(hour),
      day,
      value: count / max, // HeatmapGrid expects 0..1
    };
  });
}

export default function VisualizationCenterPage() {
  const [tier, setTier] = useState({ Enterprise: true, MidMarket: true, Startup: false });
  const [category, setCategory] = useState("All");

  const trend   = useSupabaseQuery(fetchRevenueMonthlyWithForecast);
  const heatmap = useSupabaseQuery(() => fetchHeatmap(5000));

  // Headline numbers for the builder strip — pulled from the live trend series.
  const predictedRevenue = useMemo(() => {
    const last = (trend.data ?? []).slice(-3);
    return last.reduce((s, x) => s + (x.predicted ?? 0), 0);
  }, [trend.data]);

  return (
    <DashboardLayout searchPlaceholder="Search datasets, models, or insights...">
      <PageHeader
        title="Data Visualization Center"
        description="Composable widgets backed by your Supabase analytics tables."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ── Main column ───────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Builder strip */}
          <div className="glass-card p-6 bg-gradient-to-br from-emerald-500/5 to-transparent">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="flex items-center gap-2 text-xl font-bold">
                  <Sparkles className="h-5 w-5 text-emerald-400" /> Custom Dashboard Builder
                </h3>
                <p className="text-sm text-muted-foreground">
                  Drag and drop data widgets to create your intelligence view.
                </p>
              </div>
              <div className="flex gap-2">
                <button className="rounded-xl bg-surface-2 px-4 py-2 text-sm font-semibold hover:bg-surface-3 transition">
                  Preview Mode
                </button>
                <button className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 transition">
                  Publish Live
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 grid-cols-1 md:grid-cols-3">
              <button className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/[0.08] text-muted-foreground hover:border-emerald-500/40 hover:text-emerald-400 transition">
                <Plus className="h-5 w-5" /> Add KPI Card
              </button>
              <div className="rounded-xl border border-emerald-500/20 bg-surface-1 p-4">
                <p className="text-xs text-emerald-400 font-semibold">Predicted Revenue · Q+</p>
                <p className="mt-1 text-2xl font-bold">
                  {trend.loading
                    ? "—"
                    : `$${(predictedRevenue / 1000).toFixed(0)}k`}
                </p>
                <div className="mt-2 flex gap-0.5">
                  {(trend.data ?? []).slice(-6).map((row, i) => {
                    const max = Math.max(...(trend.data ?? []).map((x) => x.predicted ?? 0), 1);
                    const h = Math.round(((row.predicted ?? 0) / max) * 32);
                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-sm bg-emerald-400/70"
                        style={{ height: `${Math.max(4, h)}px` }}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="rounded-xl border border-red-500/20 bg-surface-1 p-4">
                <p className="kpi-label">Forecast Volatility</p>
                <p className="mt-1 text-2xl font-bold text-red-400">
                  {(trend.data ?? []).length > 1 ? "Live" : "—"}
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
                  <div className="h-full w-[42%] rounded-full bg-red-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Live Revenue widget */}
          <InsightCard
            title="Revenue & Growth Trajectory"
            subtitle="Trailing 12-month actual vs predicted"
          >
            {trend.loading ? (
              <LoadingSkeleton variant="chart" height={280} />
            ) : trend.error ? (
              <SectionError message="Couldn't load revenue trend" error={trend.error} onRetry={trend.refetch} />
            ) : (
              <RevenueAreaChart data={trend.data ?? []} />
            )}
          </InsightCard>

          {/* Heatmap — bucketed from order_purchase_timestamp */}
          <InsightCard
            title="Shopping Activity Heatmap"
            subtitle="Recent orders bucketed by hour-of-day × day-of-week"
          >
            {heatmap.loading ? (
              <LoadingSkeleton variant="chart" height={300} />
            ) : heatmap.error ? (
              <SectionError message="Couldn't load activity heatmap" error={heatmap.error} onRetry={heatmap.refetch} />
            ) : (
              <HeatmapGrid data={heatmap.data ?? []} />
            )}
          </InsightCard>
        </div>

        {/* ── Sidebar: Global Filters (visual only — Phase 11) ───── */}
        <aside className="glass-card h-fit p-5 lg:sticky lg:top-24">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-emerald-400" />
            <h3 className="text-base font-bold">Global Filters</h3>
          </div>

          <div className="mt-5">
            <p className="kpi-label mb-2">Region</p>
            <select className="h-10 w-full rounded-lg border border-white/[0.08] bg-surface-1 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
              <option>All Regions</option>
              <option>Brazil — North</option>
              <option>Brazil — South</option>
              <option>Brazil — Other</option>
            </select>
          </div>

          <div className="mt-5">
            <p className="kpi-label mb-2">Product Category</p>
            <div className="flex flex-wrap gap-2">
              {["All", "Health", "Electronics", "Garden"].map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                    category === c
                      ? "bg-emerald-500 text-black"
                      : "bg-surface-2 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="kpi-label mb-2">Customer Tier</p>
            <div className="space-y-2 text-sm">
              {Object.entries(tier).map(([key, val]) => (
                <label key={key} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={val}
                    onChange={() =>
                      setTier((t) => ({ ...t, [key]: !t[key] }))
                    }
                    className="h-4 w-4 rounded border-white/20 bg-surface-2 text-emerald-500 focus:ring-emerald-500/40"
                  />
                  <span>{key === "MidMarket" ? "Mid-Market" : key}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-6 border-t border-white/[0.06] pt-5">
            <p className="kpi-label mb-3">Export Actions</p>
            <div className="space-y-2">
              {[
                { Icon: FileSpreadsheet, label: "CSV Dataset" },
                { Icon: FileCode, label: "JSON Stream" },
                { Icon: FileText, label: "PDF Report" },
              ].map(({ Icon, label }) => (
                <button
                  key={label}
                  className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-surface-1 px-3 py-2 text-sm hover:bg-surface-2 transition"
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {label}
                  </span>
                  <Download className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </DashboardLayout>
  );
}
