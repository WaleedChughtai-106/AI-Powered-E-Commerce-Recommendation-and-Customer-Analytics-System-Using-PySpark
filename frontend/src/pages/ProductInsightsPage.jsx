import { useState, useMemo } from "react";
import { AlertTriangle, Sparkles, Package, X, TrendingDown, Clock, Search } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/cards/PageHeader";
import InsightCard from "@/components/cards/InsightCard";
import LoadingSkeleton from "@/components/common/LoadingSkeleton";
import SectionError from "@/components/common/SectionError";
import useSupabaseQuery from "@/hooks/useSupabaseQuery";
import { fetchTopProducts, fetchInventoryAlerts } from "@/services/productService";
import { formatCurrency, formatPercent } from "@/utils/formatters";
import { cn } from "@/lib/utils";

const TAG_PILL = {
  TRENDING: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  STABLE: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
  GROWING: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  DECLINING: "bg-red-500/15 text-red-300 ring-red-500/30",
};

export default function ProductInsightsPage() {
  const [productSearch, setProductSearch] = useState("");
  const [predictionsOpen, setPredictionsOpen] = useState(false);

  const top    = useSupabaseQuery(() => fetchTopProducts(10));
  const alerts = useSupabaseQuery(() => fetchInventoryAlerts(20));

  const topTwo = (top.data ?? []).slice(0, 2);

  const filteredTop = useMemo(() => {
    const data = top.data ?? [];
    if (!productSearch.trim()) return data;
    const q = productSearch.toLowerCase();
    return data.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
  }, [top.data, productSearch]);

  return (
    <DashboardLayout>
      <PageHeader
        title="Product Insights"
        description="Real-time intelligence and inventory health monitoring."
      />

      {/* Top performers + Inventory alerts */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        {top.loading ? (
          <>
            <LoadingSkeleton variant="card" height={220} />
            <LoadingSkeleton variant="card" height={220} />
          </>
        ) : top.error ? (
          <div className="lg:col-span-2">
            <SectionError message="Couldn't load top products" error={top.error} onRetry={top.refetch} />
          </div>
        ) : (
          topTwo.map((p) => (
            <div key={p.rawId} className="glass-card p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="kpi-label">
                    {p.tag === "TRENDING" ? "Top Performer" : "Steady Performer"}
                  </p>
                  <h3 className="mt-2 text-2xl font-bold">{p.name}</h3>
                </div>
                <span className={cn("pill ring-1", TAG_PILL[p.tag])}>{p.tag}</span>
              </div>

              <div className="mt-6 flex items-baseline gap-3">
                <p className="text-4xl font-bold">{formatCurrency(p.revenue)}</p>
                <p className={cn("text-sm font-semibold", p.change >= 0 ? "text-emerald-400" : "text-red-400")}>
                  {p.change >= 0 ? "↗" : "↘"} {formatPercent(p.change, 1)}
                </p>
              </div>

              <div className="mt-6 rounded-xl border border-violet-500/15 bg-violet-500/5 p-4">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 shrink-0 text-violet-300 mt-0.5" />
                  <p className="text-sm">
                    AI sentiment:{" "}
                    <span className={cn("font-semibold", p.sentiment === "Strong Buy" ? "text-emerald-400" : "text-violet-300")}>
                      {p.sentiment}
                    </span>{" "}
                    based on <span className="font-semibold">{p.reviewCount.toLocaleString()}</span> reviews · {p.unitsSold.toLocaleString()} units sold.
                  </p>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Inventory health */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 ring-1 ring-amber-500/30">
              <AlertTriangle className="h-4 w-4 text-amber-300" />
            </div>
            <h3 className="text-xl font-semibold">Inventory Health</h3>
          </div>

          {alerts.loading ? (
            <div className="mt-4"><LoadingSkeleton variant="table" rows={3} columns={1} /></div>
          ) : alerts.error ? (
            <div className="mt-4">
              <SectionError message="Couldn't load inventory alerts" error={alerts.error} onRetry={alerts.refetch} />
            </div>
          ) : (alerts.data ?? []).length === 0 ? (
            <p className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-300">
              ✓ All tracked products are healthy. No inventory alerts.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {(alerts.data ?? []).slice(0, 3).map((a) => (
                <div
                  key={a.productId}
                  className={cn(
                    "rounded-xl border-l-2 bg-surface-1/70 p-4",
                    a.severity === "high" ? "border-l-red-400" : "border-l-amber-300"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <span className={cn(
                      "text-[10px] font-bold tracking-widest",
                      a.severity === "high" ? "text-red-400" : "text-amber-300"
                    )}>
                      {a.type === "LOW_STOCK" ? "OUT-OF-STOCK RISK" : "SLOW MOVEMENT"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{a.eta}</span>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold">{a.product}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{a.detail}</p>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setPredictionsOpen(true)}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-surface-2 px-4 py-2.5 text-sm font-semibold hover:bg-surface-3 transition"
          >
            View All Predictions →
          </button>
        </div>
      </div>

      {/* Performance matrix */}
      <div className="mt-6 grid gap-4 grid-cols-1 lg:grid-cols-3">
        <InsightCard
          title="Performance Matrix"
          subtitle="Revenue × review-score per product"
          icon={Package}
          className="lg:col-span-2"
        >
          <div className="relative h-72 rounded-xl border border-white/[0.05] bg-surface-1/40 p-4">
            <p className="absolute left-2 top-2 rotate-[-90deg] origin-top-left text-[10px] text-muted-foreground">
              Review Score →
            </p>
            <p className="absolute bottom-2 right-3 text-[10px] text-muted-foreground">Revenue →</p>

            <div className="absolute inset-4 grid grid-cols-2 grid-rows-2 gap-px bg-white/[0.04]">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-surface-1" />
              ))}
            </div>

            {top.loading || top.error ? null : (
              <>
                {(filteredTop.length > 0 ? filteredTop : top.data ?? []).map((p, i) => {
                  const maxRev = Math.max(...(top.data ?? []).map((x) => x.revenue), 1);
                  const x = 10 + (p.revenue / maxRev) * 80;
                  const y = p.reviewScore != null ? 90 - ((p.reviewScore - 1) / 4) * 80 : 50;
                  const color = p.change > 5 ? "#10b981" : p.change > 0 ? "#60a5fa" : "#f87171";
                  return (
                    <div
                      key={p.rawId ?? i}
                      className="absolute -translate-x-1/2 -translate-y-1/2 group"
                      style={{ left: `${x}%`, top: `${y}%` }}
                    >
                      <div
                        className="h-12 w-12 rounded-lg flex items-center justify-center text-[10px] font-bold ring-1 cursor-pointer transition group-hover:scale-110"
                        style={{ background: `${color}15`, borderColor: `${color}55`, color }}
                      >
                        {p.id.slice(0, 4)}
                      </div>
                      <div className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-surface-3 px-2 py-1 text-[10px] opacity-0 group-hover:opacity-100 transition shadow-card">
                        {p.name}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            <div className="absolute right-4 top-4 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Strong</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-400" /> Solid</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400" /> Watch</span>
            </div>
          </div>
        </InsightCard>

        <InsightCard
          title="Top Catalog"
          subtitle="Highest-revenue SKUs"
          action={
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products..."
                className="h-8 w-40 rounded-lg border border-white/[0.06] bg-surface-1 pl-8 pr-7 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              {productSearch && (
                <button onClick={() => setProductSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          }
        >
          {top.loading ? (
            <LoadingSkeleton variant="table" rows={4} columns={2} />
          ) : top.error ? (
            <SectionError message="Couldn't load top catalog" error={top.error} onRetry={top.refetch} />
          ) : (
            <ul className="space-y-3 text-sm">
              {(filteredTop.length > 0 ? filteredTop : top.data ?? []).slice(0, 6).map((p) => (
                <li
                  key={p.rawId}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-surface-1/70 px-3 py-2.5 hover:bg-surface-2 transition"
                >
                  <div>
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.unitsSold.toLocaleString()} units · ★ {p.reviewScore?.toFixed(2) ?? "—"}
                    </p>
                  </div>
                  <span className="font-semibold text-emerald-400">{formatCurrency(p.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </InsightCard>
      </div>

      {/* View All Predictions Modal */}
      {predictionsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-2xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 ring-1 ring-amber-500/30">
                  <AlertTriangle className="h-4 w-4 text-amber-300" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">All Inventory Predictions</h2>
                  <p className="text-xs text-muted-foreground">
                    AI-powered risk assessment across your full product catalog
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPredictionsOpen(false)}
                className="rounded-lg p-2 hover:bg-surface-2 transition text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Stats strip */}
            <div className="flex gap-4 px-6 py-4 border-b border-white/[0.06] text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Total Alerts</p>
                <p className="font-bold text-amber-400">{(alerts.data ?? []).length}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">High Risk</p>
                <p className="font-bold text-red-400">
                  {(alerts.data ?? []).filter((a) => a.severity === "high").length}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Medium Risk</p>
                <p className="font-bold text-amber-400">
                  {(alerts.data ?? []).filter((a) => a.severity !== "high").length}
                </p>
              </div>
            </div>

            {/* Scrollable alert list */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {alerts.loading ? (
                <LoadingSkeleton variant="table" rows={6} columns={1} />
              ) : alerts.error ? (
                <SectionError message="Couldn't load predictions" error={alerts.error} onRetry={alerts.refetch} />
              ) : (alerts.data ?? []).length === 0 ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center text-sm text-emerald-300">
                  ✓ All products are healthy. No predictions to show.
                </div>
              ) : (
                (alerts.data ?? []).map((a) => (
                  <div
                    key={a.productId}
                    className={cn(
                      "rounded-xl border-l-4 bg-surface-1/70 p-4",
                      a.severity === "high" ? "border-l-red-400" : "border-l-amber-300"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1",
                          a.severity === "high"
                            ? "bg-red-500/15 ring-red-500/30 text-red-400"
                            : "bg-amber-500/15 ring-amber-500/30 text-amber-400"
                        )}>
                          {a.type === "LOW_STOCK" ? <TrendingDown className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                        </div>
                        <div>
                          <span className={cn(
                            "text-[10px] font-bold tracking-widest",
                            a.severity === "high" ? "text-red-400" : "text-amber-300"
                          )}>
                            {a.type === "LOW_STOCK" ? "OUT-OF-STOCK RISK" : "SLOW MOVEMENT"}
                          </span>
                          <p className="mt-0.5 text-sm font-semibold">{a.product}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{a.detail}</p>
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{a.eta}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-white/[0.06] p-4 flex justify-end">
              <button
                onClick={() => setPredictionsOpen(false)}
                className="rounded-xl bg-surface-2 px-5 py-2 text-sm font-semibold hover:bg-surface-3 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
