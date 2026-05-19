/**
 * Small helpers for deriving display info from a Supabase user object.
 *
 * Supabase stores arbitrary metadata under `user.user_metadata`. When users
 * sign up via the SignupPage we tuck `full_name` in there; OAuth providers
 * usually supply `full_name` and `avatar_url` for free.
 */

export function getDisplayName(user) {
  if (!user) return "";
  const meta = user.user_metadata || {};
  return (
    meta.full_name ||
    meta.name ||
    meta.user_name ||
    (user.email ? user.email.split("@")[0] : "User")
  );
}

export function getInitials(user) {
  const name = getDisplayName(user) || "";
  const trimmed = name.trim();
  if (!trimmed) return "Q"; // Quantuma fallback
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getAvatarUrl(user) {
  if (!user) return null;
  const meta = user.user_metadata || {};
  return meta.avatar_url || meta.picture || null;
}
