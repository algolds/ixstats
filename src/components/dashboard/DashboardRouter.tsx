"use client";

import { useEffect } from "react";
import { DashboardSidebarLayout } from "./DashboardSidebarLayout";
import { UnifiedDashboardSection } from "./sections/UnifiedDashboardSection";
import { api } from "~/trpc/react";

export function DashboardRouter() {
  const { data: globalStats } = api.countries.getGlobalStats.useQuery({});

  useEffect(() => {
    document.title = "Dashboard - IxStats";
  }, []);

  return (
    <DashboardSidebarLayout>
      <UnifiedDashboardSection globalStats={globalStats} />
    </DashboardSidebarLayout>
  );
}
