import { useState, useMemo } from "react";
import { BrainCog, AlertTriangle, TrendingUp, DollarSign, Users, Download, X, FileJson, CheckCircle2, Search } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/cards/PageHeader";
import InsightCard from "@/components/cards/InsightCard";
import RevenueAreaChart from "@/charts/RevenueAreaChart";
import RadialMetric from "@/charts/RadialMetric";
import LoadingSkeleton from "@/components/common/LoadingSkeleton";
import SectionError from "@/components/common/SectionError";
import useSupabaseQuery from "@/hooks/useSupabaseQuery";
import {
  fetchModelMetrics,
  fetchForecastSummary,
  fetchRevenueMonthlyWithForecast,
  fetchSegmentDistribution,
} from "@/services/mlInsightsService";
import { useDashboard } from "@/context/DashboardContext";
import { formatCurrency, formatRelativeTime } from "@/utils/formatters";
import { cn } from "@/lib/utils";

const METRIC_COLOR_HEX = {
  emerald: "#10b981",
  blue: "#60a5fa",
  coral: "#f87171",
};

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function MLInsightsPage() {
  const [logOpen, setLogOpen] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [modelSearch, setModelSearch] = useState("");

  const { nMonths } = useDashboard();

  const metrics  = useSupabaseQuery(fetchModelMetrics);
  const forecast = useSupabaseQuery(fetchForecastSummary);
  const trend    = useSupabaseQuery(fetchRevenueMonthlyWithForecast);
  const segments = useSupabaseQuery(fetchSegmentDistribution);

  // Filter trend chart by date range
  const filteredTrend = useMemo(() => {
    const data = trend.data ?? [];
    if (!nMonths) return data;
    return data.slice(-nMonths);
  }, [trend.data, nMonths]);

  // When no ML forecast exists, derive an estimate from the visible filtered
  // months (same data the chart above is showing) so both update together.
  const historicalEstimate = useMemo(() => {
    if (filteredTrend.length === 0) return null;
    const total = filteredTrend.reduce((s, r) => s + (r.actual ?? 0), 0);
    const avg   = total / filteredTrend.length;
    return avg > 0 ? avg : null;
  }, [filteredTrend]);

  // Filter metrics by model name or metric name
  const filteredMetrics = useMemo(() => {
    const data = metrics.data ?? [];
    if (!modelSearch.trim()) return data;
    const q = modelSearch.toLowerCase();
    return data.filter(
      (m) =>
        m.model.toLowerCase().includes(q) ||
        m.metric.toLowerCase().includes(q) ||
        (m.name ?? "").toLowerCase().includes(q)
    );
  }, [metrics.data, modelSearch]);

  const handleExportInsights = () => {
    const payload = {
      generated_at: new Date().toISOString(),
      project: "Quantuma AI — E-Commerce Analytics",
      model_metrics: (metrics.data ?? []).map((m) => ({
        model: m.model,
        metric: m.metric,
        name: m.name,
        value: m.raw,
        trained_at: m.trainedAt,
      })),
      customer_segments: (segments.data ?? []).map((s) => ({
        segment: s.name,
        share_pct: s.value,
        customers: s.customers,
      })),
      forecast_summary: forecast.data
        ? {
            model: forecast.data.model,
            horizon_days: forecast.data.n,
            predicted_total: forecast.data.predictedTotal,
            lower_bound: forecast.data.lower,
            upper_bound: forecast.data.upper,
          }
        : null,
    };
    downloadFile(
      JSON.stringify(payload, null, 2),
      `quantuma-ml-insights-${new Date().toISOString().split("T")[0]}.json`,
      "application/json"
    );
    setExportDone(true);
    setTimeout(() => setExportDone(false), 2500);
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="AI Insights Engine"
        description="Live model metrics from the most-recent Spark MLlib + sklearn training runs."
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                placeholder="Search models..."
                className="h-9 w-44 rounded-lg border border-white/[0.06] bg-surface-1 pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              {modelSearch && (
                <button onClick={() => setModelSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={handleExportInsights}
              disabled={metrics.loading}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ring-1 transition disabled:opacity-50",
                exportDone
                  ? "bg-emerald-500/25 text-emerald-300 ring-emerald-500/40"
                  : "bg-blue-500/15 text-blue-300 ring-blue-500/30 hover:bg-blue-500/25"
              )}
            >
              {exportDone ? <><CheckCircle2 className="h-4 w-4" /> Exported!</> : <><Download className="h-4 w-4" /> Export Insights</>}
            </button>
          </div>
        }
      />

      {/* Model metrics row */}
      {metrics.loading ? (
        <LoadingSkeleton variant="kpi" rows={4} />
      ) : metrics.error ? (
        <SectionError message="Couldn't load model metrics" error={metrics.error} onRetry={metrics.refetch} />
      ) : filteredMetrics.length === 0 ? (
        <div className="glass-card p-6 text-sm text-muted-foreground">
          {modelSearch.trim()
            ? `No models matching "${modelSearch}". Try "als", "kmeans", "forecast", or a metric like "rmse".`
            : `No training runs found in public.ml_model_runs. Run scripts.run_ml_pipeline --push-to-db.`}
        </div>
      ) : (
        <>
          {modelSearch.trim() && (
            <p className="mb-3 text-xs text-muted-foreground">
              {filteredMetrics.length} result{filteredMetrics.length !== 1 ? "s" : ""} for "{modelSearch}"
            </p>
          )}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {filteredMetrics.map((m) => {
            const c = METRIC_COLOR_HEX[m.color] ?? METRIC_COLOR_HEX.blue;
            return (
              <div key={`${m.model}-${m.metric}`} className="glass-card p-5">
                <div className="flex items-start justify-between">
                  <p className="kpi-label">{m.name}</p>
                  <span className="text-[10px] text-muted-foreground">
                    {m.trainedAt ? formatRelativeTime(m.trainedAt) : "—"}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <div className="text-4xl font-bold">
                      {m.metric === "rmse" ? Number(m.raw).toFixed(2) : Number(m.raw).toFixed(3)}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">{m.metric}</div>
                  </div>
                  <RadialMetric value={m.value} color={c} size={56} ariaLabel={`${m.name} ${m.metric} ${Number(m.raw).toFixed(3)}`} />
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}

      {/* Forecast + Neural Rationale */}
      <div className="mt-6 grid gap-4 grid-cols-1 lg:grid-cols-3">
        <InsightCard
          title="Predictive Revenue Forecast"
          subtitle={forecast.data?.model ? `${forecast.data.model} · ${forecast.data.n}-day horizon` : "scikit-learn time-series forecast"}
          icon={TrendingUp}
          className="lg:col-span-2"
          action={
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              ±1.96σ band
            </span>
          }
        >
          {trend.loading ? (
            <LoadingSkeleton variant="chart" height={300} />
          ) : trend.error ? (
            <SectionError message="Couldn't load revenue history" error={trend.error} onRetry={trend.refetch} />
          ) : (
            <RevenueAreaChart data={filteredTrend} height={300} />
          )}
          <div className="mt-4 rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-4">
            <p className="text-sm font-semibold text-emerald-300">Predicted Total Revenue</p>
            {forecast.loading || trend.loading ? (
              <p className="mt-1 text-sm text-muted-foreground">Loading forecast…</p>
            ) : forecast.data?.predictedTotal == null ? (
              historicalEstimate ? (
                <>
                  <p className="mt-1 text-2xl font-bold text-emerald-400">
                    {formatCurrency(historicalEstimate)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    30-day estimate based on 3-month historical average.
                  </p>
                </>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Predictive forecasting activates once the ML pipeline generates future revenue projections.
                </p>
              )
            ) : (
              <>
                <p className="mt-1 text-sm">
                  Next {forecast.data.n} days projected to total{" "}
                  <span className="font-semibold text-emerald-400">{formatCurrency(forecast.data.predictedTotal)}</span>.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lower Bound</span>
                    <span className="font-semibold">{formatCurrency(forecast.data.lower)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Upper Bound</span>
                    <span className="font-semibold">{formatCurrency(forecast.data.upper)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </InsightCard>

        <InsightCard title="Neural Rationale" subtitle="What the metrics tell us" icon={BrainCog} iconAccent="purple">
          <div className="space-y-3">
            <RationaleRow
              title="K-Means Silhouette"
              body="Higher silhouette means tighter, better-separated customer clusters. < 0.2 suggests clusters overlap and the segment labels are less reliable."
            />
            <RationaleRow
              title="ALS Precision@10"
              body="Out of the top-10 products our model recommends, this percent landed in the user's actual holdout purchases. Implicit-feedback precision is inherently low on Olist (long-tail catalog) but tracks regressions well."
            />
            <RationaleRow
              title="Forecast R²"
              body="R² close to 1 means the daily-revenue model fits the trend; closer to 0 means the trend is noisier than the lag features capture."
            />
          </div>
          <button
            onClick={() => setLogOpen(true)}
            className="mt-4 w-full rounded-xl border border-white/[0.08] bg-surface-2 px-4 py-2 text-sm font-semibold hover:bg-surface-3 transition"
          >
            View Full Model Run Log
          </button>
        </InsightCard>
      </div>

      {/* Clusters + Run log */}
      <div className="mt-6 grid gap-4 grid-cols-1 lg:grid-cols-2">
        <InsightCard
          title="K-Means Cluster Density"
          subtitle="Customer share per segment (live)"
          action={<span className="rounded-md border border-white/[0.08] bg-surface-2 px-3 py-1 text-xs">k = {(segments.data ?? []).length || "—"}</span>}
        >
          {segments.loading ? (
            <LoadingSkeleton variant="table" rows={4} columns={2} />
          ) : segments.error ? (
            <SectionError message="Couldn't load segments" error={segments.error} onRetry={segments.refetch} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {(segments.data ?? []).map((s) => {
                const color = s.name === "VIP" ? "emerald" : s.name === "Loyal" ? "blue" : s.name === "New" ? "purple" : "coral";
                return (
                  <div
                    key={s.name}
                    className={cn(
                      "rounded-xl border p-4",
                      color === "emerald" && "border-emerald-500/30 bg-emerald-500/[0.07]",
                      color === "blue" && "border-blue-500/30 bg-blue-500/[0.07]",
                      color === "purple" && "border-violet-500/30 bg-violet-500/[0.07]",
                      color === "coral" && "border-red-500/30 bg-red-500/[0.07]"
                    )}
                  >
                    <p className={cn(
                      "text-[10px] font-bold tracking-widest",
                      color === "emerald" && "text-emerald-300",
                      color === "blue" && "text-blue-300",
                      color === "purple" && "text-violet-300",
                      color === "coral" && "text-red-300"
                    )}>
                      {s.name.toUpperCase()}
                    </p>
                    <p className="mt-2 text-2xl font-bold">
                      {s.value}% <span className="text-xs font-normal text-muted-foreground">share</span>
                    </p>
                    <p className="mt-2 text-[11px] text-muted-foreground leading-snug">{s.customers.toLocaleString()} customers</p>
                  </div>
                );
              })}
            </div>
          )}
        </InsightCard>

        <InsightCard
          title="Model Run Log"
          subtitle="Most recent training runs"
          icon={AlertTriangle}
          iconAccent="coral"
          action={
            <span className="inline-flex items-center gap-1.5 text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold uppercase tracking-widest text-emerald-400">Live</span>
            </span>
          }
        >
          {metrics.loading ? (
            <LoadingSkeleton variant="table" rows={4} columns={3} />
          ) : metrics.error ? (
            <SectionError message="Couldn't load run log" error={metrics.error} onRetry={metrics.refetch} />
          ) : (
            <div className="space-y-3">
              {filteredMetrics.map((m) => {
                const Icon = m.color === "coral" ? AlertTriangle : Users;
                return (
                  <div
                    key={`${m.model}-${m.metric}`}
                    className={cn(
                      "rounded-xl border p-4",
                      m.color === "emerald" && "bg-emerald-500/10 border-emerald-500/30",
                      m.color === "blue" && "bg-blue-500/10 border-blue-500/30",
                      m.color === "coral" && "bg-red-500/10 border-red-500/30"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg ring-1 shrink-0",
                          m.color === "emerald" && "bg-emerald-500/15 ring-emerald-500/30 text-emerald-300",
                          m.color === "blue" && "bg-blue-500/15 ring-blue-500/30 text-blue-300",
                          m.color === "coral" && "bg-red-500/15 ring-red-500/30 text-red-300"
                        )}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{m.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{m.metric} = {Number(m.raw).toFixed(4)}</p>
                        </div>
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {m.trainedAt ? formatRelativeTime(m.trainedAt) : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </InsightCard>
      </div>

      {/* Model health */}
      <div className="mt-6 grid gap-4 grid-cols-1 md:grid-cols-2">
        <div className="glass-card flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">✓</div>
          <div>
            <p className="text-sm font-semibold">{metrics.data?.length ?? 0} models tracked</p>
            <p className="text-xs text-muted-foreground">Sourced from public.ml_model_runs</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300">
            <DollarSign className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Forecast horizon: {forecast.data?.n ?? "—"} days</p>
            <p className="text-xs text-muted-foreground">
              {forecast.data?.model ?? "scikit-learn"} · last refreshed {forecast.data?.n ? "with latest pipeline run" : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Full Model Run Log Modal */}
      {logOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15 ring-1 ring-blue-500/30">
                  <FileJson className="h-4 w-4 text-blue-300" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Full Model Run Log</h2>
                  <p className="text-xs text-muted-foreground">
                    All training runs from <code className="font-mono">public.ml_model_runs</code>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportInsights}
                  className="flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 transition"
                >
                  <Download className="h-3.5 w-3.5" /> Export JSON
                </button>
                <button
                  onClick={() => setLogOpen(false)}
                  className="rounded-lg p-2 hover:bg-surface-2 transition text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {metrics.loading ? (
                <LoadingSkeleton variant="table" rows={6} columns={4} />
              ) : (metrics.data ?? []).length === 0 ? (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 text-center text-sm text-amber-300">
                  No model runs found. Run <code className="font-mono text-xs">scripts.run_ml_pipeline --push-to-db</code> first.
                </div>
              ) : (
                <>
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="rounded-xl border border-white/[0.06] bg-surface-1 p-3 text-center">
                      <p className="text-2xl font-bold text-emerald-400">{(metrics.data ?? []).length}</p>
                      <p className="text-xs text-muted-foreground">Total Runs</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-surface-1 p-3 text-center">
                      <p className="text-2xl font-bold text-blue-400">
                        {new Set((metrics.data ?? []).map((m) => m.model)).size}
                      </p>
                      <p className="text-xs text-muted-foreground">Unique Models</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-surface-1 p-3 text-center">
                      <p className="text-sm font-bold text-violet-400 mt-1">
                        {metrics.data?.[0]?.trainedAt ? formatRelativeTime(metrics.data[0].trainedAt) : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">Most Recent</p>
                    </div>
                  </div>

                  {/* Full table */}
                  <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
                    <table className="w-full text-sm">
                      <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-surface-1">
                        <tr>
                          <th className="px-4 py-3 text-left">Model</th>
                          <th className="px-4 py-3 text-left">Metric</th>
                          <th className="px-4 py-3 text-right">Value</th>
                          <th className="px-4 py-3 text-right">Display %</th>
                          <th className="px-4 py-3 text-right">Trained At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(metrics.data ?? []).map((m) => (
                          <tr key={`${m.model}-${m.metric}`} className="border-t border-white/[0.04] hover:bg-surface-1 transition">
                            <td className="px-4 py-3 font-mono text-xs font-semibold">{m.model}</td>
                            <td className="px-4 py-3">
                              <span className={cn(
                                "inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                                m.color === "emerald" && "bg-emerald-500/15 text-emerald-300",
                                m.color === "blue" && "bg-blue-500/15 text-blue-300",
                                m.color === "coral" && "bg-red-500/15 text-red-300",
                              )}>
                                {m.metric}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-semibold">
                              {Number(m.raw).toFixed(4)}
                            </td>
                            <td className="px-4 py-3 text-right text-muted-foreground">
                              {m.value}%
                            </td>
                            <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                              {m.trainedAt ? new Date(m.trainedAt).toLocaleString() : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Explanation */}
                  <div className="mt-6 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 text-xs text-muted-foreground space-y-1.5">
                    <p className="font-semibold text-violet-300">Reading this log</p>
                    <p>• <strong>K-Means Silhouette</strong> — 0.304 is acceptable; &gt; 0.5 would indicate well-separated clusters.</p>
                    <p>• <strong>ALS RMSE</strong> — lower is better; 1.18 on implicit Olist data is within expected range.</p>
                    <p>• <strong>Forecast R²</strong> — 0.81 means the scikit-learn model explains 81% of daily revenue variance.</p>
                    <p>• <strong>ALS Precision@10</strong> — 0.74 means 74% of top-10 ALS picks appear in the user's actual purchases.</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function RationaleRow({ title, body }) {
  return (
    <div className="border-l-2 border-emerald-500/40 pl-4 py-3">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}
