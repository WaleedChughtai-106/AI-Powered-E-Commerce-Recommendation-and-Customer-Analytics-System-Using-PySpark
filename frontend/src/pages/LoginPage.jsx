import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, BrainCog, Eye, EyeOff, Lock, Mail } from "lucide-react";
import AuthLayout from "@/layouts/AuthLayout";
import { useAuth } from "@/context/AuthContext";
import { signInWithEmail } from "@/services/authService";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  // Where to send the user after successful auth. ProtectedLayout sets
  // location.state.from when it bounced them here. Default to /dashboard.
  const redirectTo = location.state?.from || "/dashboard";

  // If the user is already signed in (e.g. they hit /login by mistake),
  // skip straight to the dashboard.
  useEffect(() => {
    if (!authLoading && session) {
      navigate(redirectTo, { replace: true });
    }
  }, [authLoading, session, redirectTo, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);

    const { error } = await signInWithEmail(email.trim(), password);

    if (error) {
      // Supabase returns a useful message ("Invalid login credentials",
      // "Email not confirmed", etc.) — pass it through.
      setErrorMsg(error.message || "Unable to sign in. Please try again.");
      setSubmitting(false);
      return;
    }

    // AuthContext's onAuthStateChange listener will update session state,
    // but we navigate immediately so the user doesn't see a flicker.
    navigate(redirectTo, { replace: true });
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setSubmitting(true);
    const { sendPasswordReset } = await import("@/services/authService");
    const { error } = await sendPasswordReset(forgotEmail.trim());
    setSubmitting(false);
    if (error) {
      setErrorMsg(error.message || "Unable to send reset email.");
    } else {
      setForgotSent(true);
    }
  };

  if (forgotMode) {
    return (
      <AuthLayout>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-card relative w-full max-w-md p-8"
        >
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/40">
              <BrainCog className="h-5 w-5 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Reset Password</h1>
            <p className="mt-1 text-sm text-muted-foreground">Enter your email to receive a reset link.</p>
          </div>
          {forgotSent ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              ✓ Check your inbox — reset link sent to <strong>{forgotEmail}</strong>.
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              {errorMsg && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-xs font-medium">Email Address</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="name@company.ai"
                    className="h-11 w-full rounded-xl border border-white/[0.06] bg-surface-1 pl-10 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="mt-1 h-11 w-full rounded-xl bg-emerald-500 text-sm font-semibold text-black hover:bg-emerald-400 transition disabled:opacity-60"
              >
                {submitting ? "Sending…" : "Send Reset Link"}
              </button>
            </form>
          )}
          <button
            onClick={() => { setForgotMode(false); setForgotSent(false); setErrorMsg(""); }}
            className="mt-4 w-full text-center text-xs text-emerald-400 hover:text-emerald-300"
          >
            ← Back to Sign In
          </button>
        </motion.div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass-card relative w-full max-w-md p-8"
      >
        {/* Logo */}
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/40">
            <BrainCog className="h-5 w-5 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Quantuma AI</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enterprise Analytics Intelligence
          </p>
        </div>

        {/* Error banner */}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Email Address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.ai"
                className="h-11 w-full rounded-xl border border-white/[0.06] bg-surface-1 pl-10 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
                required
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">Password</label>
              <button
                type="button"
                onClick={() => { setForgotMode(true); setErrorMsg(""); }}
                className="text-xs text-emerald-400 hover:text-emerald-300"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 w-full rounded-xl border border-white/[0.06] bg-surface-1 pl-10 pr-10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
                required
                minLength={6}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="mt-1 h-11 w-full rounded-xl bg-emerald-500 text-sm font-semibold text-black hover:bg-emerald-400 transition disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign In"}
          </button>

          <p className="pt-2 text-center text-xs text-muted-foreground">
            New to the platform?{" "}
            <Link to="/signup" className="font-semibold text-emerald-400 hover:text-emerald-300">
              Request Access
            </Link>
          </p>
        </form>
      </motion.div>
    </AuthLayout>
  );
}
