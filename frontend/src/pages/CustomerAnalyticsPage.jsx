import { Download, Lightbulb, MoreVertical } from "lucide-react";
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

const EngagementBars = ({ level }) => {
  const fills = { Low: 1, Medium: 3, High: 5 }[level] || 0;
  const colour = level === "High" ? "bg-emerald-400" : level === "Medium" ? "bg-blue-400" : "bg-red-400";
  return (
    <div className="flex items-end gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn(
            "w-1 rounded-sm",
            i <= fills ? colour : "bg-white/[0.06]"
          )}
          style={{ height: `${4 + i * 2}px` }}
        />
      ))}
    </div>
  );
};

export default function CustomerAnalyticsPage() {
  const segments = useSupabaseQuery(fetchSegmentDistribution);
  const scatter  = useSupabaseQuery(() => fetchClusterScatter(500));
  const spending = useSupabaseQuery(() => fetchSpendingBehavior(6));
  const table    = useSupabaseQuery(() => fetchCustomerTable(8));

  const totalCustomers = (segments.data ?? []).reduce((s, x) => s + (x.customers ?? 0), 0);

  return (
    <DashboardLayout searchPlaceholder="Search customer intelligence...">
      <PageHeader
        title="Customer Intelligence"
        description={
          segments.loading
            ? "Loading customer cohort data..."
            : `Deep behavioral mapping and cohort performance across ${totalCustomers.toLocaleString()} active accounts.`
        }
        actions={
          <button className="inline-flex items-center gap-2 rounded-xl bg-blue-500/15 px-4 py-2 text-sm font-semibold text-blue-300 ring-1 ring-blue-500/30 hover:bg-blue-500/25 transition">
            <Download className="h-4 w-4" /> Export Analysis
          </button>
        }
      />

      {/* Top metrics — static narrative copy kept; segment swatch derived from live segments */}
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
            <SectionError
              message="Couldn't load cluster scatter"
              error={scatter.error}
              onRetry={scatter.refetch}
            />
          ) : (
            <ClusterScatter data={scatter.data ?? []} />
          )}
        </InsightCard>

        <InsightCard title="Spending Behavior" subtitle="Top categories by revenue">
          {spending.loading ? (
            <LoadingSkeleton variant="table" rows={5} columns={2} />
          ) : spending.error ? (
            <SectionError
              message="Couldn't load category mix"
              error={spending.error}
              onRetry={spending.refetch}
            />
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
              <p>
                Top spending category drives roughly a third of total revenue across all segments.
              </p>
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
              : `Showing 1–${(table.data ?? []).length} of ${totalCustomers.toLocaleString()} entries`
          }
          action={
            <div className="flex gap-2 text-xs">
              <button className="rounded-md border border-white/[0.08] bg-surface-2 px-3 py-1.5 hover:bg-surface-3 transition">
                Filter
              </button>
              <button className="rounded-md border border-white/[0.08] bg-surface-2 px-3 py-1.5 hover:bg-surface-3 transition">
                Column View
              </button>
            </div>
          }
        >
          {table.loading ? (
            <LoadingSkeleton variant="table" rows={8} columns={6} />
          ) : table.error ? (
            <SectionError
              message="Couldn't load customer table"
              error={table.error}
              onRetry={table.refetch}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-3 py-3 text-left">Customer</th>
                    <th className="px-3 py-3 text-left">Segment</th>
                    <th className="px-3 py-3 text-right">Lifetime Value</th>
                    <th className="px-3 py-3 text-left">Engagement</th>
                    <th className="px-3 py-3 text-left">Churn Probability</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {(table.data ?? []).map((c) => (
                    <tr key={c.rawId} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition">
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
                      <td className="px-3 py-4">
                        <span className={cn("pill", SEGMENT_PILL[c.segment])}>{c.segment}</span>
                      </td>
                      <td className="px-3 py-4 text-right font-semibold">{formatCurrency(c.ltv)}</td>
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-2">
                          <EngagementBars level={c.engagement} />
                          <span className="text-xs text-muted-foreground">{c.engagement}</span>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.04]">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                c.churnProb > 50
                                  ? "bg-red-400"
                                  : c.churnProb > 25
                                  ? "bg-amber-400"
                                  : "bg-emerald-400"
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
