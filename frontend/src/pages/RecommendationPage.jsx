import { useState, useMemo } from "react";
import { Sparkles, Network, Gauge, Layers, Zap, ShoppingCart, Search, X } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/cards/PageHeader";
import InsightCard from "@/components/cards/InsightCard";
import LoadingSkeleton from "@/components/common/LoadingSkeleton";
import SectionError from "@/components/common/SectionError";
import useSupabaseQuery from "@/hooks/useSupabaseQuery";
import {
  fetchClusterRecommendations,
  fetchClusterTabs,
} from "@/services/recommendationService";
import { fetchModelMetrics } from "@/services/mlInsightsService";
import { formatCurrency } from "@/utils/formatters";
import { cn } from "@/lib/utils";

export default function RecommendationPage() {
  const [nonce, setNonce] = useState(0);
  const [recSearch, setRecSearch] = useState("");

  const recs   = useSupabaseQuery(() => fetchClusterRecommendations(4), [nonce]);
  const tabs   = useSupabaseQuery(fetchClusterTabs);
  const models = useSupabaseQuery(fetchModelMetrics);

  const alsPrecision = (models.data ?? []).find(
    (m) => m.model === "als" && m.metric === "precision_at_k"
  );

  // Filter recommendations by product ID or category
  const filteredRecs = useMemo(() => {
    const data = recs.data ?? [];
    if (!recSearch.trim()) return data;
    const q = recSearch.toLowerCase();
    return data.filter(
      (p) =>
        p.id.toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q)
    );
  }, [recs.data, recSearch]);

  return (
    <DashboardLayout>
      <PageHeader
        title="Recommendation Engine"
        description={
          alsPrecision
            ? `ALS Collaborative Filtering on Spark MLlib · live precision@10: ${(alsPrecision.raw * 100).toFixed(2)}%`
            : "ALS Collaborative Filtering powered by Spark MLlib."
        }
      />

      {/* Engine hero */}
      <div className="glass-card relative overflow-hidden p-6 bg-gradient-to-br from-emerald-500/10 via-transparent to-violet-500/10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/40">
              <Sparkles className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold">AI Recommendation Engine</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Quantuma uses Spark MLlib's ALS implicit-feedback recommender on the
                full Olist purchase graph. The cards below are this customer's
                model-ranked top picks.
              </p>
            </div>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-emerald-400">
                {alsPrecision ? `${(alsPrecision.raw * 100).toFixed(1)}%` : "—"}
              </p>
              <p className="kpi-label mt-1">Precision @ 10</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-emerald-400">
                {(recs.data ?? []).length || "—"}
              </p>
              <p className="kpi-label mt-1">Live Picks</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cluster Tabs + Live recommendations */}
      <div className="mt-6 grid gap-4 grid-cols-1 lg:grid-cols-5">
        <InsightCard
          title="Smart Recommendations"
          subtitle="ALS top-K predictions for the selected customer"
          icon={ShoppingCart}
          className="lg:col-span-3"
          action={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={recSearch}
                  onChange={(e) => setRecSearch(e.target.value)}
                  placeholder="Search products..."
                  className="h-8 w-36 rounded-lg border border-white/[0.06] bg-surface-1 pl-8 pr-7 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
                {recSearch && (
                  <button onClick={() => setRecSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setNonce((n) => n + 1)}
                className="rounded-md border border-white/[0.08] bg-surface-2 px-3 py-1.5 text-xs hover:bg-surface-3 transition whitespace-nowrap"
              >
                Sample another customer
              </button>
            </div>
          }
        >
          {recs.loading ? (
            <LoadingSkeleton variant="table" rows={4} columns={2} />
          ) : recs.error ? (
            <SectionError message="Couldn't load recommendations" error={recs.error} onRetry={recs.refetch} />
          ) : filteredRecs.length === 0 ? (
            <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300">
              {recSearch.trim()
                ? `No recommendations matching "${recSearch}". Try a product ID or category name.`
                : "No recommendations available yet. Run the ALS step (scripts.run_ml_pipeline --only-als)."}
            </p>
          ) : (
            <>
              {recSearch.trim() && (
                <p className="mb-3 text-xs text-muted-foreground">
                  {filteredRecs.length} result{filteredRecs.length !== 1 ? "s" : ""} for "{recSearch}"
                </p>
              )}
            <ul className="space-y-3">
              {filteredRecs.map((p) => (
                <li
                  key={p.productId}
                  className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-surface-1/70 p-4 hover:bg-surface-2 transition"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/30 shrink-0 text-sm font-bold text-emerald-300">
                    #{p.rank}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{p.id}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.category}
                      {p.reviewScore != null
                        ? ` · ★ ${p.reviewScore.toFixed(2)}`
                        : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-400">{p.match}% Match</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                      ALS rank {p.rank}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            </>
          )}
        </InsightCard>

        <InsightCard
          title="Affinity Categories"
          subtitle="Most-recommended-against verticals"
          icon={Zap}
          className="lg:col-span-2"
        >
          {tabs.loading ? (
            <LoadingSkeleton variant="table" rows={3} columns={1} />
          ) : tabs.error ? (
            <SectionError message="Couldn't load tabs" error={tabs.error} onRetry={tabs.refetch} />
          ) : (
            <ul className="space-y-3">
              {(tabs.data ?? []).map((cat, i) => (
                <li
                  key={cat}
                  className={cn(
                    "rounded-xl border p-4 transition bg-gradient-to-br",
                    i === 0
                      ? "from-emerald-500/15 to-transparent border-emerald-500/25 text-emerald-300"
                      : i === 1
                      ? "from-violet-500/15 to-transparent border-violet-500/25 text-violet-300"
                      : "from-blue-500/15 to-transparent border-blue-500/25 text-blue-300"
                  )}
                >
                  <p className="text-[10px] font-bold tracking-widest">RANK #{i + 1}</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{cat}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Frequently recommended across the active customer base.
                  </p>
                </li>
              ))}
            </ul>
          )}
        </InsightCard>
      </div>

      {/* Cluster recommendations cards (same data, visual grid) */}
      <div className="mt-6">
        <InsightCard
          title="Cluster-Affinity Recommendations"
          subtitle="Same ALS picks, surfaced as a product grid"
        >
          {recs.loading ? (
            <LoadingSkeleton variant="chart" height={220} />
          ) : recs.error ? (
            <SectionError message="Couldn't load recommendations" error={recs.error} onRetry={recs.refetch} />
          ) : (
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              {filteredRecs.map((p) => (
                <div
                  key={p.productId}
                  className="rounded-xl border border-white/[0.06] bg-surface-1/80 overflow-hidden hover:border-emerald-500/30 transition"
                >
                  <div className="relative aspect-[4/3] bg-gradient-to-br from-surface-3 to-surface-1">
                    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-emerald-500/85 px-2 py-0.5 text-[10px] font-bold text-black">
                      {p.match}% Match
                    </span>
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/60">
                      <Layers className="h-12 w-12" />
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-semibold">{p.id}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-base font-bold text-emerald-400">
                        {formatCurrency(p.price)}
                      </p>
                      <button className="rounded-md bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25 transition">
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </InsightCard>
      </div>

      {/* How it works — static narrative */}
      <div className="mt-6 grid gap-4 grid-cols-1 md:grid-cols-3">
        {[
          { icon: Network, title: "Implicit Feedback", color: "violet",  desc: "Hu/Koren/Volinsky 2008 ALS formulation: every purchase is a weighted positive signal." },
          { icon: Gauge,   title: "Latent Factors",     color: "emerald", desc: "16-dimensional embeddings learned from the full customer × product matrix." },
          { icon: Layers,  title: "Cluster Affinity",   color: "blue",    desc: "K-Means segments are surfaced alongside ALS picks to explain *why* each match is offered." },
        ].map((b) => {
          const Icon = b.icon;
          return (
            <div key={b.title} className="glass-card p-5">
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl ring-1",
                b.color === "violet"  && "bg-violet-500/15 ring-violet-500/30 text-violet-300",
                b.color === "emerald" && "bg-emerald-500/15 ring-emerald-500/30 text-emerald-400",
                b.color === "blue"    && "bg-blue-500/15 ring-blue-500/30 text-blue-300"
              )}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{b.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{b.desc}</p>
            </div>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
