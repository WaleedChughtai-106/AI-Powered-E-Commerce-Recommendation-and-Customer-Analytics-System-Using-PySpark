import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  LineChart,
  Brain,
  Palette,
  Package,
  TrendingUp,
  Moon,
  Sun,
  Lightbulb,
  BrainCog,
} from "lucide-react";

const StatBlock = ({ label, value, accent = "text-foreground" }) => (
  <div className="glass-card flex flex-col gap-1 p-4">
    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
      {label}
    </p>
    <p className={`text-lg font-bold ${accent}`}>{value}</p>
  </div>
);

export default function LandingPage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Glow background */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[700px] bg-emerald-glow opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-grid-faint [background-size:36px_36px] opacity-20" />

      {/* Top bar */}
      <header className="relative mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/40">
            <BrainCog className="h-4 w-4 text-emerald-400" />
          </div>
          <span className="text-lg font-bold text-emerald-400">Quantuma AI</span>
        </div>
        <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          <a className="hover:text-foreground cursor-pointer">Products</a>
          <a className="hover:text-foreground cursor-pointer">Solutions</a>
          <a className="hover:text-foreground cursor-pointer">Pricing</a>
        </nav>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 transition"
        >
          Start Free Trial
        </Link>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-7xl px-6 pt-16 pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-medium text-emerald-300"
        >
          <Sparkles className="h-3.5 w-3.5" /> ENTERPRISE INTELLIGENCE PLATFORM
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="mx-auto max-w-3xl text-5xl md:text-6xl font-bold leading-[1.05] tracking-tight"
        >
          Predictive Analytics for the{" "}
          <span className="bg-gradient-to-br from-emerald-300 via-emerald-400 to-emerald-600 bg-clip-text text-transparent">
            Modern Storefront.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mx-auto mt-5 max-w-2xl text-base md:text-lg text-muted-foreground"
        >
          Harness PySpark + Spark MLlib to maximize revenue, understand customer
          behavior, and optimize your product mix with a high-performance
          command center.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-black hover:bg-emerald-400 transition shadow-glow"
          >
            Start Free Trial <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-surface-1 px-6 py-3 text-sm font-semibold text-foreground hover:bg-surface-2 transition"
          >
            View Demo
          </Link>
        </motion.div>

        {/* Hero preview card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mx-auto mt-16 grid max-w-5xl gap-4 md:grid-cols-3"
        >
          <div className="md:col-span-2 glass-card p-6">
            <p className="kpi-label">Revenue Projection</p>
            <h2 className="mt-2 text-4xl font-bold tracking-tight">$2.4M</h2>
            <p className="mt-1 text-xs text-emerald-400">↗ +12.4% vs last month</p>
            <div className="relative mt-6 h-32 overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent">
              <svg viewBox="0 0 400 120" className="absolute inset-0 h-full w-full">
                <defs>
                  <linearGradient id="lp-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M 0 100 C 40 95, 80 92, 120 78 S 200 60, 240 50 S 320 30, 400 10"
                  stroke="#34d399"
                  strokeWidth="2"
                  fill="none"
                />
                <path
                  d="M 0 100 C 40 95, 80 92, 120 78 S 200 60, 240 50 S 320 30, 400 10 L 400 120 L 0 120 Z"
                  fill="url(#lp-grad)"
                />
              </svg>
            </div>
          </div>
          <div className="space-y-4">
            <div className="glass-card p-4">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-violet-300 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-violet-300">AI Insight: </span>
                  Restock "Azure Knitwear" — predictive demand spikes 24% next quarter.
                </p>
              </div>
            </div>
            <div className="glass-card p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Customer Retention
              </p>
              <p className="mt-1 text-2xl font-bold">88.2%</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
                <div className="h-full w-[88%] rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" />
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative mx-auto max-w-7xl px-6 pb-24">
        <div className="mb-10">
          <h2 className="text-3xl font-bold tracking-tight">Precision Driven Intelligence</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Every click, every purchase, every interaction analyzed in real-time
            to give you the competitive edge.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Real-time KPI Tracking */}
          <div className="glass-card p-6">
            <LineChart className="h-5 w-5 text-emerald-400" />
            <h3 className="mt-4 text-lg font-semibold">Real-time KPI Tracking</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Monitor your store's heartbeat with millisecond latency. Conversion
              rates, AOV, and churn with surgical precision.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <StatBlock label="AOV" value="$142.50" accent="text-emerald-400" />
              <StatBlock label="Conversion" value="3.8%" accent="text-emerald-400" />
              <StatBlock label="Active Users" value="12.4k" accent="text-foreground" />
              <StatBlock label="Churn Rate" value="0.4%" accent="text-red-400" />
            </div>
          </div>

          {/* Predictive Modeling */}
          <div className="glass-card p-6 bg-gradient-to-br from-violet-500/[0.07] to-transparent">
            <Brain className="h-5 w-5 text-violet-300" />
            <h3 className="mt-4 text-lg font-semibold">Predictive Modeling</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Anticipate market shifts before they happen. Our PySpark MLlib
              models predict seasonal trends with 94.2% accuracy.
            </p>
            <div className="mt-5 rounded-xl border border-white/5 bg-surface-2/60 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Predicting Winter Drop…</span>
                <span className="font-semibold text-violet-300">94.2%</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
                <div className="h-full w-[94%] rounded-full bg-gradient-to-r from-violet-400 to-violet-600 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Adaptive Interface */}
          <div className="glass-card p-6">
            <Palette className="h-5 w-5 text-emerald-400" />
            <h3 className="mt-4 text-lg font-semibold">Adaptive Interface</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Beautifully dark for focused analysis, elegantly light for
              executive reporting.
            </p>
            <div className="mt-5 inline-flex rounded-lg border border-white/5 bg-surface-2 p-1">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-3 px-3 py-1 text-xs">
                <Moon className="h-3 w-3 text-emerald-300" /> Dark
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs text-muted-foreground">
                <Sun className="h-3 w-3" /> Light
              </span>
            </div>
          </div>

          {/* Optimal Product Mix */}
          <div className="glass-card p-6">
            <Package className="h-5 w-5 text-emerald-400" />
            <h3 className="mt-4 text-lg font-semibold">Optimal Product Mix</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Automatically adjust inventory levels based on hyper-local demand
              and social sentiment analysis.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium">+24% inventory turnover</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative mx-auto max-w-7xl px-6 pb-24 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight">
            Ready to transform your retail data?
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Join the 500+ enterprise brands scaling their operations with Quantuma AI.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-black hover:bg-emerald-400 transition shadow-glow"
            >
              Get Started Now <ArrowRight className="h-4 w-4" />
            </Link>
            <a className="text-sm text-muted-foreground hover:text-foreground cursor-pointer">
              Talk to Sales
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative mx-auto max-w-7xl px-6 pb-10 border-t border-white/[0.06] pt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs text-muted-foreground">
        <div>
          <span className="font-semibold text-foreground">Quantuma AI</span> · © 2026 Quantuma Analytics. Precision Driven Intelligence.
        </div>
        <div className="flex gap-5">
          <a className="hover:text-foreground cursor-pointer">Privacy</a>
          <a className="hover:text-foreground cursor-pointer">Terms</a>
          <a className="hover:text-foreground cursor-pointer">API Docs</a>
          <a className="hover:text-foreground cursor-pointer">Support</a>
        </div>
      </footer>
    </div>
  );
}
