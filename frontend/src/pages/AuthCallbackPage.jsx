import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BrainCog, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/services/supabaseClient";
import AuthLayout from "@/layouts/AuthLayout";

/**
 * AuthCallbackPage
 * ─────────────────
 * Supabase redirects the user here after they click the email-confirmation
 * link. The URL arrives with a `token_hash` + `type` query param (PKCE flow)
 * or an access_token hash fragment (implicit flow).
 *
 * `detectSessionInUrl: true` in supabaseClient already fires an
 * onAuthStateChange event, but we also call verifyOtp explicitly so we can
 * show a proper success / error state before navigating.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // "loading" | "success" | "error"
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function handleCallback() {
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const type = params.get("type"); // "signup" | "recovery" | "email_change"
      const errorDesc = params.get("error_description");

      // Handle error from Supabase redirect
      if (errorDesc) {
        setStatus("error");
        setMessage(decodeURIComponent(errorDesc).replace(/\+/g, " "));
        return;
      }

      // PKCE / OTP flow: token_hash present
      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) {
          setStatus("error");
          setMessage(error.message || "The confirmation link is invalid or has expired.");
          return;
        }
        setStatus("success");
        setTimeout(() => navigate("/dashboard", { replace: true }), 1800);
        return;
      }

      // Implicit flow: access_token in hash — detectSessionInUrl handles it
      // automatically, so just wait for the session to appear.
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        setStatus("success");
        setTimeout(() => navigate("/dashboard", { replace: true }), 1800);
        return;
      }

      // Nothing matched — send back to login
      setStatus("error");
      setMessage("No confirmation token found. Please try signing up again.");
    }

    handleCallback();
  }, [navigate]);

  return (
    <AuthLayout>
      <div className="glass-card w-full max-w-md p-8 text-center">
        {status === "loading" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/40 animate-pulse">
              <BrainCog className="h-5 w-5 text-emerald-400" />
            </div>
            <h1 className="text-xl font-bold">Verifying your account…</h1>
            <p className="mt-2 text-sm text-muted-foreground">Please wait a moment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/40">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
            <h1 className="text-xl font-bold text-emerald-400">Account confirmed!</h1>
            <p className="mt-2 text-sm text-muted-foreground">Redirecting you to the dashboard…</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/15 ring-1 ring-red-500/40">
              <XCircle className="h-5 w-5 text-red-400" />
            </div>
            <h1 className="text-xl font-bold text-red-400">Verification failed</h1>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
            <button
              onClick={() => navigate("/login", { replace: true })}
              className="mt-6 h-11 w-full rounded-xl bg-emerald-500 text-sm font-semibold text-black hover:bg-emerald-400 transition"
            >
              Back to Sign In
            </button>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
