"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useUser } from "~/context/auth-context";
import { AuthenticationGuard, CountryDataProvider, useCountryData } from "./primitives";
import { AtomicStateProvider } from "~/components/atomic/AtomicStateProvider";
import { MobileOptimized } from "~/app/mycountry/components/MobileOptimizations";
import { getSectionFromPathname, NAV_ITEMS, type MyCountrySection } from "./MyCountrySidebarNav";
import { EnhancedMyCountryContent } from "./EnhancedMyCountryContent";
import { EnhancedExecutiveContent } from "./EnhancedExecutiveContent";
import { EnhancedDiplomacyContent } from "./EnhancedDiplomacyContent";
import { EnhancedIntelligenceContent } from "./EnhancedIntelligenceContent";
import { EnhancedDefenseContent } from "./EnhancedDefenseContent";
import { useMyCountryCompliance } from "~/hooks/useMyCountryCompliance";
import { MyCountryComplianceModal } from "./MyCountryComplianceModal";
import { useRouter } from "next/navigation";

const SECTION_TITLES: Record<MyCountrySection, string> = {
  overview: "MyCountry®",
  executive: "Executive Command",
  diplomacy: "Diplomatic Operations",
  intelligence: "Intelligence Dashboard",
  defense: "Defense & Security",
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
  const { user } = useUser();
  const { country } = useCountryData();
  const pathname = usePathname();
  const router = useRouter();

  // Initialize section from pathname (supports deep links)
  const [activeSection, setActiveSection] = useState<MyCountrySection>(
    () => getSectionFromPathname(pathname)
  );

  // Compliance modal (overview only)
  const { sections: complianceSections, isCompliant, loading: complianceLoading, countryId } = useMyCountryCompliance();
  const [showComplianceModal, setShowComplianceModal] = useState(false);

  const complianceStorageKey = useMemo(() => {
    if (!countryId) return null;
    return `ixstats:compliancePrompt:${countryId}`;
  }, [countryId]);

  useEffect(() => {
    if (typeof window === "undefined" || !countryId || complianceLoading || complianceSections.length === 0) return;
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
    router.push("/mycountry/editor");
  };

  // Navigate to a section (instant client-side switch)
  const handleNavigate = useCallback((section: MyCountrySection) => {
    if (section === activeSection) return;

    setActiveSection(section);

    // Sync URL without triggering Next.js route navigation
    const href = section === "overview" ? "/mycountry" : `/mycountry/${section}`;
    window.history.pushState(null, "", href);

    // Update document title
    const countryName = country?.name ?? "MyCountry";
    document.title = section === "overview"
      ? `${countryName} - MyCountry`
      : `${countryName} - ${SECTION_TITLES[section]} - IxStats`;

    // Scroll to top on section change
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [activeSection, country?.name]);

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

  // Set initial page title
  useEffect(() => {
    if (!country?.name) return;
    document.title = activeSection === "overview"
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
          />
        );
      case "executive":
        return (
          <EnhancedExecutiveContent
            variant="unified"
            activeSection={activeSection}
            onNavigate={handleNavigate}
          />
        );
      case "diplomacy":
        return (
          <EnhancedDiplomacyContent
            variant="unified"
            activeSection={activeSection}
            onNavigate={handleNavigate}
          />
        );
      case "intelligence":
        return (
          <EnhancedIntelligenceContent
            variant="unified"
            activeSection={activeSection}
            onNavigate={handleNavigate}
          />
        );
      case "defense":
        // Defense needs props-based data, we pass from context
        if (!user || !country) return null;
        return (
          <EnhancedDefenseContent
            user={user}
            userProfile={{ countryId: country.id }}
            country={country}
            activeSection={activeSection}
            onNavigate={handleNavigate}
          />
        );
      case "map-editor":
        // Map editor still uses its own route
        router.push("/mycountry/editor");
        return null;
      default:
        return null;
    }
  };

  return (
    <>
      {renderSection()}
      {activeSection === "overview" && country?.id && complianceSections.length > 0 && (
        <MyCountryComplianceModal
          open={showComplianceModal}
          sections={complianceSections}
          onReview={handleReview}
          onRemindLater={handleRemindLater}
          onDismiss={handleRemindLater}
        />
      )}
    </>
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
