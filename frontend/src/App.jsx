import { Routes, Route, Navigate } from "react-router-dom";

import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import DashboardPage from "@/pages/DashboardPage";
import CustomerAnalyticsPage from "@/pages/CustomerAnalyticsPage";
import RecommendationPage from "@/pages/RecommendationPage";
import SalesAnalyticsPage from "@/pages/SalesAnalyticsPage";
import ProductInsightsPage from "@/pages/ProductInsightsPage";
import VisualizationCenterPage from "@/pages/VisualizationCenterPage";
import MLInsightsPage from "@/pages/MLInsightsPage";
import SettingsPage from "@/pages/SettingsPage";

import ProtectedLayout from "@/layouts/ProtectedLayout";

/**
 * Routing
 * ───────
 * Three buckets:
 *   1. Public          /, /login, /signup       — anyone can hit them
 *   2. Auth-gated      everything under <ProtectedLayout />
 *   3. Catch-all       → back to landing
 *
 * Phase 4 update: the eight dashboard pages now live inside <ProtectedLayout />.
 * That layout checks `useAuth()` and redirects to /login if the session is null.
 * Each child page still renders its own <DashboardLayout> (sidebar + topbar),
 * so visual structure is unchanged for signed-in users.
 */
export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Protected (auth-gated) */}
      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/customers" element={<CustomerAnalyticsPage />} />
        <Route path="/recommendations" element={<RecommendationPage />} />
        <Route path="/sales" element={<SalesAnalyticsPage />} />
        <Route path="/products" element={<ProductInsightsPage />} />
        <Route path="/visualization" element={<VisualizationCenterPage />} />
        <Route path="/ml-insights" element={<MLInsightsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
