import { createClient } from "@supabase/supabase-js";

/**
 * Single shared Supabase client for the whole React app.
 *
 * Why a singleton?
 *  - Supabase advises against creating multiple clients per page — multiple
 *    instances will spawn duplicate auth state listeners and may compete for
 *    the same localStorage session key.
 *  - One module-level instance gives us one source of truth, which `AuthContext`
 *    subscribes to on app start.
 *
 * Env vars (Vite exposes anything prefixed with VITE_ to the browser bundle):
 *   VITE_SUPABASE_URL       — your project URL, e.g. https://abcd1234.supabase.co
 *   VITE_SUPABASE_ANON_KEY  — the public "anon" key (safe to ship to the client;
 *                              Row Level Security policies enforce real auth)
 *
 * Both values come from your Supabase dashboard → Project Settings → API.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly in dev. If this fires you almost certainly forgot to create
  // `.env.local` from `.env.local.example` (and restart `npm run dev`).
  // eslint-disable-next-line no-console
  console.error(
    "[Quantuma] Supabase env vars are missing.\n" +
      "  Expected: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY\n" +
      "  Fix: copy frontend/.env.local.example to frontend/.env.local,\n" +
      "       paste your values from supabase.com → Project Settings → API,\n" +
      "       then restart `npm run dev`."
  );
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  auth: {
    // Persist the session in localStorage so a refresh keeps the user signed in.
    persistSession: true,
    // Auto-refresh access tokens in the background before they expire.
    autoRefreshToken: true,
    // Parse the auth fragment in URLs (used for OAuth + email-link callbacks).
    detectSessionInUrl: true,
    storageKey: "quantuma-auth",
  },
});

export default supabase;
