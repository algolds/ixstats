"use client";

import { useState, useCallback, useEffect } from "react";
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
} from "~/components/mycountry/shell/mycountry-sections";
import { useMyCountryCompliance } from "~/hooks/useMyCountryCompliance";
import { MyCountryComplianceModal } from "~/components/mycountry/shared/modals/MyCountryComplianceModal";
import { DashboardErrorBoundary } from "~/components/dashboard/DashboardErrorBoundary";
import { withBasePath } from "~/lib/base-path";
import { useHydrated } from "~/hooks/useHydrated";
import { complianceReviewHref } from "~/lib/mycountry/routes";
import { useNationalIssuesToast } from "~/hooks/useNationalIssuesToast";
import { CommandSurface } from "./CommandSurface";

const SECTION_TITLES: Record<MyCountrySection, string> = {
  overview: "MyCountry®",
  executive: "Executive Directives",
  economy: "Economy & Budget",
  diplomacy: "Diplomatic Operations",
  // /mycountry/intelligence renders the Defense section.
  intelligence: "Defense & Security",
  defense: "Defense & Security",
  politics: "Political Landscape",
  "map-editor": "Map Editor",
};

const isMyCountrySection = (s: string): s is MyCountrySection => s in SECTION_TITLES;

/**
 * MyCountryRouter - Single-page hub for all MyCountry sections.
 * Renders CommandSurface as the sole production command shell.
 */
function MyCountryRouterInner() {
  const { country } = useCountryData();
  const pathname = usePathname();
  const router = useRouter();

  // The address is the state: Next.js folds native pushState and Back/Forward into usePathname.
  const activeSection = getSectionFromPathname(pathname);

  // Push national issue alerts to Dynamic Island toast queue
  useNationalIssuesToast(country?.id);

  // Compliance modal (overview only)
  const {
    sections: complianceSections,
    isCompliant,
    loading: complianceLoading,
    countryId,
  } = useMyCountryCompliance();
  const hydrated = useHydrated();
  const [dismissed, setDismissed] = useState(false);
  // Read once: the snooze is 12 hours, so the mount time is "now" for this visit.
  const [mountedAt] = useState(Date.now);
  const complianceStorageKey = countryId ? `ixstats:compliancePrompt:${countryId}` : null;

  const snoozeUntil =
    hydrated && complianceStorageKey
      ? Number(window.localStorage.getItem(complianceStorageKey) ?? 0)
      : 0;
  const showComplianceModal =
    hydrated &&
    complianceStorageKey !== null &&
    !dismissed &&
    !complianceLoading &&
    complianceSections.length > 0 &&
    !isCompliant &&
    snoozeUntil < mountedAt;

  // A compliant country drops any old snooze, so a later gap prompts straight away.
  useEffect(() => {
    if (isCompliant && !complianceLoading && complianceStorageKey) {
      window.localStorage.removeItem(complianceStorageKey);
    }
  }, [isCompliant, complianceLoading, complianceStorageKey]);

  const handleRemindLater = () => {
    if (complianceStorageKey) {
      window.localStorage.setItem(complianceStorageKey, String(Date.now() + 1000 * 60 * 60 * 12));
    }
    setDismissed(true);
  };

  const handleReview = () => {
    if (complianceStorageKey) {
      window.localStorage.removeItem(complianceStorageKey);
    }
    setDismissed(true);
    router.push(complianceReviewHref(complianceSections.find((section) => !section.isComplete)));
  };

  // Navigate to a section (instant client-side switch)
  const handleNavigate = useCallback(
    (section: string) => {
      if (!isMyCountrySection(section) || section === activeSection) return;

      // The map editor is a full-screen route, not a surface of the command shell.
      if (section === "map-editor") {
        router.push("/mycountry/map-editor");
        return;
      }

      // Sync URL without triggering Next.js route navigation
      const href = section === "overview" ? "/mycountry" : `/mycountry/${section}`;
      window.history.pushState(null, "", withBasePath(href));
    },
    [activeSection, router]
  );

  // Scroll to top on every section change, Back/Forward included
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [activeSection]);

  useEffect(() => {
    if (!country?.name) return;
    document.title =
      activeSection === "overview"
        ? `${country.name} - MyCountry`
        : `${country.name} - ${SECTION_TITLES[activeSection]} - IxStates`;
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

export function MyCountryRouter() {
  const { user } = useUser();

  return (
    <MobileOptimized enableTouchGestures={true} className="min-h-screen">
      <AuthenticationGuard>
        <CountryDataProvider userId={user?.id || "placeholder-disabled"}>
          <MyCountryRouterInner />
        </CountryDataProvider>
      </AuthenticationGuard>
    </MobileOptimized>
  );
}
