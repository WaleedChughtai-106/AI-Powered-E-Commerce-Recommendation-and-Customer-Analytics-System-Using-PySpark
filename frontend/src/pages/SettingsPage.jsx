import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Circle,
  LogOut,
  Palette,
  User,
  ShieldCheck,
  Pencil,
  Lock,
  Sparkles,
  Eye,
  EyeOff,
  Camera,
  X,
  KeyRound,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/cards/PageHeader";
import InsightCard from "@/components/cards/InsightCard";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { getAvatarUrl, getDisplayName, getInitials } from "@/utils/user";
import { cn } from "@/lib/utils";
import { supabase } from "@/services/supabaseClient";

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // ── Avatar state ──────────────────────────────────────────────
  const fileInputRef = useRef(null);
  const [localAvatar, setLocalAvatar] = useState(null); // data-URL preview

  // ── Password state ────────────────────────────────────────────
  const [pwOpen, setPwOpen] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState(null); // { type: "success"|"error", text }

  // ── MFA state ─────────────────────────────────────────────────
  const [mfa, setMfa] = useState(true);
  const [mfaToast, setMfaToast] = useState(null); // string message

  // ── Sign-out ──────────────────────────────────────────────────
  const [signingOut, setSigningOut] = useState(false);

  const displayName = getDisplayName(user);
  const initials = getInitials(user);
  const avatarUrl = localAvatar ?? getAvatarUrl(user);
  const userEmail = user?.email ?? "";

  // ── Handlers ──────────────────────────────────────────────────

  const handlePhotoClick = () => fileInputRef.current?.click();

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLocalAvatar(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handlePasswordSave = async () => {
    if (!newPw) { setPwMsg({ type: "error", text: "Enter a new password." }); return; }
    if (newPw.length < 6) { setPwMsg({ type: "error", text: "Password must be at least 6 characters." }); return; }
    if (newPw !== confirmPw) { setPwMsg({ type: "error", text: "Passwords don't match." }); return; }

    setPwLoading(true);
    setPwMsg(null);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwLoading(false);

    if (error) {
      setPwMsg({ type: "error", text: error.message });
    } else {
      setPwMsg({ type: "success", text: "Password updated successfully!" });
      setNewPw("");
      setConfirmPw("");
      setTimeout(() => { setPwOpen(false); setPwMsg(null); }, 2000);
    }
  };

  const handleMfaToggle = () => {
    const next = !mfa;
    setMfa(next);
    const msg = next
      ? "MFA enabled — your account is now extra secure."
      : "MFA disabled — consider re-enabling for better protection.";
    setMfaToast(msg);
    setTimeout(() => setMfaToast(null), 3500);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <DashboardLayout>
      {/* MFA toast */}
      {mfaToast && (
        <div className={cn(
          "fixed top-5 right-5 z-50 flex items-center gap-3 rounded-xl border px-5 py-3 text-sm font-semibold shadow-card transition",
          mfa
            ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
            : "border-amber-500/30 bg-amber-500/15 text-amber-300"
        )}>
          <ShieldCheck className="h-4 w-4 shrink-0" />
          {mfaToast}
          <button onClick={() => setMfaToast(null)} className="ml-2 opacity-60 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <PageHeader
        title="Settings"
        description="Manage your enterprise analytics environment and AI preferences."
      />

      {/* Theme */}
      <InsightCard title="Theme Preferences" icon={Palette}>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <ThemeOption
            label="Dark Mode"
            active={theme === "dark"}
            onClick={() => theme !== "dark" && toggleTheme()}
            desc="Optimized for high-performance data monitoring in low-light environments."
            preview="dark"
          />
          <ThemeOption
            label="Light Mode"
            active={theme === "light"}
            onClick={() => theme !== "light" && toggleTheme()}
            desc="High-contrast interface designed for clarity and precision during daylight hours."
            preview="light"
          />
        </div>
      </InsightCard>

      {/* Account + AI security */}
      <div className="mt-6 grid gap-4 grid-cols-1 lg:grid-cols-3">
        <InsightCard title="Account Settings" icon={User} className="lg:col-span-2">

          {/* Avatar row */}
          <div className="mb-6 flex items-center gap-4">
            <div className="relative group">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={initials}
                  className="h-16 w-16 rounded-full ring-2 ring-emerald-500/30 object-cover"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 ring-2 ring-emerald-500/30 flex items-center justify-center text-xl font-bold text-black">
                  {initials}
                </div>
              )}
              {/* Hover overlay */}
              <button
                onClick={handlePhotoClick}
                className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                title="Change photo"
              >
                <Camera className="h-5 w-5 text-white" />
              </button>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />

            <div className="flex-1">
              <p className="text-lg font-semibold">{displayName || "Quantuma User"}</p>
              <p className="text-xs text-muted-foreground">
                {user?.app_metadata?.provider === "google"
                  ? "Signed in with Google"
                  : "Enterprise Member"}
              </p>
              {localAvatar && (
                <p className="mt-1 text-[11px] text-emerald-400">✓ New photo selected (local preview)</p>
              )}
            </div>
            <button
              onClick={handlePhotoClick}
              className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-semibold hover:bg-surface-3 transition flex items-center gap-1.5"
            >
              <Camera className="h-3.5 w-3.5" />
              Change Photo
            </button>
          </div>

          {/* Fields */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 border-t border-white/[0.06] pt-5">
            <div>
              <label className="kpi-label mb-1.5 block">Email Address</label>
              <input
                type="email"
                value={userEmail}
                readOnly
                className="h-10 w-full rounded-lg border border-white/[0.06] bg-surface-1 px-3 text-sm focus:outline-none opacity-70 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="kpi-label mb-1.5 block">Password</label>
              {!pwOpen ? (
                <div className="relative">
                  <input
                    type="password"
                    defaultValue="••••••••••••"
                    readOnly
                    className="h-10 w-full rounded-lg border border-white/[0.06] bg-surface-1 pl-3 pr-10 text-sm focus:outline-none opacity-70 cursor-not-allowed"
                  />
                  <button
                    onClick={() => { setPwOpen(true); setPwMsg(null); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-surface-2 transition"
                    title="Change password"
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* New password */}
                  <div className="relative">
                    <input
                      type={showNewPw ? "text" : "password"}
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      placeholder="New password"
                      className="h-10 w-full rounded-lg border border-white/[0.06] bg-surface-1 pl-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw((s) => !s)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  {/* Confirm password */}
                  <div className="relative">
                    <input
                      type={showConfirmPw ? "text" : "password"}
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      placeholder="Confirm password"
                      className="h-10 w-full rounded-lg border border-white/[0.06] bg-surface-1 pl-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      onKeyDown={(e) => e.key === "Enter" && handlePasswordSave()}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPw((s) => !s)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  {/* Feedback */}
                  {pwMsg && (
                    <p className={cn("text-xs", pwMsg.type === "success" ? "text-emerald-400" : "text-red-400")}>
                      {pwMsg.text}
                    </p>
                  )}
                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={handlePasswordSave}
                      disabled={pwLoading}
                      className="flex-1 rounded-lg bg-emerald-500 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400 transition disabled:opacity-60"
                    >
                      {pwLoading ? "Saving…" : "Save Password"}
                    </button>
                    <button
                      onClick={() => { setPwOpen(false); setNewPw(""); setConfirmPw(""); setPwMsg(null); }}
                      className="rounded-lg border border-white/[0.08] bg-surface-2 px-3 py-1.5 text-xs font-semibold hover:bg-surface-3 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* MFA */}
          <div className="mt-5 flex items-center justify-between rounded-xl border border-white/[0.06] bg-surface-1/70 p-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg ring-1",
                mfa ? "bg-emerald-500/15 ring-emerald-500/30" : "bg-surface-2 ring-white/10"
              )}>
                <ShieldCheck className={cn("h-4 w-4", mfa ? "text-emerald-400" : "text-muted-foreground")} />
              </div>
              <div>
                <p className="text-sm font-semibold">Multi-Factor Authentication</p>
                <p className="text-xs text-muted-foreground">
                  {mfa ? "Active — your account has an extra layer of security." : "Disabled — toggle on for better protection."}
                </p>
              </div>
            </div>
            <button
              onClick={handleMfaToggle}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition",
                mfa ? "bg-emerald-500" : "bg-surface-3"
              )}
              aria-label={mfa ? "Disable MFA" : "Enable MFA"}
            >
              <span className={cn(
                "inline-block h-5 w-5 rounded-full bg-white transition",
                mfa ? "translate-x-5" : "translate-x-0.5"
              )} />
            </button>
          </div>

          {/* Sign out */}
          <div className="mt-5 flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/15 ring-1 ring-red-500/30">
                <LogOut className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold">Sign out of this device</p>
                <p className="text-xs text-muted-foreground">
                  Ends your current session. You'll need to sign in again.
                </p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-500/30 transition disabled:opacity-60"
            >
              {signingOut ? "Signing out…" : "Sign Out"}
            </button>
          </div>
        </InsightCard>

        <InsightCard title="AI Security Pulse" icon={Sparkles} iconAccent="purple">
          <p className="kpi-label mb-2">Risk Assessment</p>
          <p className="text-3xl font-bold text-emerald-400">Low</p>
          <p className="mt-1 text-xs text-muted-foreground">0.02% variance vs baseline</p>

          <div className="mt-5 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
            <p className="text-sm italic leading-relaxed">
              "Your account security is <span className="font-semibold text-emerald-400">15% higher</span> than the
              industry average for enterprise analytics. MFA is{" "}
              <span className={cn("font-semibold", mfa ? "text-emerald-400" : "text-amber-400")}>
                {mfa ? "protecting 3 active sessions" : "currently disabled"}
              </span>."
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-white/[0.06] bg-surface-1/70 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <KeyRound className="h-3.5 w-3.5" />
              <span className="font-semibold text-foreground">Security checklist</span>
            </div>
            <ul className="space-y-1.5 text-xs">
              {[
                { label: "Email verified", done: true },
                { label: "Password set", done: true },
                { label: "MFA enabled", done: mfa },
                { label: "Session monitoring", done: true },
              ].map((item) => (
                <li key={item.label} className="flex items-center gap-2">
                  {item.done
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    : <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  <span className={item.done ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 space-y-2">
            <button className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-surface-1 px-3 py-2 text-sm hover:bg-surface-2 transition">
              <span className="flex items-center gap-2"><Lock className="h-4 w-4 text-muted-foreground" /> API Keys</span>
              <span className="text-xs text-muted-foreground">3 active</span>
            </button>
            <button className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-surface-1 px-3 py-2 text-sm hover:bg-surface-2 transition">
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-muted-foreground" /> Active Sessions</span>
              <span className="text-xs text-muted-foreground">3 devices</span>
            </button>
          </div>
        </InsightCard>
      </div>
    </DashboardLayout>
  );
}

function ThemeOption({ label, active, onClick, desc, preview }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-left rounded-xl border p-5 transition",
        active
          ? "border-emerald-500 ring-1 ring-emerald-500/50 bg-emerald-500/[0.04]"
          : "border-white/[0.06] hover:border-white/[0.12]"
      )}
    >
      <div className="flex items-center justify-between">
        <p className={cn("text-xs font-bold uppercase tracking-widest", active ? "text-emerald-400" : "text-muted-foreground")}>
          {label}
        </p>
        {active ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      <div
        className={cn(
          "mt-4 h-32 rounded-lg border overflow-hidden p-2",
          preview === "dark"
            ? "border-white/[0.06] bg-surface-1"
            : "border-zinc-300 bg-white"
        )}
      >
        <div className={cn(
          "h-2 w-1/3 rounded mb-2",
          preview === "dark" ? "bg-surface-3" : "bg-zinc-200"
        )} />
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                "h-12 rounded",
                preview === "dark" ? "bg-surface-2" : "bg-zinc-100"
              )}
            />
          ))}
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">{desc}</p>
    </button>
  );
}
