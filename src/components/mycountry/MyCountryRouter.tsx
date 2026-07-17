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
import { PremiumPreviewFrame } from "~/components/mycountry/primitives";
import { useAbility } from "~/components/providers/AbilityProvider";
import { Crown, ArrowRight, Sparkles } from "lucide-react";
import { GlassButton } from "~/components/ui/glass-button";
import { DashboardErrorBoundary } from "~/components/shared/feedback/DashboardErrorBoundary";
import { useRouter } from "next/navigation";
import { withBasePath } from "~/lib/base-path";
import { useNationalIssuesToast } from "~/hooks/useNationalIssuesToast";
import { createUrl } from "~/lib/url-utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { StateSeal, IntentComposer } from "./primitives";
import { api } from "~/trpc/react";

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
  return function SectionFallback({ error: _error, retry }: { error: Error; retry: () => void }) {
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
function MyCountryRouterInner({ v2 = false }: { v2?: boolean }) {
  const { country } = useCountryData();
  const pathname = usePathname();
  const router = useRouter();

  // V2 composer states
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerInitialGoal, setComposerInitialGoal] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const utils = api.useUtils();
  const handleCommitted = useCallback(
    (res: any) => {
      const body = (res?.summary as string) ?? "Intent committed.";
      setToast(body);
      setTimeout(() => setToast(null), 4500);
      setComposerOpen(false);
      setComposerInitialGoal("");

      // Invalidate queries to update dashboard stats, news feed, change log
      void utils.mycountry.getCanonFeed.invalidate();
      void utils.mycountry.getChangeLog.invalidate();
      void utils.mycountry.getCountryDashboard.invalidate();
      void utils.intent.getStatus.invalidate();
      void utils.intent.getTree.invalidate();
    },
    [utils]
  );

  // Initialize section from pathname (supports deep links)
  const [activeSection, setActiveSection] = useState<MyCountrySection>(() =>
    getSectionFromPathname(pathname)
  );

  // Notification counts for sidebar indicators
  const notifications = useMyCountryNotifications(country?.id);

  // Push national issue alerts to Dynamic Island toast queue
  useNationalIssuesToast(country?.id);

  // Premium feature access
  const { features: _premiumFeatures, isLoading: _premiumLoading } = usePremium();
  const ability = useAbility();

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
            v2={v2}
            onIssueDirective={(goal) => {
              setComposerInitialGoal(typeof goal === "string" ? goal : "");
              setComposerOpen(true);
            }}
          />
        );
      case "executive":
        return (
          <EnhancedExecutiveContent
            activeSection={activeSection}
            onNavigate={handleNavigate}
            notifications={notifications}
            v2={v2}
            onIssueDirective={(goal) => {
              setComposerInitialGoal(typeof goal === "string" ? goal : "");
              setComposerOpen(true);
            }}
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
        return (
          <PremiumPreviewFrame
            feature="intelligence"
            locked={!ability.can("access", "MyCountryFeature", "intelligence")}
          >
            <EnhancedIntelligenceContent
              activeSection={activeSection}
              onNavigate={handleNavigate}
              notifications={notifications}
            />
          </PremiumPreviewFrame>
        );
      case "defense":
        return (
          <PremiumPreviewFrame
            feature="defense"
            locked={!ability.can("access", "MyCountryFeature", "defense")}
          >
            <EnhancedDefenseContent
              activeSection={activeSection}
              onNavigate={handleNavigate}
              notifications={notifications}
            />
          </PremiumPreviewFrame>
        );
      case "politics":
        return (
          <EnhancedPoliticsContent
            activeSection={activeSection}
            onNavigate={handleNavigate}
            notifications={notifications}
          />
        );
      case "map-editor":
        if (!ability.can("access", "MyCountryFeature", "map-editor")) {
          return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
              <div className="glass-panel animate-fade-in max-w-md space-y-6 rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/10 to-amber-600/5 p-8 shadow-xl backdrop-blur-md">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 p-4 shadow-lg">
                  <Crown className="h-8 w-8 animate-pulse text-white" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-foreground text-2xl font-bold tracking-tight">Map Editor</h3>
                  <p className="text-muted-foreground text-sm">
                    Shape your nation's territory, establish subdivisions, build cities, and mark
                    points of interest. This feature is exclusive to MyCountry Premium members.
                  </p>
                </div>
                <GlassButton
                  variant="primary"
                  className="group w-full"
                  onClick={() => router.push(withBasePath("/help/getting-started/welcome"))}
                >
                  <Crown className="mr-2 h-4 w-4" />
                  Upgrade to Premium
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </GlassButton>
                <button
                  onClick={() => handleNavigate("overview")}
                  className="text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
                >
                  Back to Overview
                </button>
              </div>
            </div>
          );
        }
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
      {/* Intent Composer Bottom Sheet for V2 */}
      {v2 && country?.id && (
        <Sheet open={composerOpen} onOpenChange={setComposerOpen}>
          <SheetContent
            side="bottom"
            className="border-border bg-background/95 max-h-[85vh] overflow-y-auto backdrop-blur-xl"
          >
            <SheetHeader className="mb-2">
              <SheetTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-amber-500" /> Issue a directive —{" "}
                {country.name ?? "your nation"}
              </SheetTitle>
            </SheetHeader>
            <div className="mx-auto max-w-3xl pb-6">
              {composerOpen && (
                <IntentComposer
                  countryId={country.id}
                  initialGoal={composerInitialGoal}
                  onCommitted={handleCommitted}
                />
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* V2 in-world committed toast */}
      {v2 && toast && (
        <div className="border-border bg-secondary animate-in fade-in slide-in-from-bottom-2 fixed bottom-5 left-1/2 z-50 flex max-w-lg -translate-x-1/2 items-start gap-2.5 rounded-xl border px-4 py-3 shadow-2xl">
          <StateSeal
            flagUrl={country?.flag}
            governmentType={country?.governmentType}
            size={24}
            showPips={false}
            className="mt-0.5"
          />
          <span className="text-foreground/90 text-[13px] leading-snug">{toast}</span>
        </div>
      )}
    </DashboardErrorBoundary>
  );
}

export function MyCountryRouter({ v2 = false }: { v2?: boolean } = {}) {
  const { user } = useUser();

  return (
    <MobileOptimized enableTouchGestures={true} className="min-h-screen">
      <AuthenticationGuard redirectPath="/mycountry">
        <CountryDataProvider userId={user?.id || "placeholder-disabled"}>
          <AtomicStateProviderWrapper>
            <MyCountryRouterInner v2={v2} />
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
