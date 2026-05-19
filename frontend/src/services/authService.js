import { supabase } from "./supabaseClient";

/**
 * authService — every auth interaction the UI needs, in one place.
 *
 * The rest of the app imports from here instead of touching `supabase.auth`
 * directly. That gives us:
 *   - One spot to add logging / analytics later.
 *   - A stable shape (`{ data, error }`) regardless of how the underlying
 *     SDK changes.
 *   - A clean seam for tests (swap this module out, the components don't care).
 */

/* ─────────────────────────── Sign in ─────────────────────────── */

/**
 * Email + password sign-in.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ data: any, error: Error|null }>}
 */
export async function signInWithEmail(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

/**
 * Google OAuth sign-in. Redirects to Google, then back to /dashboard.
 * Phase 4 prereq: enable the Google provider in Supabase → Authentication →
 * Providers, and add `http://localhost:5173/dashboard` to your Redirect URLs.
 */
export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/dashboard`,
    },
  });
}

/* ─────────────────────────── Sign up ─────────────────────────── */

/**
 * Create a new account with email + password.
 * Supabase will email a confirmation link by default; in dev you can disable
 * "Confirm email" under Authentication → Providers → Email to skip that.
 */
export async function signUpWithEmail(email, password, metadata = {}) {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata, // becomes auth.users.raw_user_meta_data
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
}

/* ─────────────────────────── Sign out ────────────────────────── */

export async function signOut() {
  return supabase.auth.signOut();
}

/* ─────────────────────────── Session helpers ─────────────────── */

/** Returns the current session synchronously from cache, or null. */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session ?? null;
}

/** Returns the currently signed-in user object, or null. */
export async function getUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}

/**
 * Subscribe to auth changes (sign-in, sign-out, token refresh).
 * Returns an unsubscribe function so callers can clean up in useEffect.
 *
 * @param {(event: string, session: any) => void} callback
 * @returns {() => void} unsubscribe
 */
export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return () => data.subscription.unsubscribe();
}

/* ─────────────────────────── Password reset ──────────────────── */

/** Sends a password-reset email. Not wired to a UI yet — kept for Phase 10. */
export async function sendPasswordReset(email) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login`,
  });
}
