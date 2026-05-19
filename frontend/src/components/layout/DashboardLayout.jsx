import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

/**
 * DashboardLayout — every authenticated route renders inside this shell.
 *
 * Visual structure (back to front):
 *   1. Fixed mesh-gradient page background (ambient-mesh) — drifts behind
 *      everything. Reads emerald-tinted in light mode, deeper emerald in dark.
 *   2. Two floating blur orbs (orb-emerald + orb-mint), one at top-left and
 *      one at top-right, animated with `orb-drift`. These create the
 *      "expensive AI platform" depth without being noisy.
 *   3. Sidebar + Topbar on top, both frosted glass so the orbs show through.
 *   4. Page <main> content above everything else.
 *
 * Why no `bg-emerald-glow` like before? That gradient was hard-coded for the
 * dark theme. The new `ambient-mesh` + theme-aware orb colours produce the
 * right look in both themes from a single source.
 */
export default function DashboardLayout({ children }) {
  return (
    <div className="relative min-h-screen w-full bg-background text-foreground flex overflow-hidden">

      {/* 1. Ambient mesh — fills the whole viewport */}
      <div className="pointer-events-none absolute inset-0 ambient-mesh" />

      {/* 2. Floating orbs */}
      <div className="orb orb-emerald orb-drift"
           style={{ width: 480, height: 480, top: -160, left: -120 }} />
      <div className="orb orb-mint orb-drift"
           style={{ width: 420, height: 420, top: -120, right: -100, animationDelay: "-6s" }} />
      <div className="orb orb-neon orb-drift"
           style={{ width: 360, height: 360, bottom: -180, right: 80, animationDelay: "-12s", opacity: 0.5 }} />

      <Sidebar />

      <div className="relative flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 md:px-8 py-6 md:py-10 animate-fade-in">
          {children}
        </main>
        <footer
          className="px-4 md:px-8 py-6 text-xs flex flex-col md:flex-row md:items-center md:justify-between gap-2"
          style={{
            borderTop: "1px solid var(--border-subtle)",
            color: "var(--text-secondary)",
          }}
        >
          <div>
            <span className="font-semibold" style={{ color: "var(--text-strong)" }}>
              Quantuma AI
            </span>
            <span className="ml-2">© 2026 Quantuma Analytics. Precision Driven Intelligence.</span>
          </div>
          <div className="flex gap-5">
            <a className="hover:opacity-80 cursor-pointer transition-opacity">Privacy Policy</a>
            <a className="hover:opacity-80 cursor-pointer transition-opacity">Terms of Service</a>
            <a className="hover:opacity-80 cursor-pointer transition-opacity">API Documentation</a>
            <a className="hover:opacity-80 cursor-pointer transition-opacity">Contact Support</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
