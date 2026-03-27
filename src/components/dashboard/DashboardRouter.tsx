"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { getSectionFromPathname, type DashboardSection } from "./DashboardSidebarNav";
import { withBasePath } from "~/lib/base-path";
import { DashboardSidebarLayout } from "./DashboardSidebarLayout";
import { WorldStatsBar } from "./WorldStatsBar";
import { ActivitySection } from "./sections/ActivitySection";
import { FeedSection } from "./sections/FeedSection";
import { WorldSection } from "./sections/WorldSection";
import { api } from "~/trpc/react";

const SECTION_TITLES: Record<DashboardSection, string> = {
  activity: "Command Overview",
  feed: "Feed",
  world: "World",
};

export function DashboardRouter() {
  const pathname = usePathname();

  const [activeSection, setActiveSection] = useState<DashboardSection>(
    () => getSectionFromPathname(pathname)
  );

  // Global stats for the WorldStatsBar
  const { data: globalStats } = api.countries.getGlobalStats.useQuery({});

  const handleNavigate = useCallback((section: DashboardSection) => {
    if (section === activeSection) return;

    setActiveSection(section);

    const href = section === "activity" ? "/dashboard" : `/dashboard/${section}`;
    window.history.pushState(null, "", withBasePath(href));

    document.title = `${SECTION_TITLES[section]} - IxStats Dashboard`;

    window.scrollTo({ top: 0, behavior: "instant" });
  }, [activeSection]);

  // Handle browser back/forward
  useEffect(() => {
    const onPopState = () => {
      const newSection = getSectionFromPathname(window.location.pathname);
      setActiveSection(newSection);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Set initial page title
  useEffect(() => {
    document.title = `${SECTION_TITLES[activeSection]} - IxStats Dashboard`;
  }, [activeSection]);

  return (
    <DashboardSidebarLayout
      activeSection={activeSection}
      onNavigate={handleNavigate}
    >
      <WorldStatsBar globalStats={globalStats} />

      {activeSection === "activity" && <ActivitySection globalStats={globalStats} />}
      {activeSection === "feed" && <FeedSection />}
      {activeSection === "world" && <WorldSection />}
    </DashboardSidebarLayout>
  );
}
