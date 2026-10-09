"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { withBasePath } from "~/lib/base-path";
import {
  DASHBOARD_SECTION_PATHS,
  DASHBOARD_SECTION_TITLES,
  getDashboardSection,
  type DashboardSection,
} from "~/lib/dashboard-sections";

/**
 * The Dashboard's section router (single-page pattern): switches sections in place with
 * pushState, follows back/forward, and re-syncs when a sidebar <Link> moves between
 * /dashboard and /dashboard/accounts while this tree stays mounted.
 */
export function useDashboardSection(initialSection: DashboardSection): {
  section: DashboardSection;
  navigate: (section: DashboardSection) => void;
} {
  const pathname = usePathname();
  const [section, setSection] = useState<DashboardSection>(initialSection);

  useEffect(() => {
    if (pathname) setSection(getDashboardSection(pathname));
  }, [pathname]);

  useEffect(() => {
    const onPopState = () => setSection(getDashboardSection(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback(
    (next: DashboardSection) => {
      if (next === section) return;
      setSection(next);
      window.history.pushState(null, "", withBasePath(DASHBOARD_SECTION_PATHS[next]));
      document.title = `${DASHBOARD_SECTION_TITLES[next]} - IxStats`;
      window.scrollTo({ top: 0, behavior: "instant" });
    },
    [section]
  );

  return { section, navigate };
}
