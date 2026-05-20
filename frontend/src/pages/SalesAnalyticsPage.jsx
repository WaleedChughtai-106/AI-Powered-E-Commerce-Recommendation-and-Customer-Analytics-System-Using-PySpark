import { useState, useMemo } from "react";
import { Sparkles, TrendingUp, ShoppingBag, Target, MousePointerClick, ChevronDown, CheckCircle2, Search, X } from "lucide-react";
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
import { useDashboard } from "@/context/DashboardContext";
import { formatCurrency, formatPercent } from "@/utils/formatters";
import { cn } from "@/lib/utils";

const REGIONS = ["All Regions", "Brazil — North", "Brazil — South", "Brazil — Southeast", "Brazil — Other"];
const CHANNELS = ["All Channels", "Credit Card", "Boleto", "Voucher", "Debit Card", "Other"];

export default function SalesAnalyticsPage() {
  const [view, setView] = useState("grid");
  const [catSearch, setCatSearch] = useState("");

  // Filter state
  const [pendingRegion, setPendingRegion] = useState("All Regions");
  const [pendingChannel, setPendingChannel] = useState("All Channels");
  const [activeRegion, setActiveRegion] = useState("All Regions");
  const [activeChannel, setActiveChannel] = useState("All Channels");
  const [regionOpen, setRegionOpen] = useState(false);
  const [channelOpen, setChannelOpen] = useState(false);
  const [filterApplied, setFilterApplied] = useState(false);

  // ── Date range from global context ──────────────────────────────────
  const { nMonths } = useDashboard();

  const kpis       = useSupabaseQuery(fetchKpiCards);
  const trend      = useSupabaseQuery(fetchRevenueMonthlyWithForecast);
  const channels   = useSupabaseQuery(fetchChannelPerformance);
  const categories = useSupabaseQuery(() => fetchCategoryPerformance(12));

  // ── Filter monthly trend by selected date range ──────────────────────
  const filteredTrend = useMemo(() => {
    const data = trend.data ?? [];
    if (!nMonths) return data;
    return data.slice(-nMonths);
  }, [trend.data, nMonths]);

  // ── Derive KPI values from filtered trend ────────────────────────────
  const kpiByKey = useMemo(() => {
    const base = Object.fromEntries((kpis.data ?? []).map((k) => [k.key, k]));
    if (!nMonths || filteredTrend.length === 0) return base;

    const revenue   = filteredTrend.reduce((s, r) => s + (r.actual ?? 0), 0);
    const ordersSum = filteredTrend.reduce((s, r) => s + (r.orderCount ?? 0), 0);
    const customers = Math.max(...filteredTrend.map((r) => r.customerCount ?? 0));
    const aov       = ordersSum > 0 ? revenue / ordersSum : 0;

    return {
      revenue: { value: revenue,   change: 0 },
      aov:     { value: aov,       change: 0 },
      orders:  { value: ordersSum, change: 0 },
      active:  { value: customers, change: 0 },
    };
  }, [kpis.data, filteredTrend, nMonths]);

  const filteredChannels = useMemo(() => {
    const data = channels.data ?? [];
    return activeChannel === "All Channels" ? data : data.filter((c) => c.channel === activeChannel);
  }, [channels.data, activeChannel]);

  const filteredCategories = useMemo(() => {
    const data = categories.data ?? [];
    if (!catSearch.trim()) return data;
    const q = catSearch.toLowerCase();
    return data.filter((c) => c.category.toLowerCase().includes(q));
  }, [categories.data, catSearch]);

  const handleApply = () => {
    setActiveRegion(pendingRegion);
    setActiveChannel(pendingChannel);
    setFilterApplied(true);
    setRegionOpen(false);
    setChannelOpen(false);
    setTimeout(() => setFilterApplied(false), 2500);
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Sales Analytics"
        description="Real-time revenue tracking and predictive intelligence across all channels."
        actions={
          <>
            {/* Region dropdown */}
            <div className="relative hidden md:block">
              <button
                onClick={() => { setRegionOpen((o) => !o); setChannelOpen(false); }}
                className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-surface-1 px-3 py-2 text-xs hover:bg-surface-2 transition"
              >
                <span className="text-muted-foreground">REGION</span>
                <span className="font-semibold">{pendingRegion}</span>
                <ChevronDown className={cn("h-3 w-3 transition-transform text-muted-foreground", regionOpen && "rotate-180")} />
              </button>
              {regionOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 rounded-xl border border-white/[0.08] bg-surface-2 py-1 shadow-card z-50">
                  {REGIONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => { setPendingRegion(r); setRegionOpen(false); }}
                      className={cn(
                        "w-full px-4 py-2 text-left text-xs transition hover:bg-surface-3",
                        r === pendingRegion ? "text-emerald-400 font-semibold" : "text-foreground"
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Channel dropdown */}
            <div className="relative hidden md:block">
              <button
                onClick={() => { setChannelOpen((o) => !o); setRegionOpen(false); }}
                className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-surface-1 px-3 py-2 text-xs hover:bg-surface-2 transition"
              >
                <span className="text-muted-foreground">CHANNEL</span>
                <span className="font-semibold">{pendingChannel}</span>
                <ChevronDown className={cn("h-3 w-3 transition-transform text-muted-foreground", channelOpen && "rotate-180")} />
              </button>
              {channelOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-white/[0.08] bg-surface-2 py-1 shadow-card z-50">
                  {CHANNELS.map((c) => (
                    <button
                      key={c}
                      onClick={() => { setPendingChannel(c); setChannelOpen(false); }}
                      className={cn(
                        "w-full px-4 py-2 text-left text-xs transition hover:bg-surface-3",
                        c === pendingChannel ? "text-emerald-400 font-semibold" : "text-foreground"
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleApply}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 transition"
            >
              {filterApplied ? <><CheckCircle2 className="h-4 w-4" /> Applied!</> : "Apply Filters"}
            </button>
          </>
        }
      />

      {/* Active filter badge */}
      {(activeRegion !== "All Regions" || activeChannel !== "All Channels") && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Active filters:</span>
          {activeRegion !== "All Regions" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-300 ring-1 ring-emerald-500/30">
              {activeRegion}
              <button onClick={() => { setActiveRegion("All Regions"); setPendingRegion("All Regions"); }} className="ml-1 hover:text-white">×</button>
            </span>
          )}
          {activeChannel !== "All Channels" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-3 py-1 text-blue-300 ring-1 ring-blue-500/30">
              {activeChannel}
              <button onClick={() => { setActiveChannel("All Channels"); setPendingChannel("All Channels"); }} className="ml-1 hover:text-white">×</button>
            </span>
          )}
        </div>
      )}

      {/* Top stats */}
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
          ) : filteredTrend.length === 0 ? (
            <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300">
              No revenue data in the selected date range.
            </p>
          ) : (
            <RevenueAreaChart data={filteredTrend} />
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
                {filteredChannels.length === 0 ? (
                  <li className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
                    No data for the selected channel filter.
                  </li>
                ) : filteredChannels.map((c) => (
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
                <span className="font-semibold text-emerald-400">{filteredChannels.length}</span>
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
            <div className="flex items-center gap-2">
              {/* Inline category search */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={catSearch}
                  onChange={(e) => setCatSearch(e.target.value)}
                  placeholder="Search categories..."
                  className="h-8 w-44 rounded-lg border border-white/[0.06] bg-surface-1 pl-8 pr-7 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
                {catSearch && (
                  <button onClick={() => setCatSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
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
            </div>
          }
        >
          {categories.loading ? (
            <LoadingSkeleton variant="chart" height={300} />
          ) : categories.error ? (
            <SectionError message="Couldn't load categories" error={categories.error} onRetry={categories.refetch} />
          ) : view === "bar" ? (
            <CategoryBarChart data={filteredCategories} />
          ) : (
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              {filteredCategories.map((c) => {
                const maxRev = Math.max(...filteredCategories.map((x) => x.revenue), 1);
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
