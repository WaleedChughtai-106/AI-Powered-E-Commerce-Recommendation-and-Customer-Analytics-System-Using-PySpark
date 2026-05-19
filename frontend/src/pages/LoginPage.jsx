import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, BrainCog, Eye, EyeOff, Lock, Mail } from "lucide-react";
import AuthLayout from "@/layouts/AuthLayout";
import { useAuth } from "@/context/AuthContext";
import { signInWithEmail, signInWithGoogle } from "@/services/authService";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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

  const handleGoogle = async () => {
    setErrorMsg("");
    const { error } = await signInWithGoogle();
    // signInWithOAuth resolves *before* the redirect, so we only land here
    // if the redirect failed to start (typically a config issue).
    if (error) {
      setErrorMsg(error.message || "Google sign-in failed.");
    }
  };

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
              <a className="text-xs text-emerald-400 hover:text-emerald-300 cursor-pointer">
                Forgot password?
              </a>
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

          {/* Divider */}
          <div className="my-2 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-white/[0.08]" />
            <span>Or continue with</span>
            <div className="h-px flex-1 bg-white/[0.08]" />
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-surface-1 text-sm font-medium hover:bg-surface-2 transition"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
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
