"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "~/context/auth-context";
import { AuthenticationGuard, CountryDataProvider, useCountryData } from "./primitives";
import { AtomicStateProvider } from "~/components/atomic/AtomicStateProvider";
import { MobileOptimized } from "~/app/mycountry/components/MobileOptimizations";
import { getSectionFromPathname, type MyCountrySection } from "./MyCountrySidebarNav";
import { useMyCountryCompliance } from "~/hooks/useMyCountryCompliance";
import { MyCountryComplianceModal } from "./MyCountryComplianceModal";
import { DashboardErrorBoundary } from "~/components/shared/feedback/DashboardErrorBoundary";
import { withBasePath } from "~/lib/base-path";
import { useNationalIssuesToast } from "~/hooks/useNationalIssuesToast";
import { createUrl } from "~/lib/utils";
import { CommandSurface } from "./CommandSurface";

function SectionErrorFallback({ sectionName, retry }: { sectionName: string; retry: () => void }) {
  return (
    <div className="space-y-4 p-6">
      <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
        <h3 className="mb-2 font-semibold text-red-400">Couldn't Load {sectionName}</h3>
        <p className="mb-4 text-sm text-red-300">
          There was an issue loading this section. Try again or refresh the page.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={retry}
            className="rounded bg-red-600/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-600/30"
          >
            Retry
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded bg-red-600/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-600/30"
          >
            Refresh Page
          </button>
        </div>
      </div>
    </div>
  );
}

function createSectionFallback(sectionName: string) {
  return function SectionFallback({ error: _error, retry }: { error: Error; retry: () => void }) {
    return <SectionErrorFallback sectionName={sectionName} retry={retry} />;
  };
}

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
      fallback={createSectionFallback(SECTION_TITLES[activeSection])}
      title={`Unable to load ${SECTION_TITLES[activeSection]}`}
      description="This section could not be loaded. Try again or refresh the page."
      resetKeys={[activeSection]}
    >
      <CommandSurface section={activeSection} onNavigate={handleNavigate} />

      {country?.id && complianceSections.length > 0 && activeSection === "overview" && (
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
          <AtomicStateProviderWrapper>
            <MyCountryRouterInner />
          </AtomicStateProviderWrapper>
        </CountryDataProvider>
      </AuthenticationGuard>
    </MobileOptimized>
  );
}

/** Wraps children in AtomicStateProvider when country data is available */
function AtomicStateProviderWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const { country } = useCountryData();

  if (!country?.id) return <>{children}</>;

  return (
    <AtomicStateProvider countryId={country.id} userId={user?.id}>
      {children}
    </AtomicStateProvider>
  );
}
