import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, BrainCog, CheckCircle2, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import AuthLayout from "@/layouts/AuthLayout";
import { useAuth } from "@/context/AuthContext";
import { signUpWithEmail } from "@/services/authService";

export default function SignupPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmEmailSent, setConfirmEmailSent] = useState(false);

  // If they're already signed in, kick them to the dashboard.
  useEffect(() => {
    if (!authLoading && session) navigate("/dashboard", { replace: true });
  }, [authLoading, session, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);

    const { data, error } = await signUpWithEmail(email.trim(), password, {
      full_name: fullName.trim(),
    });

    if (error) {
      setErrorMsg(error.message || "Unable to create account.");
      setSubmitting(false);
      return;
    }

    // Two possible outcomes from Supabase:
    //   1) "Confirm email" is ON  → user.session is null until they click the link.
    //   2) "Confirm email" is OFF → we get a session back and can navigate immediately.
    if (data?.session) {
      navigate("/dashboard", { replace: true });
    } else {
      setConfirmEmailSent(true);
      setSubmitting(false);
    }
  };

  // Post-signup confirmation screen
  if (confirmEmailSent) {
    return (
      <AuthLayout>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card relative w-full max-w-md p-8 text-center"
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/40">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Check your inbox</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a confirmation link to{" "}
            <span className="font-semibold text-foreground">{email}</span>.
            Click it to activate your account, then sign in.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-emerald-500 text-sm font-semibold text-black hover:bg-emerald-400 transition"
          >
            Back to Sign In
          </Link>
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
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/40">
            <BrainCog className="h-5 w-5 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Request Access</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your Quantuma AI workspace
          </p>
        </div>

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
          {/* Full Name */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Full Name</label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Thompson"
                className="h-11 w-full rounded-xl border border-white/[0.06] bg-surface-1 pl-10 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
                required
                autoComplete="name"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Email Address</label>
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
            <label className="mb-1.5 block text-xs font-medium text-foreground">Password</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="h-11 w-full rounded-xl border border-white/[0.06] bg-surface-1 pl-10 pr-10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
                required
                minLength={6}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Supabase enforces a 6-character minimum. Use a passphrase you'll remember.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 h-11 w-full rounded-xl bg-emerald-500 text-sm font-semibold text-black hover:bg-emerald-400 transition disabled:opacity-60"
          >
            {submitting ? "Creating workspace…" : "Create Account"}
          </button>

          <p className="pt-2 text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-emerald-400 hover:text-emerald-300">
              Sign In
            </Link>
          </p>
        </form>
      </motion.div>
    </AuthLayout>
  );
}
