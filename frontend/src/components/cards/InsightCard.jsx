import { cn } from "@/lib/utils";

/**
 * InsightCard — generic card wrapper used across every dashboard page.
 *
 * Uses .glass-card from the design system so the surface, border, shadow
 * and hover behaviour are consistent across light/dark themes. The
 * `icon` + `iconAccent` props add a coloured ring badge in the header
 * for "branded" sections like Performance Matrix or AI rationale cards.
 */
export default function InsightCard({
  title,
  subtitle,
  action,
  icon: Icon,
  iconAccent = "emerald",
  className,
  children,
}) {
  const ACCENTS = {
    emerald: "bg-emerald-500/10 ring-emerald-500/30 text-emerald-600 dark:text-emerald-400",
    purple:  "bg-violet-500/10 ring-violet-500/30 text-violet-600 dark:text-violet-300",
    blue:    "bg-blue-500/10 ring-blue-500/30 text-blue-600 dark:text-blue-300",
    coral:   "bg-red-500/10 ring-red-500/30 text-red-500 dark:text-red-400",
    amber:   "bg-amber-500/10 ring-amber-500/30 text-amber-600 dark:text-amber-300",
  };
  const accentClass = ACCENTS[iconAccent] ?? ACCENTS.emerald;

  return (
    <div className={cn("glass-card p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl ring-1", accentClass)}>
              <Icon className="h-4 w-4" />
            </div>
          )}
          <div>
            <h3 className="section-title">{title}</h3>
            {subtitle && <p className="section-subtitle mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}
