"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { DashboardRouter } from "~/components/dashboard/DashboardRouter";
import { DashboardErrorBoundary } from "~/components/shared/feedback/DashboardErrorBoundary";

export default function DashboardWorldPage() {
  usePageTitle({ title: "World - Dashboard" });

  return (
    <DashboardErrorBoundary
      title="Dashboard Error"
      description="An error occurred while loading the dashboard. Please try again."
    >
      <DashboardRouter />
    </DashboardErrorBoundary>
  );
}
