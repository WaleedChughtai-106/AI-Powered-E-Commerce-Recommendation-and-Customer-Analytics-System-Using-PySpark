import { useState, useMemo } from "react";
import { Download, Lightbulb, MoreVertical, SlidersHorizontal, X, ChevronDown, Search } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/cards/PageHeader";
import InsightCard from "@/components/cards/InsightCard";
import ClusterScatter from "@/charts/ClusterScatter";
import LoadingSkeleton from "@/components/common/LoadingSkeleton";
import SectionError from "@/components/common/SectionError";
import useSupabaseQuery from "@/hooks/useSupabaseQuery";
import {
  fetchClusterScatter,
  fetchCustomerTable,
  fetchSpendingBehavior,
  fetchSegmentDistribution,
} from "@/services/customerService";
import { formatCurrency } from "@/utils/formatters";
import { SEGMENT_COLORS } from "@/utils/constants";
import { cn } from "@/lib/utils";

const SEGMENT_PILL = {
  VIP: "pill-emerald",
  "At Risk": "pill-coral",
  New: "pill-purple",
  Loyal: "pill-blue",
};

const ALL_COLUMNS = ["customer", "segment", "ltv", "engagement", "churnProb"];
const COLUMN_LABELS = {
  customer: "Customer",
  segment: "Segment",
  ltv: "Lifetime Value",
  engagement: "Engagement",
  churnProb: "Churn Probability",
};

const EngagementBars = ({ level }) => {
  const fills = { Low: 1, Medium: 3, High: 5 }[level] || 0;
  const colour = level === "High" ? "bg-emerald-400" : level === "Medium" ? "bg-blue-400" : "bg-red-400";
  return (
    <div className="flex items-end gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn("w-1 rounded-sm", i <= fills ? colour : "bg-white/[0.06]")}
          style={{ height: `${4 + i * 2}px` }}
        />
      ))}
    </div>
  );
};

