import { BrainCog, AlertTriangle, TrendingUp, DollarSign, Users, Rocket } from "lucide-react";
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
import { formatCurrency, formatRelativeTime } from "@/utils/formatters";
import { cn } from "@/lib/utils";

const METRIC_COLOR_HEX = {
  emerald: "#10b981",
  blue: "#60a5fa",
  coral: "#f87171",
};

export default function MLInsightsPage() {
  const metrics  = useSupabaseQuery(fetchModelMetrics);
  const forecast = useSupabaseQuery(fetchForecastSummary);
  const trend    = useSupabaseQuery(fetchRevenueMonthlyWithForecast);
  const segments = useSupabaseQuery(fetchSegmentDistribution);

  return (
    <DashboardLayout searchPlaceholder="Search insights, models, or data points...">
      <PageHeader
        title="AI Insights Engine"
        description="Live model metrics from the most-recent Spark MLlib + sklearn training runs."
        actions={
          <>
            <button className="rounded-xl border border-white/[0.08] bg-surface-2 px-4 py-2 text-sm font-semibold hover:bg-surface-3 transition">
              ↻ Retrain Models
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 transition">
              <Rocket className="h-4 w-4" /> Deploy Live
            </button>
          </>
        }
      />

      {/* Model metrics row — from v_ml_model_latest */}
      {metrics.loading ? (
        <LoadingSkeleton variant="kpi" rows={4} />
      ) : metrics.error ? (
        <SectionError message="Couldn't load model metrics" error={metrics.error} onRetry={metrics.refetch} />
      ) : (metrics.data ?? []).length === 0 ? (
        <div className="glass-card p-6 text-sm text-muted-foreground">
          No training runs found in <code className="font-mono text-xs">public.ml_model_runs</code>.
          Run <code className="font-mono text-xs">scripts.run_ml_pipeline --push-to-db</code>.
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {(metrics.data ?? []).map((m) => {
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
                      {m.metric === "rmse"
                        ? Number(m.raw).toFixed(2)
                        : Number(m.raw).toFixed(3)}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                      {m.metric}
                    </div>
                  </div>
                  <RadialMetric
                    value={m.value}
                    color={c}
                    size={56}
                    ariaLabel={`${m.name} ${m.metric} ${Number(m.raw).toFixed(3)}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Forecast + Neural Rationale */}
      <div className="mt-6 grid gap-4 grid-cols-1 lg:grid-cols-3">
        <InsightCard
          title="Predictive Revenue Forecast"
          subtitle={
            forecast.data?.model
              ? `${forecast.data.model} · ${forecast.data.n}-day horizon`
              : "scikit-learn time-series forecast"
          }
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
            <RevenueAreaChart data={trend.data ?? []} height={300} />
          )}
          <div className="mt-4 rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-4">
            <p className="text-sm font-semibold text-emerald-300">Predicted Total Revenue</p>
            {forecast.loading ? (
              <p className="mt-1 text-sm text-muted-foreground">Loading forecast…</p>
            ) : forecast.error ? (
              <p className="mt-1 text-xs text-red-300">Couldn't load forecast bounds.</p>
            ) : forecast.data?.predictedTotal == null ? (
              <p className="mt-1 text-xs text-muted-foreground">
                No forecast rows yet. Run the pipeline with the forecast step enabled.
              </p>
            ) : (
              <>
                <p className="mt-1 text-sm">
                  Next {forecast.data.n} days projected to total{" "}
                  <span className="font-semibold text-emerald-400">
                    {formatCurrency(forecast.data.predictedTotal)}
                  </span>
                  .
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

        <InsightCard
          title="Neural Rationale"
          subtitle="What the metrics tell us"
          icon={BrainCog}
          iconAccent="purple"
        >
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
          <button className="mt-4 w-full rounded-xl border border-white/[0.08] bg-surface-2 px-4 py-2 text-sm font-semibold hover:bg-surface-3 transition">
            View Full Model Run Log
          </button>
        </InsightCard>
      </div>

      {/* Clusters (live) + Run health */}
      <div className="mt-6 grid gap-4 grid-cols-1 lg:grid-cols-2">
        <InsightCard
          title="K-Means Cluster Density"
          subtitle="Customer share per segment (live)"
          action={
            <span className="rounded-md border border-white/[0.08] bg-surface-2 px-3 py-1 text-xs">
              k = {(segments.data ?? []).length || "—"}
            </span>
          }
        >
          {segments.loading ? (
            <LoadingSkeleton variant="table" rows={4} columns={2} />
          ) : segments.error ? (
            <SectionError message="Couldn't load segments" error={segments.error} onRetry={segments.refetch} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {(segments.data ?? []).map((s) => {
                const color =
                  s.name === "VIP" ? "emerald"
                  : s.name === "Loyal" ? "blue"
                  : s.name === "New" ? "purple"
                  : "coral";
                return (
                  <div
                    key={s.name}
                    className={cn(
                      "rounded-xl border p-4",
                      color === "emerald" && "border-emerald-500/30 bg-emerald-500/[0.07]",
                      color === "blue"    && "border-blue-500/30 bg-blue-500/[0.07]",
                      color === "purple"  && "border-violet-500/30 bg-violet-500/[0.07]",
                      color === "coral"   && "border-red-500/30 bg-red-500/[0.07]"
                    )}
                  >
                    <p className={cn(
                      "text-[10px] font-bold tracking-widest",
                      color === "emerald" && "text-emerald-300",
                      color === "blue"    && "text-blue-300",
                      color === "purple"  && "text-violet-300",
                      color === "coral"   && "text-red-300"
                    )}>
                      {s.name.toUpperCase()}
                    </p>
                    <p className="mt-2 text-2xl font-bold">
                      {s.value}% <span className="text-xs font-normal text-muted-foreground">share</span>
                    </p>
                    <p className="mt-2 text-[11px] text-muted-foreground leading-snug">
                      {s.customers.toLocaleString()} customers
                    </p>
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
              {(metrics.data ?? []).map((m) => {
                const Icon = m.color === "coral" ? AlertTriangle : Users;
                return (
                  <div
                    key={`${m.model}-${m.metric}`}
                    className={cn(
                      "rounded-xl border p-4",
                      m.color === "emerald" && "bg-emerald-500/10 border-emerald-500/30",
                      m.color === "blue"    && "bg-blue-500/10 border-blue-500/30",
                      m.color === "coral"   && "bg-red-500/10 border-red-500/30"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg ring-1 shrink-0",
                          m.color === "emerald" && "bg-emerald-500/15 ring-emerald-500/30 text-emerald-300",
                          m.color === "blue"    && "bg-blue-500/15 ring-blue-500/30 text-blue-300",
                          m.color === "coral"   && "bg-red-500/15 ring-red-500/30 text-red-300"
                        )}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{m.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {m.metric} = {Number(m.raw).toFixed(4)}
                          </p>
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

      {/* Model health bar */}
      <div className="mt-6 grid gap-4 grid-cols-1 md:grid-cols-2">
        <div className="glass-card flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
            ✓
          </div>
          <div>
            <p className="text-sm font-semibold">
              {metrics.data?.length ?? 0} models tracked
            </p>
            <p className="text-xs text-muted-foreground">
              Sourced from public.ml_model_runs
            </p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300">
            <DollarSign className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Forecast horizon: {forecast.data?.n ?? "—"} days</p>
            <p className="text-xs text-muted-foreground">
              {forecast.data?.model ?? "scikit-learn"} · last refreshed {
                forecast.data?.n ? "with latest pipeline run" : "—"
              }
            </p>
          </div>
        </div>
      </div>
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
