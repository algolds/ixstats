"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { DashboardRouter } from "~/components/dashboard/DashboardRouter";
import { DashboardErrorBoundary } from "~/components/dashboard/DashboardErrorBoundary";

export default function DashboardDiplomacyPage() {
  usePageTitle({ title: "Diplomacy & Crises - Dashboard" });

  return (
    <DashboardErrorBoundary
      title="Dashboard Error"
      description="An error occurred while loading the dashboard. Please try again."
    >
      <DashboardRouter />
    </DashboardErrorBoundary>
  );
}
