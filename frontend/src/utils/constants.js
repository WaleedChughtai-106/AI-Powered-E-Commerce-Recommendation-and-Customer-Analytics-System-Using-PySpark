import {
  LayoutDashboard,
  TrendingUp,
  Users,
  Package,
  Sparkles,
  Activity,
  BrainCircuit,
  Settings,
} from "lucide-react";

/**
 * Sidebar navigation items. Single source of truth used by Sidebar.jsx.
 */
export const NAV_ITEMS = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Sales Analytics", path: "/sales", icon: TrendingUp },
  { label: "Customers", path: "/customers", icon: Users },
  { label: "Products", path: "/products", icon: Package },
  { label: "Recommendations", path: "/recommendations", icon: Sparkles },
  { label: "Visualization", path: "/visualization", icon: Activity },
  { label: "AI Insights", path: "/ml-insights", icon: BrainCircuit },
  { label: "Settings", path: "/settings", icon: Settings },
];

/** Brand colors used by Recharts components. Keep in sync with tailwind.config.js. */
export const CHART_COLORS = {
  emerald: "#10b981",
  mint: "#34d399",
  neon: "#6ee7b7",
  purple: "#a78bfa",
  blue: "#60a5fa",
  coral: "#f87171",
  amber: "#fbbf24",
  muted: "#475569",
};

export const SEGMENT_COLORS = {
  VIP: "#10b981",
  Loyal: "#60a5fa",
  "At Risk": "#f87171",
  New: "#a78bfa",
};
