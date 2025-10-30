"use client";

import { EnhancedCommandCenter } from "~/app/_components/EnhancedCommandCenter";
import { DashboardErrorBoundary } from "~/components/shared/feedback/DashboardErrorBoundary";

export default function NewDashboardPage() {
  return (
    <DashboardErrorBoundary
      title="New Dashboard Error"
      description="An error occurred while loading the new dashboard. Please try again."
    >
      <EnhancedCommandCenter />
    </DashboardErrorBoundary>
  );
}
