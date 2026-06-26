"use client";

// src/app/labs/onoma/components/OnomaRouter.tsx
// Onoma Lab — Unified Workspace & Router (Facet Rebuild)

import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { withBasePath } from "~/lib/base-path";
import type { OnomaSection } from "~/lib/onoma/types";
import { getSectionFromPathname } from "~/lib/onoma/types";
import { FacetTabs } from "~/components/facet-ui";
import { FacetMaterial } from "~/components/facet-ui";
import { 
  Compass, 
  MapPin, 
  Users, 
  Shield, 
  Building2, 
  Globe, 
  Wrench, 
  Bookmark,
  HelpCircle
} from "lucide-react";

// Import sections
import OverviewSection from "./sections/OverviewSection";
import PlacesSection from "./sections/PlacesSection";
import PeopleSection from "./sections/PeopleSection";
import MilitarySection from "./sections/MilitarySection";
import OrganizationsSection from "./sections/OrganizationsSection";
import CultureSection from "./sections/CultureSection";
import StudioSection from "./sections/StudioSection";
import StashSection from "./sections/StashSection";
import OnomaHelpModal from "./shared/OnomaHelpModal";

const SECTION_TITLES: Record<OnomaSection, string> = {
  overview: "Overview",
  places: "Places",
  people: "People",
  military: "Military",
  organizations: "Organizations",
  culture: "Culture",
  studio: "Custom Studio",
  bank: "Stash",
};

const SECTION_COLORS: Record<OnomaSection, string> = {
  overview: "#0091ff",
  places: "#10b981",
  people: "#a855f7",
  military: "#ef4444",
  organizations: "#f59e0b",
  culture: "#06b6d4",
  studio: "#ec4899",
  bank: "#6366f1",
};

const ONOMA_TABS = [
  {
    id: "overview",
    label: "Overview",
    icon: Compass,
    themeColor: "#0091ff",
    glowClassName: "bg-[#0091ff]/20 dark:bg-[#0091ff]/10",
    activeIndicatorClassName: "bg-[#0091ff]/5 border-[#0091ff]/20 text-[#0091ff] dark:text-[#33a7ff] shadow-[inset_0_1px_0_rgba(0,145,255,0.15)]",
    activeTextClassName: "text-[#0091ff] dark:text-[#33a7ff]",
    activeIconClassName: "text-[#0091ff] dark:text-[#33a7ff]"
  },
  {
    id: "places",
    label: "Places",
    icon: MapPin,
    themeColor: "#10b981",
    glowClassName: "bg-emerald-500/20 dark:bg-emerald-500/10",
    activeIndicatorClassName: "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-[inset_0_1px_0_rgba(16,185,129,0.15)]",
    activeTextClassName: "text-emerald-600 dark:text-emerald-400",
    activeIconClassName: "text-emerald-500 dark:text-emerald-400"
  },
  {
    id: "people",
    label: "People",
    icon: Users,
    themeColor: "#a855f7",
    glowClassName: "bg-purple-500/20 dark:bg-purple-500/10",
    activeIndicatorClassName: "bg-purple-500/5 border-purple-500/20 text-purple-600 dark:text-purple-400 shadow-[inset_0_1px_0_rgba(168,85,247,0.15)]",
    activeTextClassName: "text-purple-600 dark:text-purple-400",
    activeIconClassName: "text-purple-500 dark:text-purple-400"
  },
  {
    id: "military",
    label: "Military",
    icon: Shield,
    themeColor: "#ef4444",
    glowClassName: "bg-red-500/20 dark:bg-red-500/10",
    activeIndicatorClassName: "bg-red-500/5 border-red-500/20 text-red-600 dark:text-red-400 shadow-[inset_0_1px_0_rgba(239,68,68,0.15)]",
    activeTextClassName: "text-red-600 dark:text-red-400",
    activeIconClassName: "text-red-500 dark:text-red-400"
  },
  {
    id: "organizations",
    label: "Organizations",
    icon: Building2,
    themeColor: "#f59e0b",
    glowClassName: "bg-amber-500/20 dark:bg-amber-500/10",
    activeIndicatorClassName: "bg-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-400 shadow-[inset_0_1px_0_rgba(245,158,11,0.15)]",
    activeTextClassName: "text-amber-600 dark:text-amber-400",
    activeIconClassName: "text-amber-500 dark:text-amber-400"
  },
  {
    id: "culture",
    label: "Culture",
    icon: Globe,
    themeColor: "#06b6d4",
    glowClassName: "bg-cyan-500/20 dark:bg-cyan-500/10",
    activeIndicatorClassName: "bg-cyan-500/5 border-cyan-500/20 text-cyan-600 dark:text-cyan-400 shadow-[inset_0_1px_0_rgba(6,182,212,0.15)]",
    activeTextClassName: "text-cyan-600 dark:text-cyan-400",
    activeIconClassName: "text-cyan-500 dark:text-cyan-400"
  }
];

