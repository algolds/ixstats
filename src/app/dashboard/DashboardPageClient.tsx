"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { useDashboardSection } from "~/hooks/useDashboardSection";
import { DASHBOARD_SECTION_TITLES, type DashboardSection } from "~/lib/dashboard-sections";
import { DashboardRouter } from "~/components/dashboard/DashboardRouter";
import { DashboardErrorBoundary } from "~/components/dashboard/DashboardErrorBoundary";
import { ShellPageHeader, shellPageTitleProps } from "~/components/shell/ShellPageHeader";

export function DashboardPageClient({
  initialCountryId,
  initialSection = "home",
}: {
  initialCountryId: string;
  initialSection?: DashboardSection;
}) {
  const { section, navigate } = useDashboardSection(initialSection);
  usePageTitle({ title: DASHBOARD_SECTION_TITLES[section] });

  return (
    <DashboardErrorBoundary
      title="Dashboard Error"
      description="An error occurred while loading the dashboard. Please try again."
    >
      {/* Phone title under the new navigation shell (nothing with the flag off). */}
      <ShellPageHeader title={section === "accounts" ? "Accounts" : "Home"} />
      {/* The page's one h1 for the document outline (the widget cards are h2); hidden where the
          shell header above names the page. The Accounts section has an h1 of its own. */}
      {section === "home" && (
        <h1 {...shellPageTitleProps} className="sr-only">
          Dashboard
        </h1>
      )}
      <DashboardRouter
        initialCountryId={initialCountryId}
        section={section}
        onNavigate={navigate}
      />
    </DashboardErrorBoundary>
  );
}
