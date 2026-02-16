"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { getSectionFromPathname, type DashboardSection } from "./DashboardSidebarNav";
import { DashboardSidebarLayout } from "./DashboardSidebarLayout";
import { WorldStatsBar } from "./WorldStatsBar";
import { ActivitySection } from "./sections/ActivitySection";
import { FeedSection } from "./sections/FeedSection";
import { DiplomacySection } from "./sections/DiplomacySection";
import { TrendsSection } from "./sections/TrendsSection";
import { api } from "~/trpc/react";

const SECTION_TITLES: Record<DashboardSection, string> = {
  activity: "Overview",
  feed: "Feed",
  diplomacy: "Diplomacy & Crises",
  trends: "The World",
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
    window.history.pushState(null, "", href);

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
      {activeSection === "diplomacy" && <DiplomacySection />}
      {activeSection === "trends" && <TrendsSection />}
    </DashboardSidebarLayout>
  );
}
