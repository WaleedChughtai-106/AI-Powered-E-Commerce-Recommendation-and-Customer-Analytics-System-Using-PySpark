/**
 * Centralised formatting helpers. Keeps display logic out of components.
 */

export const formatCurrency = (value, currency = "USD", compact = true) => {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: compact && Math.abs(value) >= 1000 ? "compact" : "standard",
    maximumFractionDigits: compact && Math.abs(value) >= 1000 ? 1 : 2,
  }).format(value);
};

export const formatNumber = (value, compact = true) => {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: compact && Math.abs(value) >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
};

export const formatPercent = (value, decimals = 1, withSign = true) => {
  if (value === null || value === undefined) return "—";
  const sign = withSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
};

export const formatDate = (date, opts = { dateStyle: "medium" }) => {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", opts).format(d);
};

export const formatShortDate = (date) =>
  formatDate(date, { month: "short", day: "numeric", year: "numeric" });

export const formatRelativeTime = (date) => {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr${diffHr > 1 ? "s" : ""} ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;
};
