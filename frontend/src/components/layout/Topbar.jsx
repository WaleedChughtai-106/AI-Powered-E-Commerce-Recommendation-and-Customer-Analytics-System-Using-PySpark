import { Bell, Calendar, Search, Contrast } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { getAvatarUrl, getInitials } from "@/utils/user";

/**
 * Topbar — sticky frosted-glass header bar.
 *
 * Theme-aware via .glass-topbar / .glass-input / .btn-secondary utilities.
 * The notification dot pulses softly so the eye notices it without being
 * loud — `pulse-soft` keyframe lives in index.css.
 */
export default function Topbar({ searchPlaceholder = "Search analytics..." }) {
  const { toggleTheme } = useTheme();
  const { user } = useAuth();

  const initials = getInitials(user);
  const avatarUrl = getAvatarUrl(user);

  return (
    <header className="glass-topbar sticky top-0 z-30 flex h-16 items-center gap-4 px-4 md:px-8">
      {/* Search */}
      <div className="relative flex-1 max-w-2xl">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: "var(--text-muted)" }}
        />
        <input
          type="text"
          placeholder={searchPlaceholder}
          className="glass-input h-10"
        />
      </div>

      {/* Date range */}
      <button className="btn-secondary hidden md:inline-flex">
        <Calendar className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
        Last 30 Days
      </button>

      {/* Notifications */}
      <button className="btn-secondary relative !p-0 h-10 w-10">
        <Bell className="h-4 w-4" />
        <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-brand-emerald pulse-soft shadow-[0_0_10px_rgba(16,185,129,0.7)]" />
      </button>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="btn-secondary !p-0 h-10 w-10"
        aria-label="Toggle theme"
      >
        <Contrast className="h-4 w-4" />
      </button>

      {/* Avatar — real user from Supabase session */}
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
