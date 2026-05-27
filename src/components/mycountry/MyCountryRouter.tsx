"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useUser } from "~/context/auth-context";
import { AuthenticationGuard, CountryDataProvider, useCountryData } from "./primitives";
import { AtomicStateProvider } from "~/components/atomic/AtomicStateProvider";
import { MobileOptimized } from "~/app/mycountry/components/MobileOptimizations";
import { getSectionFromPathname, type MyCountrySection } from "./MyCountrySidebarNav";
import { useMyCountryCompliance } from "~/hooks/useMyCountryCompliance";
import { MyCountryComplianceModal } from "./MyCountryComplianceModal";
import { useMyCountryNotifications } from "~/hooks/useMyCountryNotifications";
import { usePremium } from "~/hooks/usePremium";
import { PremiumGate } from "~/components/ui/premium-gate";
import { DashboardErrorBoundary } from "~/components/shared/feedback/DashboardErrorBoundary";
import { useRouter } from "next/navigation";
import { withBasePath } from "~/lib/base-path";
import { useNationalIssuesToast } from "~/hooks/useNationalIssuesToast";
import { createUrl } from "~/lib/url-utils";

// Loading skeleton for dynamically loaded sections
function SectionSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-8 w-48 rounded bg-white/5" />
      <div className="h-64 rounded-xl bg-white/5" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-32 rounded-lg bg-white/5" />
        <div className="h-32 rounded-lg bg-white/5" />
      </div>
    </div>
  );
}

// Error fallback for failed section loads
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
  return function SectionFallback({ error, retry }: { error: Error; retry: () => void }) {
    return <SectionErrorFallback sectionName={sectionName} retry={retry} />;
  };
}

// Core gameplay sections — eagerly imported for instant tab switching
import { EnhancedMyCountryContent } from "./EnhancedMyCountryContent";
import { EnhancedExecutiveContent } from "./EnhancedExecutiveContent";
import { EnhancedDiplomacyContent } from "./EnhancedDiplomacyContent";
import { EnhancedPoliticsContent } from "./EnhancedPoliticsContent";

// Rarely-visited sections — lazy-loaded to keep initial bundle smaller
const EnhancedIntelligenceContent = dynamic(
  () =>
    import("./EnhancedIntelligenceContent").then((m) => ({
      default: m.EnhancedIntelligenceContent,
    })),
  {
    loading: () => <SectionSkeleton />,
    ssr: false,
  }
);
const EnhancedDefenseContent = dynamic(
  () => import("./EnhancedDefenseContent").then((m) => ({ default: m.EnhancedDefenseContent })),
  {
    loading: () => <SectionSkeleton />,
    ssr: false,
  }
);
const EnhancedMapEditorContent = dynamic(
  () => import("./EnhancedMapEditorContent").then((m) => ({ default: m.EnhancedMapEditorContent })),
  {
    loading: () => <SectionSkeleton />,
    ssr: false,
  }
);

const SECTION_TITLES: Record<MyCountrySection, string> = {
  overview: "MyCountry®",
  executive: "Executive Command",
  diplomacy: "Diplomatic Operations",
  intelligence: "Intelligence Dashboard",
  defense: "Defense & Security",
  politics: "Political Landscape",
  "map-editor": "Map Editor",
};

/**
 * MyCountryRouter - Single-page hub for all MyCountry sections.
 *
 * Instead of separate routes, all sections are rendered here and switched
 * via client-side state for instant navigation. URL is synced with
 * history.pushState for deep linking and back/forward support.
 */
function MyCountryRouterInner() {
  const { country } = useCountryData();
  const pathname = usePathname();
  const router = useRouter();

  // Initialize section from pathname (supports deep links)
  const [activeSection, setActiveSection] = useState<MyCountrySection>(() =>
    getSectionFromPathname(pathname)
  );

  // Notification counts for sidebar indicators
  const notifications = useMyCountryNotifications(country?.id);

  // Push national issue alerts to Dynamic Island toast queue
  useNationalIssuesToast(country?.id);

  // Premium feature access
  const { features: premiumFeatures, isLoading: premiumLoading } = usePremium();

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

  // Render active section content
  const renderSection = () => {
    switch (activeSection) {
      case "overview":
        return (
          <EnhancedMyCountryContent
            variant="unified"
            activeSection={activeSection}
            onNavigate={handleNavigate}
            notifications={notifications}
          />
        );
      case "executive":
        return (
          <EnhancedExecutiveContent
            activeSection={activeSection}
            onNavigate={handleNavigate}
            notifications={notifications}
          />
        );
      case "diplomacy":
        return (
          <EnhancedDiplomacyContent
            activeSection={activeSection}
            onNavigate={handleNavigate}
            notifications={notifications}
          />
        );
      case "intelligence":
        if (!premiumLoading && !premiumFeatures.intelligence) {
          return <PremiumGate feature="intelligence" className="mx-auto mt-8 max-w-2xl" />;
        }
        return (
          <EnhancedIntelligenceContent
            activeSection={activeSection}
            onNavigate={handleNavigate}
            notifications={notifications}
          />
        );
      case "defense":
        if (!premiumLoading && !premiumFeatures.defense) {
          return <PremiumGate feature="defense" className="mx-auto mt-8 max-w-2xl" />;
        }
        return (
          <EnhancedDefenseContent
            activeSection={activeSection}
            onNavigate={handleNavigate}
            notifications={notifications}
          />
        );
      case "map-editor":
        return (
          <EnhancedMapEditorContent
            activeSection={activeSection}
            onNavigate={handleNavigate}
            notifications={notifications}
          />
        );
      default:
        return null;
    }
  };

  return (
    <DashboardErrorBoundary
      fallback={createSectionFallback(SECTION_TITLES[activeSection])}
      title={`Unable to load ${SECTION_TITLES[activeSection]}`}
      description="This section could not be loaded. Try again or refresh the page."
      resetKeys={[activeSection]}
    >
      {renderSection()}
      {activeSection === "overview" && country?.id && complianceSections.length > 0 && (
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
