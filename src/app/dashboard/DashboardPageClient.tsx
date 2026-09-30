"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { DashboardRouter } from "~/components/dashboard/DashboardRouter";
import { DashboardErrorBoundary } from "~/components/dashboard/DashboardErrorBoundary";
import { ShellPageHeader } from "~/components/shell/ShellPageHeader";

export function DashboardPageClient({ initialCountryId }: { initialCountryId: string }) {
  usePageTitle({ title: "Dashboard" });

  // Enhanced home page with social activity feed and platform-wide engagement
  // Combines the best of the original CommandCenter with new social features
  return (
    <DashboardErrorBoundary
      title="Dashboard Error"
      description="An error occurred while loading the dashboard. Please try again."
    >
      {/* Phone title under the new navigation shell (nothing with the flag off). */}
      <ShellPageHeader title="Home" />
      <DashboardRouter initialCountryId={initialCountryId} />
    </DashboardErrorBoundary>
  );
}
