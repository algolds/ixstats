"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { getSectionFromPathname, type DashboardSection } from "./DashboardSidebarNav";
import { withBasePath } from "~/lib/base-path";
import { DashboardSidebarLayout } from "./DashboardSidebarLayout";
import { UnifiedDashboardSection } from "./sections/UnifiedDashboardSection";
import { WorldSection } from "./sections/WorldSection";
import { api } from "~/trpc/react";

const SECTION_TITLES: Record<DashboardSection, string> = {
  overview: "Dashboard",
  world: "World",
};

export function DashboardRouter() {
  const pathname = usePathname();

  const [activeSection, setActiveSection] = useState<DashboardSection>(
    () => getSectionFromPathname(pathname)
  );

  const { data: globalStats } = api.countries.getGlobalStats.useQuery({});

  const handleNavigate = useCallback((section: DashboardSection) => {
    if (section === activeSection) return;
    setActiveSection(section);

    const href = section === "overview" ? "/dashboard" : `/dashboard/${section}`;
    window.history.pushState(null, "", withBasePath(href));
    document.title = `${SECTION_TITLES[section]} - IxStats`;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [activeSection]);

  useEffect(() => {
    const onPopState = () => {
      const newSection = getSectionFromPathname(window.location.pathname);
      setActiveSection(newSection);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    document.title = `${SECTION_TITLES[activeSection]} - IxStats`;
  }, [activeSection]);

  return (
    <DashboardSidebarLayout
      activeSection={activeSection}
      onNavigate={handleNavigate}
    >
      {activeSection === "overview" && <UnifiedDashboardSection globalStats={globalStats} />}
      {activeSection === "world" && <WorldSection />}
    </DashboardSidebarLayout>
  );
}
