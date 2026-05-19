import { useState } from "react";
import { Sparkles, TrendingUp, ShoppingBag, Target, MousePointerClick } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/cards/PageHeader";
import InsightCard from "@/components/cards/InsightCard";
import RevenueAreaChart from "@/charts/RevenueAreaChart";
import CategoryBarChart from "@/charts/CategoryBarChart";
import LoadingSkeleton from "@/components/common/LoadingSkeleton";
import SectionError from "@/components/common/SectionError";
import useSupabaseQuery from "@/hooks/useSupabaseQuery";
import { fetchKpiCards } from "@/services/dashboardService";
import {
  fetchRevenueMonthlyWithForecast,
  fetchChannelPerformance,
  fetchCategoryPerformance,
} from "@/services/salesService";
import { formatCurrency, formatPercent } from "@/utils/formatters";
import { cn } from "@/lib/utils";

export default function SalesAnalyticsPage() {
  const [view, setView] = useState("grid");

  const kpis      = useSupabaseQuery(fetchKpiCards);
  const trend     = useSupabaseQuery(fetchRevenueMonthlyWithForecast);
  const channels  = useSupabaseQuery(fetchChannelPerformance);
  const categories = useSupabaseQuery(() => fetchCategoryPerformance(12));

  // Pull the headline numbers off the live KPI feed (same source as dashboard).
  const kpiByKey = Object.fromEntries((kpis.data ?? []).map((k) => [k.key, k]));

  return (
    <DashboardLayout searchPlaceholder="Search sales analytics...">
      <PageHeader
        title="Sales Analytics"
        description="Real-time revenue tracking and predictive intelligence across all channels."
        actions={
          <>
            <div className="hidden md:flex items-center gap-2 rounded-xl border border-white/[0.06] bg-surface-1 px-3 py-2 text-xs">
              <span className="text-muted-foreground">REGION</span>
              <span className="font-semibold">All Regions</span>
            </div>
            <div className="hidden md:flex items-center gap-2 rounded-xl border border-white/[0.06] bg-surface-1 px-3 py-2 text-xs">
              <span className="text-muted-foreground">CHANNEL</span>
              <span className="font-semibold">All Channels</span>
            </div>
            <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 transition">
              Apply Filters
            </button>
          </>
        }
      />

      {/* Top stats — fed from v_kpi_summary */}
      {kpis.loading ? (
        <LoadingSkeleton variant="kpi" rows={4} />
      ) : kpis.error ? (
        <SectionError message="Couldn't load KPIs" error={kpis.error} onRetry={kpis.refetch} />
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Revenue"
            icon={ShoppingBag}
            value={formatCurrency(kpiByKey.revenue?.value ?? 0)}
            delta={kpiByKey.revenue?.change ?? 0}
          />
          <StatCard
            label="Avg. Order Value"
            icon={Target}
            value={formatCurrency(kpiByKey.aov?.value ?? 0)}
            delta={kpiByKey.aov?.change ?? 0}
          />
          <StatCard
            label="Total Orders"
            icon={MousePointerClick}
            value={(kpiByKey.orders?.value ?? 0).toLocaleString()}
            delta={kpiByKey.orders?.change ?? 0}
          />
          <div className="glass-card p-5 bg-gradient-to-br from-violet-500/10 via-transparent to-transparent">
            <div className="flex items-start justify-between">
              <p className="kpi-label text-violet-300">Active Customers</p>
              <Sparkles className="h-4 w-4 text-violet-300" />
            </div>
            <p className="kpi-value mt-3 text-violet-200">
              {(kpiByKey.active?.value ?? 0).toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Bought in the last 30 days</p>
          </div>
        </div>
      )}

      {/* Trend + Channels */}
      <div className="mt-6 grid gap-4 grid-cols-1 lg:grid-cols-3">
        <InsightCard
          title="Revenue Trend"
          subtitle="Monthly revenue vs forecast (trailing 12 months)"
          className="lg:col-span-2"
        >
          {trend.loading ? (
            <LoadingSkeleton variant="chart" height={280} />
          ) : trend.error ? (
            <SectionError message="Couldn't load revenue trend" error={trend.error} onRetry={trend.refetch} />
          ) : (
            <RevenueAreaChart data={trend.data ?? []} />
          )}
        </InsightCard>

        <InsightCard title="Payment Channels" subtitle="Revenue share by payment type">
          {channels.loading ? (
            <LoadingSkeleton variant="table" rows={4} columns={2} />
          ) : channels.error ? (
            <SectionError message="Couldn't load channels" error={channels.error} onRetry={channels.refetch} />
          ) : (
            <>
              <ul className="space-y-4">
                {(channels.data ?? []).map((c) => (
                  <li key={c.channel}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{c.channel}</span>
                      <span className="text-xs font-semibold text-emerald-400">
                        {formatPercent(c.change, 1, false)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                          style={{ width: `${Math.min(100, Math.abs(c.change))}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{formatCurrency(c.value)}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4 text-xs">
                <span className="text-muted-foreground">Distinct Channels</span>
                <span className="font-semibold text-emerald-400">{(channels.data ?? []).length}</span>
              </div>
            </>
          )}
        </InsightCard>
      </div>

      {/* Category breakdown */}
      <div className="mt-6">
        <InsightCard
          title="Category Performance Breakdown"
          subtitle="Top categories by revenue · colour reflects avg review score"
          icon={TrendingUp}
          action={
            <div className="inline-flex rounded-lg border border-white/[0.08] bg-surface-2 p-1 text-xs">
              {["grid", "bar"].map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "px-3 py-1 rounded-md capitalize",
                    view === v ? "bg-emerald-500 text-black font-semibold" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {v} view
                </button>
              ))}
            </div>
          }
        >
          {categories.loading ? (
            <LoadingSkeleton variant="chart" height={300} />
          ) : categories.error ? (
            <SectionError message="Couldn't load categories" error={categories.error} onRetry={categories.refetch} />
          ) : view === "bar" ? (
            <CategoryBarChart data={categories.data ?? []} />
          ) : (
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              {(categories.data ?? []).map((c) => {
                const maxRev = Math.max(...(categories.data ?? []).map((x) => x.revenue), 1);
                const intensity = Math.min(1, c.revenue / maxRev);
                return (
                  <div
                    key={c.category}
                    className="rounded-xl border p-4 transition hover:scale-[1.02]"
                    style={{
                      background: `rgba(16,185,129, ${0.05 + intensity * 0.35})`,
                      borderColor: `rgba(16,185,129, ${0.15 + intensity * 0.45})`,
                    }}
                  >
                    <p className="kpi-label">{c.category}</p>
                    <p className="mt-2 text-2xl font-bold">{formatCurrency(c.revenue)}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      ★ {c.reviewScore != null ? c.reviewScore.toFixed(2) : "—"} avg review
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </InsightCard>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ label, value, delta, icon: Icon }) {
  const positive = delta >= 0;
  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between">
        <p className="kpi-label">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="kpi-value mt-3">{value}</p>
      <p className={cn("mt-1 text-xs", positive ? "text-emerald-400" : "text-red-400")}>
        {positive ? "↗" : "↘"} {formatPercent(delta, 1)}
      </p>
    </div>
  );
}
