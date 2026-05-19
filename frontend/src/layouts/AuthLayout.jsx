/**
 * AuthLayout — shell for Login / Signup screens.
 *
 * Same ambient-mesh + floating-orb language as the main DashboardLayout so
 * the login screen feels like an extension of the product, not a separate
 * marketing page. Theme-aware via CSS variables — flips cleanly when the
 * user pre-selects light mode before signing in.
 */
export default function AuthLayout({ children }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Mesh gradient backdrop */}
      <div className="pointer-events-none absolute inset-0 ambient-mesh" />

      {/* Subtle grid overlay */}
      <div className="pointer-events-none absolute inset-0 ambient-grid opacity-30" />

      {/* Floating orbs for depth */}
      <div className="orb orb-emerald orb-drift"
           style={{ width: 460, height: 460, top: -160, left: -100 }} />
      <div className="orb orb-mint orb-drift"
           style={{ width: 380, height: 380, bottom: -120, right: -80, animationDelay: "-8s" }} />

      <div className="relative flex min-h-screen items-center justify-center px-6">
        {children}
      </div>
    </div>
  );
}
