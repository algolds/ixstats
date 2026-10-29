"use client";

import { Suspense, use, useState, useEffect } from "react";
import { browser } from "react-dom";
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
import type { ComplianceSectionStatus } from "~/lib/mycountry/compliance";
import { useMyCountryCompliance } from "~/hooks/useMyCountryCompliance";
import { MyCountryComplianceModal } from "~/components/mycountry/shared/modals/MyCountryComplianceModal";
import { DashboardErrorBoundary } from "~/components/dashboard/DashboardErrorBoundary";
import { withBasePath } from "~/lib/base-path";
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

interface ComplianceModalGateProps {
  storageKey: string;
  sections: ComplianceSectionStatus[];
  onReview: () => void;
  onRemindLater: () => void;
}

/**
 * The compliance prompt, unless its 12 hour snooze is running. The snooze lives in localStorage,
 * so `use(browser())` keeps the server from rendering this: the nearest Suspense fallback goes
 * into the HTML and the client renders it once, already knowing the stored value.
 */
export function ComplianceModalGate({
  storageKey,
  sections,
  onReview,
  onRemindLater,
}: ComplianceModalGateProps) {
  use(browser());
  // Read once: the snooze is 12 hours, so the mount time is "now" for this visit.
  const [mountedAt] = useState(Date.now);
  const snoozeUntil = Number(window.localStorage.getItem(storageKey) ?? 0);
  if (snoozeUntil >= mountedAt) return null;

  return (
    <MyCountryComplianceModal
      isOpen
      sections={sections}
      onReview={onReview}
      onRemindLater={onRemindLater}
      onDismiss={onRemindLater}
    />
  );
}

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
  const [dismissed, setDismissed] = useState(false);
  const complianceStorageKey = countryId ? `ixstats:compliancePrompt:${countryId}` : null;

  const showComplianceModal =
    complianceStorageKey !== null &&
    !dismissed &&
    !complianceLoading &&
    complianceSections.length > 0 &&
    !isCompliant;

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
  const handleNavigate = (section: string) => {
    if (!isMyCountrySection(section) || section === activeSection) return;

    // The map editor is a full-screen route, not a surface of the command shell.
    if (section === "map-editor") {
      router.push("/mycountry/map-editor");
      return;
    }

    // Sync URL without triggering Next.js route navigation
    const href = section === "overview" ? "/mycountry" : `/mycountry/${section}`;
    window.history.pushState(null, "", withBasePath(href));
  };

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

      {country?.id &&
        complianceStorageKey &&
        showComplianceModal &&
        activeSection === "overview" && (
          <Suspense fallback={null}>
            <ComplianceModalGate
              storageKey={complianceStorageKey}
              sections={complianceSections}
              onReview={handleReview}
              onRemindLater={handleRemindLater}
            />
          </Suspense>
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
