"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "~/context/auth-context";
import {
  AuthenticationGuard,
  CountryDataProvider,
  useCountryData,
} from "~/components/mycountry/shared/primitives";
import { MobileOptimized } from "./MobileOptimizations";
import {
  getSectionFromPathname,
  type MyCountrySection,
} from "~/components/mycountry/shell/MyCountrySidebarNav";
import { useMyCountryCompliance } from "~/hooks/useMyCountryCompliance";
import { MyCountryComplianceModal } from "~/components/mycountry/shared/modals/MyCountryComplianceModal";
import { DashboardErrorBoundary } from "~/components/dashboard/DashboardErrorBoundary";
import { withBasePath } from "~/lib/base-path";
import { useNationalIssuesToast } from "~/hooks/useNationalIssuesToast";
import { createUrl } from "~/lib/utils";
import { CommandSurface } from "./CommandSurface";

const SECTION_TITLES: Record<MyCountrySection, string> = {
  overview: "MyCountry®",
  executive: "Executive Directives",
  economy: "Economy & Budget",
  diplomacy: "Diplomatic Operations",
  intelligence: "Intelligence Dashboard",
  defense: "Defense & Security",
  politics: "Political Landscape",
  "map-editor": "Map Editor",
};

/**
 * MyCountryRouter - Single-page hub for all MyCountry sections.
 * Renders CommandSurface as the sole production command shell.
 */
function MyCountryRouterInner() {
  const { country } = useCountryData();
  const pathname = usePathname();
  const router = useRouter();

  // Initialize section from pathname (supports deep links)
  const [activeSection, setActiveSection] = useState<MyCountrySection>(() =>
    getSectionFromPathname(pathname)
  );

  // Push national issue alerts to Dynamic Island toast queue
  useNationalIssuesToast(country?.id);

  // Compliance modal (overview only)
  const {
    sections: complianceSections,
    isCompliant,
    loading: complianceLoading,
    countryId,
  } = useMyCountryCompliance();
  const [showComplianceModal, setShowComplianceModal] = useState(false);

  const complianceStorageKey = useMemo(() => {
    if (!countryId) return null;
    return `ixstats:compliancePrompt:${countryId}`;
  }, [countryId]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !countryId ||
      complianceLoading ||
      complianceSections.length === 0
    )
      return;
    if (isCompliant) {
      // oxlint-disable-next-line
      setShowComplianceModal(false);
      if (complianceStorageKey) window.localStorage.removeItem(complianceStorageKey);
      return;
    }
    if (!complianceStorageKey) return;
    const snoozeUntilRaw = window.localStorage.getItem(complianceStorageKey);
    const snoozeUntil = snoozeUntilRaw ? Number(snoozeUntilRaw) : 0;
    if (!snoozeUntil || snoozeUntil < Date.now()) setShowComplianceModal(true);
  }, [countryId, complianceLoading, complianceSections, isCompliant, complianceStorageKey]);

  const handleRemindLater = () => {
    if (typeof window !== "undefined" && complianceStorageKey) {
      window.localStorage.setItem(complianceStorageKey, String(Date.now() + 1000 * 60 * 60 * 12));
    }
    setShowComplianceModal(false);
  };

  const handleReview = () => {
    if (typeof window !== "undefined" && complianceStorageKey) {
      window.localStorage.removeItem(complianceStorageKey);
    }
    setShowComplianceModal(false);
    router.push(createUrl("/mycountry/editor"));
  };

  // Navigate to a section (instant client-side switch)
  const handleNavigate = useCallback(
    (section: MyCountrySection) => {
      if (section === activeSection) return;

      setActiveSection(section);

      // Sync URL without triggering Next.js route navigation
      const href = section === "overview" ? "/mycountry" : `/mycountry/${section}`;
      window.history.pushState(null, "", withBasePath(href));

      // Update document title
      const countryName = country?.name ?? "MyCountry";
      document.title =
        section === "overview"
          ? `${countryName} - MyCountry`
          : `${countryName} - ${SECTION_TITLES[section]} - IxStats`;

      // Scroll to top on section change
      window.scrollTo({ top: 0, behavior: "instant" });
    },
    [activeSection, country?.name]
  );

  // Handle browser back/forward navigation
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
    const routeSection = getSectionFromPathname(pathname);
    if (routeSection !== activeSection) {
      // oxlint-disable-next-line
      setActiveSection(routeSection);
    }
  }, [pathname, activeSection]);

  // Set initial page title
  useEffect(() => {
    if (!country?.name) return;
    document.title =
      activeSection === "overview"
        ? `${country.name} - MyCountry`
        : `${country.name} - ${SECTION_TITLES[activeSection]} - IxStats`;
  }, [country?.name, activeSection]);

  return (
    <DashboardErrorBoundary
      title={`Unable to load ${SECTION_TITLES[activeSection]}`}
      description="This section could not be loaded. Try again or refresh the page."
      resetKeys={[activeSection]}
    >
      <CommandSurface section={activeSection} onNavigate={handleNavigate} />

      {country?.id && Boolean(complianceSections?.length) && activeSection === "overview" && (
        <MyCountryComplianceModal
          isOpen={showComplianceModal}
          sections={complianceSections}
          onReview={handleReview}
          onRemindLater={handleRemindLater}
          onDismiss={handleRemindLater}
        />
      )}
    </DashboardErrorBoundary>
  );
}

export function MyCountryRouter({ v2: _v2 }: { v2?: boolean } = {}) {
  const { user } = useUser();

  return (
    <MobileOptimized enableTouchGestures={true} className="min-h-screen">
      <AuthenticationGuard redirectPath="/mycountry">
        <CountryDataProvider userId={user?.id || "placeholder-disabled"}>
          <MyCountryRouterInner />
        </CountryDataProvider>
      </AuthenticationGuard>
    </MobileOptimized>
  );
}
