import { NavLink, useNavigate } from "react-router-dom";
import { BrainCog, LogOut, Moon, Sun } from "lucide-react";
import { NAV_ITEMS } from "@/utils/constants";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

/**
 * Sidebar — frosted-glass shell in both themes.
 *
 * Design notes:
 *   - In LIGHT mode the sidebar reads as a translucent white pane floating
 *     above the page mesh; the active nav item glows softly in deep emerald.
 *   - In DARK mode it stays the familiar near-black with mint-glow active.
 *   - All colour decisions are routed through the design-system utility
 *     classes (.glass-sidebar, .nav-item, .nav-item-active, .btn-primary,
 *     .btn-ghost). No hard-coded white/[0.06] borders, so the look swaps
 *     automatically when ThemeProvider flips the root class.
 */
export default function Sidebar() {
  const { theme, toggleTheme } = useTheme();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="glass-sidebar hidden md:flex h-screen w-64 flex-col sticky top-0 z-20">
      {/* Brand */}
      <div className="flex items-center gap-2 px-6 pt-6 pb-8">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-gradient shadow-[0_8px_20px_-6px_rgba(16,185,129,0.55)] ring-1 ring-emerald-500/30">
          <BrainCog className="h-4 w-4 text-white" />
        </div>
        <div className="leading-tight">
          <div className="text-lg font-bold tracking-tight bg-gradient-to-br from-brand-mint via-brand-emerald to-brand-deep bg-clip-text text-transparent">
            Quantuma AI
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn("nav-item", isActive && "nav-item-active")
            }
          >
            <item.icon
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                "group-hover:scale-110"
              )}
            />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Theme / Sign out */}
      <div className="px-3 py-3 space-y-1" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <button onClick={toggleTheme} className="nav-item w-full">
          {theme === "dark" ? (
            <>
              <Moon className="h-4 w-4 text-emerald-400" /> Dark
            </>
          ) : (
            <>
              <Sun className="h-4 w-4 text-amber-500" /> Light
            </>
          )}
        </button>
        <button
          onClick={handleSignOut}
          className="nav-item w-full hover:!bg-red-500/10 hover:!text-red-500"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
