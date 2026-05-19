import { Link } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";

/**
 * Placeholder used by every page until Phase 3 builds the real UI.
 * Demonstrates that the theme, routing, fonts, and Tailwind utilities all work.
 */
export default function PageStub({ title, description, accent = "emerald" }) {
  const accentClass =
    accent === "purple"
      ? "from-violet-500/20"
      : accent === "blue"
      ? "from-blue-500/20"
      : "from-emerald-500/20";

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      {/* Top glow */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b ${accentClass} via-transparent to-transparent`}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-6 py-24">
        <div className="glass-card glass-card-hover w-full max-w-2xl p-10 text-center animate-fade-in">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30">
            <Sparkles className="h-6 w-6 text-emerald-400" />
          </div>

          <p className="kpi-label mb-2">Quantuma AI · Phase 2 Stub</p>
          <h1 className="mb-3 text-4xl font-bold tracking-tight">{title}</h1>
          <p className="mx-auto max-w-md text-muted-foreground">{description}</p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="pill pill-emerald">Routing ✓</span>
            <span className="pill pill-purple">Tailwind ✓</span>
            <span className="pill pill-blue">Shadcn-ready ✓</span>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-surface-2 px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-3 transition"
            >
              ← Landing
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 transition"
            >
              Go to Dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          This stub will be replaced with the real screen in Phase 3.
        </p>
      </div>
    </div>
  );
}