function downloadCSV(data) {
  const headers = ["Customer ID", "Name", "Segment", "Lifetime Value", "Engagement", "Churn Probability"];
  const rows = data.map((c) => [c.id, c.name, c.segment, c.ltv, c.engagement, `${c.churnProb}%`]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `quantuma-customers-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function CustomerAnalyticsPage() {
  const [customerSearch, setCustomerSearch] = useState("");

  const [filterOpen, setFilterOpen] = useState(false);
  const [columnOpen, setColumnOpen] = useState(false);
  const [segmentFilter, setSegmentFilter] = useState("All");
  const [engagementFilter, setEngagementFilter] = useState("All");
  const [visibleCols, setVisibleCols] = useState(new Set(ALL_COLUMNS));
  const [exportSuccess, setExportSuccess] = useState(false);

  const segments = useSupabaseQuery(fetchSegmentDistribution);
  const scatter  = useSupabaseQuery(() => fetchClusterScatter(500));
  const spending = useSupabaseQuery(() => fetchSpendingBehavior(6));
  const table    = useSupabaseQuery(() => fetchCustomerTable(50)); // load more for filtering

  const totalCustomers = (segments.data ?? []).reduce((s, x) => s + (x.customers ?? 0), 0);

  const filteredTable = useMemo(() => {
    let data = table.data ?? [];
    if (segmentFilter !== "All") data = data.filter((c) => c.segment === segmentFilter);
    if (engagementFilter !== "All") data = data.filter((c) => c.engagement === engagementFilter);
    if (customerSearch.trim()) {
      const q = customerSearch.toLowerCase();
      data = data.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          c.segment.toLowerCase().includes(q)
      );
    }
    return data.slice(0, 8);
  }, [table.data, segmentFilter, engagementFilter, customerSearch]);

  const handleExport = () => {
    const data = table.data ?? [];
    if (!data.length) return;
    downloadCSV(data);
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 2500);
  };

  const toggleCol = (col) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(col)) {
        if (next.size > 2) next.delete(col); // keep at least 2 columns
      } else {
        next.add(col);
      }
      return next;
    });
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Customer Intelligence"
        description={
          segments.loading
            ? "Loading customer cohort data..."
            : `Deep behavioral mapping and cohort performance across ${totalCustomers.toLocaleString()} active accounts.`
        }
        actions={
          <button
            onClick={handleExport}
            disabled={table.loading || !(table.data ?? []).length}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ring-1 transition disabled:opacity-50",
              exportSuccess
                ? "bg-emerald-500/25 text-emerald-300 ring-emerald-500/40"
                : "bg-blue-500/15 text-blue-300 ring-blue-500/30 hover:bg-blue-500/25"
            )}
          >
            <Download className="h-4 w-4" />
            {exportSuccess ? "Exported!" : "Export Analysis"}
          </button>
        }
      />

      {/* Top metrics */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card p-5">
          <p className="kpi-label">Total Customers</p>
          <p className="mt-2 text-3xl font-bold text-emerald-400">
            {segments.loading ? "—" : totalCustomers.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Across all segments</p>
        </div>
        <div className="glass-card p-5">
          <p className="kpi-label">VIP Share</p>
          <p className="mt-2 text-3xl font-bold">
            {(segments.data ?? []).find((s) => s.name === "VIP")?.value ?? 0}
            <span className="text-base text-muted-foreground">%</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Highest-LTV cohort</p>
        </div>
        <div className="glass-card p-5">
          <p className="kpi-label">Active Clusters</p>
          <p className="mt-2 text-3xl font-bold">
            {segments.loading ? "—" : (segments.data ?? []).length}{" "}
            <span className="text-base text-muted-foreground">Segments</span>
          </p>
          <div className="mt-2 flex gap-1">
            {Object.values(SEGMENT_COLORS).map((c, i) => (
              <span key={i} className="h-2 w-4 rounded-full" style={{ background: c }} />
            ))}
          </div>
        </div>
        <div className="glass-card p-5 bg-gradient-to-br from-violet-500/10 via-transparent to-transparent">
          <p className="kpi-label text-violet-300">At-Risk Cohort</p>
          <p className="mt-2 text-2xl font-bold leading-snug">
            <span className="text-red-400">
              {(segments.data ?? []).find((s) => s.name === "At Risk")?.customers?.toLocaleString() ?? 0}
            </span>{" "}
            customers
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Re-engagement candidates</p>
        </div>
      </div>

      {/* Scatter + Spending Behavior */}
      <div className="mt-6 grid gap-4 grid-cols-1 lg:grid-cols-3">
        <InsightCard
          title="Customer Clusters"
          subtitle="K-Means · X: Purchase Frequency · Y: Avg Order Value"
          className="lg:col-span-2"
        >
          {scatter.loading ? (
            <LoadingSkeleton variant="chart" height={320} />
          ) : scatter.error ? (
            <SectionError message="Couldn't load cluster scatter" error={scatter.error} onRetry={scatter.refetch} />
          ) : (
            <ClusterScatter data={scatter.data ?? []} />
          )}
        </InsightCard>

        <InsightCard title="Spending Behavior" subtitle="Top categories by revenue">
          {spending.loading ? (
            <LoadingSkeleton variant="table" rows={5} columns={2} />
          ) : spending.error ? (
            <SectionError message="Couldn't load category mix" error={spending.error} onRetry={spending.refetch} />
          ) : (
            <ul className="space-y-4">
              {(spending.data ?? []).map((row) => {
                const max = Math.max(...(spending.data ?? []).map((s) => s.value), 1);
                const pct = (row.value / max) * 100;
                return (
                  <li key={row.category}>
                    <div className="flex items-center justify-between text-sm">
                      <span>{row.category}</span>
                      <span className="font-semibold">{formatCurrency(row.value)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 shrink-0 text-emerald-400" />
              <p>Top spending category drives roughly a third of total revenue across all segments.</p>
            </div>
          </div>
        </InsightCard>
      </div>

      {/* Customer table */}
      <div className="mt-6">
        <InsightCard
          title="Customer Detail Matrix"
          subtitle={
            table.loading
              ? "Loading..."
              : `Showing ${filteredTable.length} of ${totalCustomers.toLocaleString()} entries${
                  segmentFilter !== "All" || engagementFilter !== "All" || customerSearch ? " (filtered)" : ""
                }`
          }
          action={
            <div className="flex gap-2 text-xs relative">
              {/* Inline search */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search customers..."
                  className="h-8 w-40 rounded-lg border border-white/[0.06] bg-surface-1 pl-8 pr-7 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
                {customerSearch && (
                  <button onClick={() => setCustomerSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              {/* Filter button */}
              <div className="relative">
                <button
                  onClick={() => { setFilterOpen((o) => !o); setColumnOpen(false); }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border border-white/[0.08] px-3 py-1.5 transition",
                    filterOpen ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-surface-2 hover:bg-surface-3"
                  )}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" /> Filter
                  {(segmentFilter !== "All" || engagementFilter !== "All") && (
                    <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-black">
                      {[segmentFilter !== "All", engagementFilter !== "All"].filter(Boolean).length}
                    </span>
                  )}
                </button>
                {filterOpen && (
                  <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-white/[0.08] bg-surface-2 p-4 shadow-card z-50">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold">Filter Customers</p>
                      <button onClick={() => setFilterOpen(false)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Segment</label>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {["All", "VIP", "Loyal", "New", "At Risk"].map((s) => (
                            <button
                              key={s}
                              onClick={() => setSegmentFilter(s)}
                              className={cn(
                                "rounded-md px-2.5 py-1 text-xs transition",
                                segmentFilter === s ? "bg-emerald-500 text-black font-semibold" : "bg-surface-3 hover:bg-surface-1"
                              )}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Engagement</label>
                        <div className="mt-1.5 flex gap-1.5">
                          {["All", "High", "Medium", "Low"].map((e) => (
                            <button
                              key={e}
                              onClick={() => setEngagementFilter(e)}
                              className={cn(
                                "rounded-md px-2.5 py-1 text-xs transition",
                                engagementFilter === e ? "bg-emerald-500 text-black font-semibold" : "bg-surface-3 hover:bg-surface-1"
                              )}
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      </div>
                      {(segmentFilter !== "All" || engagementFilter !== "All") && (
                        <button
                          onClick={() => { setSegmentFilter("All"); setEngagementFilter("All"); }}
                          className="w-full text-xs text-red-400 hover:text-red-300 text-left"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Column View button */}
              <div className="relative">
                <button
                  onClick={() => { setColumnOpen((o) => !o); setFilterOpen(false); }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border border-white/[0.08] px-3 py-1.5 transition",
                    columnOpen ? "bg-blue-500/15 text-blue-300 border-blue-500/30" : "bg-surface-2 hover:bg-surface-3"
                  )}
                >
                  Column View <ChevronDown className={cn("h-3 w-3 transition-transform", columnOpen && "rotate-180")} />
                </button>
                {columnOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-white/[0.08] bg-surface-2 p-4 shadow-card z-50">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold">Show Columns</p>
                      <button onClick={() => setColumnOpen(false)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                    </div>
                    <div className="space-y-2">
                      {ALL_COLUMNS.map((col) => (
                        <label key={col} className="flex cursor-pointer items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={visibleCols.has(col)}
                            onChange={() => toggleCol(col)}
                            className="h-3.5 w-3.5 rounded border-white/20 bg-surface-2 text-emerald-500 focus:ring-emerald-500/40"
                          />
                          {COLUMN_LABELS[col]}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          }
        >
          {table.loading ? (
            <LoadingSkeleton variant="table" rows={8} columns={6} />
          ) : table.error ? (
            <SectionError message="Couldn't load customer table" error={table.error} onRetry={table.refetch} />
          ) : filteredTable.length === 0 ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300">
              No customers match the current filters.{" "}
              <button
                onClick={() => { setSegmentFilter("All"); setEngagementFilter("All"); }}
                className="font-semibold underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  <tr className="border-b border-white/[0.06]">
                    {visibleCols.has("customer") && <th className="px-3 py-3 text-left">Customer</th>}
                    {visibleCols.has("segment") && <th className="px-3 py-3 text-left">Segment</th>}
                    {visibleCols.has("ltv") && <th className="px-3 py-3 text-right">Lifetime Value</th>}
                    {visibleCols.has("engagement") && <th className="px-3 py-3 text-left">Engagement</th>}
                    {visibleCols.has("churnProb") && <th className="px-3 py-3 text-left">Churn Probability</th>}
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredTable.map((c) => (
                    <tr key={c.rawId} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition">
                      {visibleCols.has("customer") && (
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-surface-3 to-surface-4 ring-1 ring-white/10 flex items-center justify-center text-xs font-bold">
                              {c.id.slice(0, 2)}
                            </div>
                            <div>
                              <div className="font-semibold">{c.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">{c.id}</div>
                            </div>
                          </div>
                        </td>
                      )}
                      {visibleCols.has("segment") && (
                        <td className="px-3 py-4">
                          <span className={cn("pill", SEGMENT_PILL[c.segment])}>{c.segment}</span>
                        </td>
                      )}
                      {visibleCols.has("ltv") && (
                        <td className="px-3 py-4 text-right font-semibold">{formatCurrency(c.ltv)}</td>
                      )}
                      {visibleCols.has("engagement") && (
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-2">
                            <EngagementBars level={c.engagement} />
                            <span className="text-xs text-muted-foreground">{c.engagement}</span>
                          </div>
                        </td>
                      )}
                      {visibleCols.has("churnProb") && (
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.04]">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  c.churnProb > 50 ? "bg-red-400" : c.churnProb > 25 ? "bg-amber-400" : "bg-emerald-400"
                                )}
                                style={{ width: `${c.churnProb}%` }}
                              />
                            </div>
                            <span className={cn(
                              "text-xs font-semibold",
                              c.churnProb > 50 ? "text-red-400" : c.churnProb > 25 ? "text-amber-400" : "text-emerald-400"
                            )}>
                              {c.churnProb}%
                            </span>
                          </div>
                        </td>
                      )}
                      <td className="px-3 py-4 text-right">
                        <button className="text-muted-foreground hover:text-foreground">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </InsightCard>
      </div>
    </DashboardLayout>
  );
}
