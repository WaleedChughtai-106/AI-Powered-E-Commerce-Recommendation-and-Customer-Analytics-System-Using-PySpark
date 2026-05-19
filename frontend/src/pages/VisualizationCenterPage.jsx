import { useMemo, useState } from "react";

import {
  Filter, Sparkles, Plus, FileCode, FileSpreadsheet, FileText,
  Download, Eye, EyeOff, X, CheckCircle2, Search,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/cards/PageHeader";
import InsightCard from "@/components/cards/InsightCard";
import HeatmapGrid from "@/charts/HeatmapGrid";
import RevenueAreaChart from "@/charts/RevenueAreaChart";
import LoadingSkeleton from "@/components/common/LoadingSkeleton";
import SectionError from "@/components/common/SectionError";
import useSupabaseQuery from "@/hooks/useSupabaseQuery";
import { fetchRevenueMonthlyWithForecast, fetchKpiCards, fetchSegmentDistribution } from "@/services/dashboardService";
import { fetchCategoryPerformance } from "@/services/salesService";
import { useDashboard } from "@/context/DashboardContext";
import { supabase } from "@/services/supabaseClient";
import { formatCurrency } from "@/utils/formatters";
import { cn } from "@/lib/utils";

// ── Olist regional distribution (customer_state groupings, approximate %) ──
const REGION_WEIGHT = {
  "All Regions":        1.00,
  "Brazil — North":     0.08,
  "Brazil — South":     0.15,
  "Brazil — Southeast": 0.65,
};

const PRODUCT_CATEGORIES = ["All", "Health", "Electronics", "Furniture", "Sports", "Garden"];
const REGIONS_VIZ = Object.keys(REGION_WEIGHT);

const KPI_TYPES = [
  { id: "revenue",   label: "Total Revenue",      color: "emerald", icon: "💰", fmt: "currency" },
  { id: "orders",    label: "Total Orders",        color: "blue",    icon: "📦", fmt: "number"   },
  { id: "customers", label: "Active Customers",    color: "violet",  icon: "👥", fmt: "number"   },
  { id: "churn",     label: "At-Risk Customers",   color: "coral",   icon: "⚠️", fmt: "number"   },
  { id: "forecast",  label: "Predicted Revenue",   color: "emerald", icon: "📈", fmt: "currency" },
];

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
  for (let h = 0; h < 24; h++) for (const d of days) grid[`${h}-${d}`] = 0;
  for (const row of data ?? []) {
    const t = new Date(row.order_purchase_timestamp);
    const hour = t.getUTCHours();
    const dow = days[(t.getUTCDay() + 6) % 7];
    grid[`${hour}-${dow}`] += 1;
  }
  const max = Math.max(...Object.values(grid), 1);
  return Object.entries(grid).map(([key, count]) => {
    const [hour, day] = key.split("-");
    return { hour: Number(hour), day, value: count / max };
  });
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export default function VisualizationCenterPage() {
  const [tier, setTier] = useState({ Enterprise: true, MidMarket: true, Startup: false });
  const [category, setCategory]   = useState("All");
  const [region, setRegion]       = useState("All Regions");
  const [vizSearch, setVizSearch] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [addKpiOpen, setAddKpiOpen]   = useState(false);
  const [customKpis, setCustomKpis]   = useState([]);
  const [exportFeedback, setExportFeedback] = useState("");

  // ── Date range from global context ──────────────────────────────────
  const { dateFrom, dateTo } = useDashboard();

  // ── Data fetches ─────────────────────────────────────────────────────
  const trend      = useSupabaseQuery(fetchRevenueMonthlyWithForecast);
  const heatmap    = useSupabaseQuery(() => fetchHeatmap(5000));
  const categories = useSupabaseQuery(() => fetchCategoryPerformance(20));
  const kpis       = useSupabaseQuery(fetchKpiCards);
  const segments   = useSupabaseQuery(fetchSegmentDistribution);

  // ── Filtered trend (responds to date range + category + region) ──────
  // MUST be declared before kpiValueMap (which reads filteredTrend).
  const filteredTrend = useMemo(() => {
    let data = trend.data ?? [];
    if (!data.length) return data;

    // 1. Date range filter — compare YYYY-MM so a month whose 1st falls before
    //    the cutoff is still included (e.g. "Last 30 Days" keeps September even
    //    though "2018-09-01" < "2018-09-17").
    if (dateFrom) {
      const ymFrom = dateFrom.slice(0, 7); // "YYYY-MM"
      const ymTo   = dateTo.slice(0, 7);
      data = data.filter((r) => {
        const ym = (r.monthDate ?? "").slice(0, 7);
        return ym >= ymFrom && ym <= ymTo;
      });
    }

    // 2. Category scale: use selected category's share of total category revenue
    let catScale = 1;
    if (category !== "All" && (categories.data ?? []).length > 0) {
      const totalRev = categories.data.reduce((s, c) => s + c.revenue, 0);
      const cat = categories.data.find((c) => c.category === category);
      if (cat && totalRev > 0) catScale = cat.revenue / totalRev;
    }

    // 3. Region scale
    const regionScale = REGION_WEIGHT[region] ?? 1;
    const scale = catScale * regionScale;

    if (scale === 1) return data;
    return data.map((row) => ({
      ...row,
      actual:    (row.actual    ?? 0) * scale,
      predicted: (row.predicted ?? 0) * scale,
    }));
  }, [trend.data, dateFrom, dateTo, category, categories.data, region]);

  // ── KPI value map for custom cards ───────────────────────────────────
  // When a date range is active, derive values from filteredTrend;
  // otherwise fall back to the static v_kpi_summary values.
  const kpiValueMap = useMemo(() => {
    const byKey  = Object.fromEntries((kpis.data ?? []).map((k) => [k.key, k]));
    const atRisk = (segments.data ?? []).find((s) => s.name?.toLowerCase().includes("risk"));

    if (dateFrom && filteredTrend.length > 0) {
      const revenue   = filteredTrend.reduce((s, r) => s + (r.actual ?? 0), 0);
      const ordersSum = filteredTrend.reduce((s, r) => s + (r.orderCount ?? 0), 0);
      const customers = Math.max(...filteredTrend.map((r) => r.customerCount ?? 0));
      const forecast  = filteredTrend.slice(-3).reduce((s, r) => s + (r.predicted ?? 0), 0);
      return {
        revenue,
        orders:    ordersSum,
        customers,
        churn:     atRisk?.customers ?? 0,
        forecast,
      };
    }

    const predictedRevenue = (trend.data ?? []).slice(-3).reduce((s, x) => s + (x.predicted ?? 0), 0);
    return {
      revenue:   byKey.revenue?.value ?? 0,
      orders:    byKey.orders?.value  ?? 0,
      customers: byKey.active?.value  ?? 0,
      churn:     atRisk?.customers    ?? 0,
      forecast:  predictedRevenue,
    };
  }, [kpis.data, segments.data, filteredTrend, trend.data, dateFrom]);

  const filteredCategories = useMemo(() => {
    let data = categories.data ?? [];
    if (category !== "All") data = data.filter((c) => c.category === category);
    if (vizSearch.trim()) {
      const q = vizSearch.toLowerCase();
      data = data.filter((c) => c.category.toLowerCase().includes(q));
    }
    return data;
  }, [categories.data, category, vizSearch]);

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleAddKpi = (kpi) => {
    if (customKpis.find((k) => k.id === kpi.id)) return;
    setCustomKpis((prev) => [...prev, kpi]);
    setAddKpiOpen(false);
  };
  const removeKpi = (id) => setCustomKpis((prev) => prev.filter((k) => k.id !== id));

  const triggerFeedback = (label) => {
    setExportFeedback(label);
    setTimeout(() => setExportFeedback(""), 2500);
  };

  const handleExportCSV = () => {
    const data = filteredTrend;
    if (!data.length) return;
    const rows = [
      ["Month", "Revenue", "Predicted"],
      ...data.map((d) => [
        d.month ?? d.date ?? "",
        Math.round(d.actual ?? d.revenue ?? 0),
        d.predicted ? Math.round(d.predicted) : "",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    downloadFile(csv, `quantuma-revenue-${new Date().toISOString().split("T")[0]}.csv`, "text/csv;charset=utf-8;");
    triggerFeedback("CSV downloaded!");
  };

  const handleExportJSON = () => {
    const payload = {
      generated_at: new Date().toISOString(),
      filters: { region, category, tier },
      kpi_summary: kpis.data ?? [],
      revenue_trend: filteredTrend,
      category_performance: filteredCategories,
    };
    downloadFile(
      JSON.stringify(payload, null, 2),
      `quantuma-analytics-${new Date().toISOString().split("T")[0]}.json`,
      "application/json"
    );
    triggerFeedback("JSON downloaded!");
  };

  const handleExportPDF = () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Quantuma AI — Analytics Report</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; color: #111; }
    h1 { color: #10b981; } h2 { margin-top: 32px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f3f4f6; font-size: 12px; text-transform: uppercase; }
    .meta { color: #6b7280; font-size: 12px; margin-bottom: 24px; }
  </style>
</head>
<body>
  <h1>Quantuma AI — Analytics Report</h1>
  <p class="meta">Generated: ${new Date().toLocaleString()} · Region: ${region} · Category: ${category}</p>
  <h2>Revenue Trend (12 months)</h2>
  <table>
    <thead><tr><th>Month</th><th>Revenue</th><th>Predicted</th></tr></thead>
    <tbody>
      ${filteredTrend.map((d) =>
        `<tr><td>${d.month ?? ""}</td><td>$${Math.round(d.actual ?? d.revenue ?? 0).toLocaleString()}</td><td>${d.predicted ? "$" + Math.round(d.predicted).toLocaleString() : "—"}</td></tr>`
      ).join("")}
    </tbody>
  </table>
  <h2>Category Performance</h2>
  <table>
    <thead><tr><th>Category</th><th>Revenue</th><th>Review Score</th></tr></thead>
    <tbody>
      ${filteredCategories.slice(0, 12).map((c) =>
        `<tr><td>${c.category}</td><td>$${Number(c.revenue ?? 0).toLocaleString()}</td><td>${c.reviewScore?.toFixed(2) ?? "—"}</td></tr>`
      ).join("")}
    </tbody>
  </table>
  <p style="margin-top:40px;color:#6b7280;font-size:11px">Quantuma AI — Enterprise Analytics · ${new Date().getFullYear()}</p>
</body>
</html>`;
    const win = window.open("", "_blank");
    win.document.write(html); win.document.close(); win.focus();
    setTimeout(() => win.print(), 500);
    triggerFeedback("PDF ready — print dialog opened!");
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <PageHeader
        title="Data Visualization Center"
        description="Composable widgets backed by your Supabase analytics tables."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ── Main column ───────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Dashboard Builder */}
          <div className={cn(
            "glass-card p-6 transition",
            previewMode
              ? "bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/30"
              : "bg-gradient-to-br from-emerald-500/5 to-transparent"
          )}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="flex items-center gap-2 text-xl font-bold">
                  <Sparkles className="h-5 w-5 text-emerald-400" /> Custom Dashboard Builder
                  {previewMode && (
                    <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
                      PREVIEW
                    </span>
                  )}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {previewMode
                    ? "Read-only preview of your dashboard layout."
                    : "Drag and drop data widgets to create your intelligence view."}
                </p>
              </div>
              <button
                onClick={() => setPreviewMode((m) => !m)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
                  previewMode
                    ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30 hover:bg-emerald-500/30"
                    : "bg-surface-2 hover:bg-surface-3"
                )}
              >
                {previewMode
                  ? <><EyeOff className="h-4 w-4" /> Exit Preview</>
                  : <><Eye className="h-4 w-4" /> Preview Mode</>}
              </button>
            </div>

            <div className="mt-6 grid gap-4 grid-cols-1 md:grid-cols-3">
              {/* Add KPI button — edit mode only */}
              {!previewMode && (
                <button
                  onClick={() => setAddKpiOpen(true)}
                  className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/[0.08] text-muted-foreground hover:border-emerald-500/40 hover:text-emerald-400 transition"
                >
                  <Plus className="h-5 w-5" /> Add KPI Card
                </button>
              )}

              {/* Predicted Revenue */}
              <div className="rounded-xl border border-emerald-500/20 bg-surface-1 p-4">
                <p className="text-xs text-emerald-400 font-semibold">Predicted Revenue · Q+</p>
                <p className="mt-1 text-2xl font-bold">
                  {trend.loading ? "—" : `$${(kpiValueMap.forecast / 1000).toFixed(0)}k`}
                </p>
                <div className="mt-2 flex gap-0.5">
                  {(trend.data ?? []).slice(-6).map((row, i) => {
                    const max = Math.max(...(trend.data ?? []).map((x) => x.predicted ?? 0), 1);
                    const h = Math.round(((row.predicted ?? 0) / max) * 32);
                    return (
                      <div key={i} className="flex-1 rounded-sm bg-emerald-400/70" style={{ height: `${Math.max(4, h)}px` }} />
                    );
                  })}
                </div>
              </div>

              {/* Forecast Volatility */}
              <div className="rounded-xl border border-red-500/20 bg-surface-1 p-4">
                <p className="kpi-label">Forecast Volatility</p>
                <p className="mt-1 text-2xl font-bold text-red-400">
                  {(trend.data ?? []).length > 1 ? "Live" : "—"}
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
                  <div className="h-full w-[42%] rounded-full bg-red-400" />
                </div>
              </div>

              {/* Custom KPI cards — with real data */}
              {customKpis.map((kpi) => {
                const raw = kpiValueMap[kpi.id] ?? 0;
                const isLoading = kpis.loading || segments.loading || trend.loading;
                const display = isLoading
                  ? "—"
                  : kpi.fmt === "currency"
                    ? formatCurrency(raw)
                    : raw.toLocaleString();

                return (
                  <div
                    key={kpi.id}
                    className={cn(
                      "rounded-xl border p-4 relative",
                      kpi.color === "emerald" && "border-emerald-500/20 bg-surface-1",
                      kpi.color === "blue"    && "border-blue-500/20 bg-surface-1",
                      kpi.color === "violet"  && "border-violet-500/20 bg-surface-1",
                      kpi.color === "coral"   && "border-red-500/20 bg-surface-1",
                    )}
                  >
                    {!previewMode && (
                      <button
                        onClick={() => removeKpi(kpi.id)}
                        className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <p className="text-xs text-muted-foreground font-semibold">
                      {kpi.icon} {kpi.label}
                    </p>
                    <p className={cn(
                      "mt-1 text-2xl font-bold",
                      isLoading && "text-muted-foreground"
                    )}>
                      {display}
                    </p>
                    <p className={cn(
                      "mt-1 text-xs",
                      kpi.color === "emerald" ? "text-emerald-400" :
                      kpi.color === "blue"    ? "text-blue-400"    :
                      kpi.color === "violet"  ? "text-violet-400"  :
                                                "text-red-400"
                    )}>
                      {isLoading ? "Loading…" : "Live from Supabase"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Revenue & Growth Trajectory — responds to filters */}
          <InsightCard
            title="Revenue & Growth Trajectory"
            subtitle={`Trailing 12-month actual vs predicted${category !== "All" ? ` · ${category}` : ""}${region !== "All Regions" ? ` · ${region}` : ""}`}
          >
            {trend.loading || categories.loading ? (
              <LoadingSkeleton variant="chart" height={280} />
            ) : trend.error ? (
              <SectionError message="Couldn't load revenue trend" error={trend.error} onRetry={trend.refetch} />
            ) : (
              <RevenueAreaChart data={filteredTrend} />
            )}
          </InsightCard>

          {/* Shopping Activity Heatmap */}
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

        {/* ── Global Filters sidebar ─────────────────────────────────── */}
        <aside className="glass-card h-fit p-5 lg:sticky lg:top-24">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-emerald-400" />
            <h3 className="text-base font-bold">Global Filters</h3>
          </div>

          {/* Category search */}
          <div className="mt-4 relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={vizSearch}
              onChange={(e) => setVizSearch(e.target.value)}
              placeholder="Search categories..."
              className="h-9 w-full rounded-lg border border-white/[0.06] bg-surface-1 pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
            {vizSearch && (
              <button onClick={() => setVizSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Region */}
          <div className="mt-5">
            <p className="kpi-label mb-2">Region</p>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="h-10 w-full rounded-lg border border-white/[0.08] bg-surface-1 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              {REGIONS_VIZ.map((r) => <option key={r}>{r}</option>)}
            </select>
            {region !== "All Regions" && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Showing ~{Math.round((REGION_WEIGHT[region] ?? 1) * 100)}% of total revenue
              </p>
            )}
          </div>

          {/* Product Category */}
          <div className="mt-5">
            <p className="kpi-label mb-2">Product Category</p>
            <div className="flex flex-wrap gap-2">
              {PRODUCT_CATEGORIES.map((c) => (
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
            {category !== "All" && (categories.data ?? []).length > 0 && (() => {
              const totalRev = (categories.data ?? []).reduce((s, c) => s + c.revenue, 0);
              const cat = (categories.data ?? []).find((c) => c.category === category);
              if (!cat || !totalRev) return null;
              return (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {category}: {formatCurrency(cat.revenue)} ({Math.round(cat.revenue / totalRev * 100)}% of total)
                </p>
              );
            })()}
          </div>

          {/* Customer Tier */}
          <div className="mt-5">
            <p className="kpi-label mb-2">Customer Tier</p>
            <div className="space-y-2 text-sm">
              {Object.entries(tier).map(([key, val]) => (
                <label key={key} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={val}
                    onChange={() => setTier((t) => ({ ...t, [key]: !t[key] }))}
                    className="h-4 w-4 rounded border-white/20 bg-surface-2 text-emerald-500 focus:ring-emerald-500/40"
                  />
                  <span>{key === "MidMarket" ? "Mid-Market" : key}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Active filter summary */}
          {(region !== "All Regions" || category !== "All") && (
            <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300">
              Filters active:{" "}
              {[region !== "All Regions" && region, category !== "All" && category]
                .filter(Boolean)
                .join(", ")}
            </div>
          )}

          {/* Export Actions */}
          <div className="mt-6 border-t border-white/[0.06] pt-5">
            <p className="kpi-label mb-3">Export Actions</p>
            {exportFeedback && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" /> {exportFeedback}
              </div>
            )}
            <div className="space-y-2">
              <button
                onClick={handleExportCSV}
                disabled={trend.loading || !filteredTrend.length}
                className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-surface-1 px-3 py-2 text-sm hover:bg-surface-2 transition disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" /> CSV Dataset
                </span>
                <Download className="h-4 w-4 text-muted-foreground" />
              </button>

              <button
                onClick={handleExportJSON}
                disabled={trend.loading}
                className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-surface-1 px-3 py-2 text-sm hover:bg-surface-2 transition disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-muted-foreground" /> JSON Stream
                </span>
                <Download className="h-4 w-4 text-muted-foreground" />
              </button>

              <button
                onClick={handleExportPDF}
                disabled={trend.loading}
                className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-surface-1 px-3 py-2 text-sm hover:bg-surface-2 transition disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" /> PDF Report
                </span>
                <Download className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* ── Add KPI Modal ─────────────────────────────────────────────── */}
      {addKpiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
              <div>
                <h2 className="text-lg font-bold">Add KPI Card</h2>
                <p className="text-xs text-muted-foreground">Choose a metric to add to your dashboard</p>
              </div>
              <button
                onClick={() => setAddKpiOpen(false)}
                className="rounded-lg p-2 hover:bg-surface-2 text-muted-foreground hover:text-foreground transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-2">
              {KPI_TYPES.filter((k) => !customKpis.find((c) => c.id === k.id)).map((kpi) => {
                const raw = kpiValueMap[kpi.id] ?? 0;
                const preview = kpis.loading || segments.loading || trend.loading
                  ? "Loading…"
                  : kpi.fmt === "currency"
                    ? formatCurrency(raw)
                    : raw.toLocaleString();
                return (
                  <button
                    key={kpi.id}
                    onClick={() => handleAddKpi(kpi)}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-surface-1 p-4 text-left hover:border-emerald-500/30 hover:bg-surface-2 transition"
                  >
                    <span className="text-2xl">{kpi.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{kpi.label}</p>
                      <p className="text-xs text-muted-foreground">Current value: <span className="text-emerald-400 font-semibold">{preview}</span></p>
                    </div>
                  </button>
                );
              })}
              {KPI_TYPES.every((k) => customKpis.find((c) => c.id === k.id)) && (
                <p className="text-sm text-muted-foreground text-center py-4">All available KPI cards have been added.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
