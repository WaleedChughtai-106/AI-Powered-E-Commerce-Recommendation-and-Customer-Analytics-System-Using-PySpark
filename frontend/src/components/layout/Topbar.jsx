import { useRef, useState } from "react";
import { Bell, Calendar, Contrast, ChevronDown, X } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useDashboard } from "@/context/DashboardContext";
import { getAvatarUrl, getInitials } from "@/utils/user";
import { cn } from "@/lib/utils";

const DATE_RANGES = [
  "Last 7 Days",
  "Last 30 Days",
  "Last 3 Months",
  "Last 6 Months",
  "Last 12 Months",
  "All Time",
];

/**
 * Topbar — sticky frosted-glass header bar.
 *
 * Search wires into DashboardContext so all pages can filter their content.
 * Date range shows a preset dropdown; the selection is stored in context so
 * pages can display or use it.
 */
export default function Topbar() {
  const { toggleTheme } = useTheme();
  const { user } = useAuth();
  const { dateRange, setDateRange } = useDashboard();

  const [dateOpen, setDateOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const dateRef = useRef(null);
  const notifRef = useRef(null);

  const initials = getInitials(user);
  const avatarUrl = getAvatarUrl(user);

  const selectRange = (r) => {
    setDateRange(r);
    setDateOpen(false);
  };

  return (
    <header className="glass-topbar sticky top-0 z-30 flex h-16 items-center justify-end gap-4 px-4 md:px-8">

      {/* Date range picker */}
      <div className="relative hidden md:block" ref={dateRef}>
        <button
          onClick={() => setDateOpen((o) => !o)}
          className="btn-secondary inline-flex items-center gap-2"
        >
          <Calendar className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
          <span>{dateRange}</span>
          <ChevronDown className={cn("h-3 w-3 transition-transform", dateOpen && "rotate-180")} style={{ color: "var(--text-muted)" }} />
        </button>

        {dateOpen && (
          <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-white/[0.08] bg-surface-2 py-1 shadow-card z-50">
            {DATE_RANGES.map((r) => (
              <button
                key={r}
                onClick={() => selectRange(r)}
                className={cn(
                  "w-full px-4 py-2 text-left text-sm transition hover:bg-surface-3",
                  r === dateRange ? "text-emerald-400 font-semibold" : "text-foreground"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Notifications */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setNotifOpen((o) => !o)}
          className="btn-secondary relative !p-0 h-10 w-10"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-brand-emerald pulse-soft shadow-[0_0_10px_rgba(16,185,129,0.7)]" />
        </button>

        {notifOpen && (
          <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-white/[0.08] bg-surface-2 shadow-card z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <p className="text-sm font-semibold">Notifications</p>
              <button onClick={() => setNotifOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="py-2 space-y-1">
              {[
                { title: "Electronics up 18%", time: "2m ago", color: "emerald" },
                { title: "22,772 at-risk customers", time: "1h ago", color: "amber" },
                { title: "ALS model retrained", time: "19h ago", color: "blue" },
              ].map((n) => (
                <div key={n.title} className="flex items-start gap-3 px-4 py-2.5 hover:bg-surface-3 transition cursor-pointer">
                  <span className={cn(
                    "mt-1 h-2 w-2 rounded-full shrink-0",
                    n.color === "emerald" && "bg-emerald-400",
                    n.color === "amber" && "bg-amber-400",
                    n.color === "blue" && "bg-blue-400",
                  )} />
                  <div>
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-white/[0.06] px-4 py-2.5">
              <button
                onClick={() => setNotifOpen(false)}
                className="text-xs text-emerald-400 hover:text-emerald-300"
              >
                Mark all as read
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="btn-secondary !p-0 h-10 w-10"
        aria-label="Toggle theme"
      >
        <Contrast className="h-4 w-4" />
      </button>

      {/* Avatar */}
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={initials}
          className="h-9 w-9 rounded-full ring-2 ring-brand-emerald/40 object-cover shadow-[0_0_0_4px_rgba(52,211,153,0.10)]"
        />
      ) : (
        <div className="h-9 w-9 rounded-full bg-emerald-gradient ring-2 ring-brand-emerald/40 shadow-[0_0_0_4px_rgba(52,211,153,0.10)] flex items-center justify-center text-xs font-bold text-white">
          {initials}
        </div>
      )}
    </header>
  );
}
