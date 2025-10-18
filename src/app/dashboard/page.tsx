"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { EnhancedCommandCenter } from "../_components/EnhancedCommandCenter";
import { DashboardErrorBoundary } from "~/components/shared/feedback/DashboardErrorBoundary";

export default function DashboardPage() {
  usePageTitle({ title: "Dashboard" });

  // Enhanced home page with social activity feed and platform-wide engagement
  // Combines the best of the original CommandCenter with new social features
  return (
    <DashboardErrorBoundary
      title="Dashboard Error"
      description="An error occurred while loading the dashboard. Please try again."
    >
      <EnhancedCommandCenter />
    </DashboardErrorBoundary>
  );
}