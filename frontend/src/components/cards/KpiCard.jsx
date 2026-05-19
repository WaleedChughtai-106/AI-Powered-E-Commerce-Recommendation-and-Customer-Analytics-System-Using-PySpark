import { TrendingUp, TrendingDown, Wallet, ShoppingBag, Receipt } from "lucide-react";
import { formatCurrency, formatNumber, formatPercent } from "@/utils/formatters";
import { cn } from "@/lib/utils";

/**
 * KpiCard — floating premium card with subtle hover lift.
 *
 * Uses .glass-card + .glass-card-hover so the elevation, border, shadow and
 * hover state come straight from the design system. The accent bar at the
 * bottom is the only place we still hand-pick a colour — using brand tokens
 * for consistency.
 */

const ICON_MAP = {
  wallet: Wallet,
  "shopping-bag": ShoppingBag,
  receipt: Receipt,
  "trending-up": TrendingUp,
};

const ACCENT_BAR = {
  emerald: "from-brand-mint to-brand-deep",
  blue:    "from-blue-400 to-blue-600",
  purple:  "from-violet-400 to-violet-600",
  coral:   "from-red-400 to-red-600",
};

export default function KpiCard({ label, value, change, type = "number", icon = "wallet", accent = "emerald" }) {
  const Icon = ICON_MAP[icon] || Wallet;
  const display =
    type === "currency" ? formatCurrency(value)
    : type === "percent" ? `${value}%`
    : formatNumber(value);

  const positive = change >= 0;
  const ChangeIcon = positive ? TrendingUp : TrendingDown;

  return (
    <div className="glass-card glass-card-hover relative overflow-hidden p-5 group">
      {/* Soft emerald ambient inside the card itself, brighter on hover. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 -right-8 h-32 w-32 rounded-full opacity-40 group-hover:opacity-60 transition-opacity"
        style={{
          background: "radial-gradient(circle, var(--brand-glow) 0%, transparent 70%)",
          filter: "blur(20px)",
        }}
      />

      <div className="relative flex items-start justify-between">
        <p className="kpi-label">{label}</p>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{
            background: "var(--brand-glow-soft)",
            boxShadow: "inset 0 0 0 1px var(--border-subtle)",
          }}
        >
          <Icon className="h-4 w-4" style={{ color: "var(--brand-deep)" }} />
        </div>
      </div>

      <div className="relative mt-4 flex items-end justify-between">
        <div className="kpi-value">{display}</div>
        <div
          className={cn(
            "flex items-center gap-1 text-xs font-semibold",
            positive ? "text-emerald-500" : "text-red-500"
          )}
        >
          <ChangeIcon className="h-3 w-3" />
          {formatPercent(change, 0)}
        </div>
      </div>

      {/* Accent gradient bar */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r",
          ACCENT_BAR[accent] || ACCENT_BAR.emerald
        )}
      />
    </div>
  );
}
