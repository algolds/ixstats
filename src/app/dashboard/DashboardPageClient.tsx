"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { DashboardRouter } from "~/components/dashboard/DashboardRouter";
import { DashboardErrorBoundary } from "~/components/dashboard/DashboardErrorBoundary";
import { ShellPageHeader, shellPageTitleProps } from "~/components/shell/ShellPageHeader";

export function DashboardPageClient({ initialCountryId }: { initialCountryId: string }) {
  usePageTitle({ title: "Dashboard" });

  return (
    <DashboardErrorBoundary
      title="Dashboard Error"
      description="An error occurred while loading the dashboard. Please try again."
    >
      {/* Phone title under the new navigation shell (nothing with the flag off). */}
      <ShellPageHeader title="Home" />
      {/* The page's one h1 for the document outline (the widget cards are h2); hidden where the
          shell header above names the page. */}
      <h1 {...shellPageTitleProps} className="sr-only">
        Dashboard
      </h1>
      <DashboardRouter initialCountryId={initialCountryId} />
    </DashboardErrorBoundary>
  );
}