export function OnomaRouter() {
  const pathname = usePathname();

  // Active section state
  const [activeSection, setActiveSection] = useState<OnomaSection>(() =>
    getSectionFromPathname(pathname)
  );

  const [showHelpModal, setShowHelpModal] = useState(false);

  // Auto-open guide for first-time visitors
  useEffect(() => {
    const seen = localStorage.getItem("onoma-welcome-seen");
    if (!seen) {
      setShowHelpModal(true);
      localStorage.setItem("onoma-welcome-seen", "true");
    }
  }, []);

  // States to pass data to Custom Studio from Name Bank
  const [studioInitialWords, setStudioInitialWords] = useState<string[] | undefined>(undefined);
  const [studioInitialTitle, setStudioInitialTitle] = useState<string | undefined>(undefined);

  // Handle SPA navigation
  const handleNavigate = useCallback(
    (section: OnomaSection) => {
      if (section === activeSection) return;
      setActiveSection(section);

      // Sync URL without triggering full Next.js page reloads
      const href = section === "overview" ? "/labs/onoma" : `/labs/onoma/${section}`;
      window.history.pushState(null, "", withBasePath(href));

      // Update document title
      document.title = `Onoma Lab - ${SECTION_TITLES[section]} - IxStats`;

      // Scroll to top
      window.scrollTo({ top: 0, behavior: "instant" });
    },
    [activeSection]
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

  // Sync state if pathname changes externally
  useEffect(() => {
    const routeSection = getSectionFromPathname(pathname);
    if (routeSection !== activeSection) {
      setActiveSection(routeSection);
    }
  }, [pathname, activeSection]);

  // Set document title on load/change
  useEffect(() => {
    document.title = `Onoma Lab - ${SECTION_TITLES[activeSection]} - IxStats`;
  }, [activeSection]);

  const handleLoadToStudio = (words: string[], title: string) => {
    setStudioInitialWords(words);
    setStudioInitialTitle(title);
    handleNavigate("studio");
  };

  const renderActiveSection = () => {
    switch (activeSection) {
      case "overview":
        return <OverviewSection />;
      case "places":
        return <PlacesSection />;
      case "people":
        return <PeopleSection />;
      case "military":
        return <MilitarySection />;
      case "organizations":
        return <OrganizationsSection />;
      case "culture":
        return <CultureSection />;
      case "studio":
        return (
          <StudioSection
            initialWords={studioInitialWords}
            initialTitle={studioInitialTitle}
            onClearInitial={() => {
              setStudioInitialWords(undefined);
              setStudioInitialTitle(undefined);
            }}
          />
        );
      case "bank":
        return <StashSection onLoadToStudio={handleLoadToStudio} />;
      default:
        return <OverviewSection />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased p-4 sm:p-6 transition-colors duration-300">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex justify-end border-b border-border/40 pb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setShowHelpModal(true)}
              title="Open Walkthrough Guide"
              className="flex items-center justify-center rounded-lg border border-border/40 bg-secondary/20 hover:bg-[#0091ff]/10 hover:text-[#0091ff] hover:border-[#0091ff]/30 text-muted-foreground h-9 w-9 transition-all active:scale-95 cursor-pointer"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleNavigate("bank")}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
                activeSection === "bank"
                  ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.15)]"
                  : "border-border/40 bg-secondary/20 hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-500/30 text-muted-foreground"
              }`}
            >
              <Bookmark className="h-3.5 w-3.5" />
              <span>Stash</span>
            </button>
            <button
              onClick={() => handleNavigate("studio")}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
                activeSection === "studio"
                  ? "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/30 shadow-[0_0_10px_rgba(236,72,153,0.15)]"
                  : "border-border/40 bg-secondary/20 hover:bg-pink-500/10 hover:text-pink-600 dark:hover:text-pink-400 hover:border-pink-500/30 text-muted-foreground"
              }`}
            >
              <Wrench className="h-3.5 w-3.5" />
              <span>Custom Studio</span>
            </button>
          </div>
        </div>

        {/* Sliding Navigation Tabs */}
        <div className="rounded-xl overflow-hidden shadow-sm border border-border/30">
          <FacetTabs
            tabs={ONOMA_TABS}
            activeTab={activeSection}
            onChange={(id) => handleNavigate(id as OnomaSection)}
            tone="accent"
            size="md"
          />
        </div>

        {/* Workspace Canvas (Frosted glass with dynamic themed borders & shadow transitions) */}
        <FacetMaterial
          material="satin"
          className="border transition-all duration-500 p-5 sm:p-6 shadow-xl"
          style={{
            borderColor: `${SECTION_COLORS[activeSection]}20`,
            boxShadow: `0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 0 15px 0px ${SECTION_COLORS[activeSection]}08`,
          }}
        >
          {renderActiveSection()}
        </FacetMaterial>

      </div>

      {/* Help Walkthrough Guide Modal */}
      <OnomaHelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
    </div>
  );
}

export default OnomaRouter;
