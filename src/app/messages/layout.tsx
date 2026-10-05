import { Suspense } from "react";
import { DashboardSidebarLayout } from "~/components/dashboard/sidebar/DashboardSidebarLayout";
import { PortalTintSync } from "~/components/providers/PortalTintSync";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Messages - IxStats",
  description: "Unified messaging",
};

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <div className="border-tint size-8 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      }
    >
      {/* Messages is a ThinkPages section (app-sections.ts), so it carries the ThinkPages tint. */}
      <div data-app="thinkpages" className="relative min-h-screen">
        <PortalTintSync />
        <DashboardSidebarLayout>{children}</DashboardSidebarLayout>
      </div>
    </Suspense>
  );
}
