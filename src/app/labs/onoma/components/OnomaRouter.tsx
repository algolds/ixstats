"use client";

// src/app/labs/onoma/components/OnomaRouter.tsx
// Onoma Lab — Unified Workspace & Router (Facet Rebuild)

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { withBasePath } from "~/lib/base-path";
import type { OnomaSection, StudioSubTab } from "~/lib/onoma/types";
import { getSectionFromPathname, getStudioSubTabFromPathname } from "~/lib/onoma/types";
import { FacetTabs } from "~/components/facet-ui";
import { FacetMaterial } from "~/components/facet-ui";
import { useNameBank } from "~/hooks/useNameBank";
import {
  Compass,
  MapPin,
  Users,
  Shield,
  Building2,
  Globe,
  Wrench,
  Bookmark,
  HelpCircle,
  ArrowLeft,
  SlidersHorizontal,
  BookOpen,
  AudioLines,
} from "lucide-react";
import { api } from "~/trpc/react";
import { getGoogleFontLink } from "~/lib/onoma/branding-utils";

// Import sections
import OverviewSection from "./sections/OverviewSection";
import PlacesSection from "./sections/PlacesSection";
import PeopleSection from "./sections/PeopleSection";
import MilitarySection from "./sections/MilitarySection";
import OrganizationsSection from "./sections/OrganizationsSection";
import CultureSection from "./sections/CultureSection";
import StudioSection from "./sections/StudioSection";
import StashSection from "./sections/StashSection";
import SettingsSection from "./sections/SettingsSection";
import OnomaHelpModal from "./shared/OnomaHelpModal";

const SECTION_TITLES: Record<OnomaSection, string> = {
  overview: "Overview",
  places: "Places",
  people: "People",
  military: "Military",
  organizations: "Organizations",
  culture: "Culture",
  studio: "Studio",
  bank: "Stash",
  settings: "Settings",
};

// Human label for a studio sub-tab (used in document titles).
const studioSubTabLabel = (t: StudioSubTab) =>
  t === "workshop"
    ? "Model Workshop"
    : t === "namesets"
      ? "Name Sets"
      : t === "phonology"
        ? "IPA Studio"
        : "Lexicon Dictionary";

const SECTION_COLORS: Record<OnomaSection, string> = {
  overview: "#0091ff",
  places: "#10b981",
  people: "#a855f7",
  military: "#ef4444",
  organizations: "#f59e0b",
  culture: "#06b6d4",
  studio: "#ec4899",
  bank: "#6366f1",
  settings: "#0091ff",
};

const ONOMA_TABS = [
  {
    id: "overview",
    label: "Overview",
    icon: Compass,
    themeColor: "#0091ff",
    glowClassName: "bg-[#0091ff]/20 dark:bg-[#0091ff]/10",
    activeIndicatorClassName:
      "bg-[#0091ff]/5 border-[#0091ff]/20 text-[#0091ff] dark:text-[#33a7ff] shadow-[inset_0_1px_0_rgba(0,145,255,0.15)]",
    activeTextClassName: "text-[#0091ff] dark:text-[#33a7ff]",
    activeIconClassName: "text-[#0091ff] dark:text-[#33a7ff]",
  },
  {
    id: "places",
    label: "Places",
    icon: MapPin,
    themeColor: "#10b981",
    glowClassName: "bg-emerald-500/20 dark:bg-emerald-500/10",
    activeIndicatorClassName:
      "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-[inset_0_1px_0_rgba(16,185,129,0.15)]",
    activeTextClassName: "text-emerald-600 dark:text-emerald-400",
    activeIconClassName: "text-emerald-500 dark:text-emerald-400",
  },
  {
    id: "people",
    label: "People",
    icon: Users,
    themeColor: "#a855f7",
    glowClassName: "bg-purple-500/20 dark:bg-purple-500/10",
    activeIndicatorClassName:
      "bg-purple-500/5 border-purple-500/20 text-purple-600 dark:text-purple-400 shadow-[inset_0_1px_0_rgba(168,85,247,0.15)]",
    activeTextClassName: "text-purple-600 dark:text-purple-400",
    activeIconClassName: "text-purple-500 dark:text-purple-400",
  {
    id: "organizations",
    label: "Organizations",
    icon: Building2,
    themeColor: "#f59e0b",
    glowClassName: "bg-amber-500/20 dark:bg-amber-500/10",
    activeIndicatorClassName:
      "bg-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-400 shadow-[inset_0_1px_0_rgba(245,158,11,0.15)]",
    activeTextClassName: "text-amber-600 dark:text-amber-400",
    activeIconClassName: "text-amber-500 dark:text-amber-400",
  },
  {
    id: "culture",
    label: "Culture",
    icon: Globe,
    themeColor: "#06b6d4",
    glowClassName: "bg-cyan-500/20 dark:bg-cyan-500/10",
    activeIndicatorClassName:
      "bg-cyan-500/5 border-cyan-500/20 text-cyan-600 dark:text-cyan-400 shadow-[inset_0_1px_0_rgba(6,182,212,0.15)]",
    activeTextClassName: "text-cyan-600 dark:text-cyan-400",
    activeIconClassName: "text-cyan-500 dark:text-cyan-400",
  },
];

export function OnomaRouter() {
  const pathname = usePathname();
  const { data: speechConfig } = api.onoma.getSpeechConfig.useQuery();

  const fontLink = useMemo(() => {
    return getGoogleFontLink(speechConfig?.brand?.fontFamily || "Inter");
  }, [speechConfig?.brand?.fontFamily]);

  // Active section state
  const [activeSection, setActiveSection] = useState<OnomaSection>(() =>
    getSectionFromPathname(pathname)
  );

  // Active sub-tab state for Markov Studio
  const [activeSubTab, setActiveSubTab] = useState<StudioSubTab>(() =>
    getStudioSubTabFromPathname(pathname)
  );

  // Track the last standard tab visited (default to overview)
  const [lastActiveTab, setLastActiveTab] = useState<OnomaSection>(() => {
    const initial = getSectionFromPathname(pathname);
    return initial === "bank" || initial === "studio" || initial === "settings"
      ? "overview"
      : initial;
  });

  const bank = useNameBank();

  const [shouldAnimateStash, setShouldAnimateStash] = useState(false);
  const prevStashCount = useRef<number | null>(null);

  const bankLength = bank.nameBank?.length ?? 0;

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    if (prevStashCount.current !== null && bankLength > prevStashCount.current) {
      setShouldAnimateStash(true);
      t = setTimeout(() => setShouldAnimateStash(false), 600);
    }
    prevStashCount.current = bankLength;
    return () => {
      if (t) clearTimeout(t);
    };
  }, [bankLength]);

  // Dynamic lexicon terms count computation
  const lexiconCount = useMemo(() => {
    if (!bank.nameBank) return 0;
    const stashedNames = bank.nameBank
      .filter((entry) => entry.type === "saved-name")
      .map((entry) => entry.title);

    if (typeof window !== "undefined") {
      const defsJson = localStorage.getItem("onoma-lexicon-definitions");
      if (defsJson) {
        try {
          const defs = JSON.parse(defsJson);
          const termsSet = new Set<string>([...stashedNames, ...Object.keys(defs)]);
          return termsSet.size;
        } catch {
          // ignore
        }
      }
    }
    return new Set(stashedNames).size;
  }, [bank.nameBank]);

  // Dynamic Studio Navigation Tabs
  const studioTabs = useMemo(
    () => [
      {
        id: "exit-studio",
        label: "Exit Studio",
        icon: ArrowLeft,
        themeColor: "#ec4899",
        glowClassName: "bg-pink-500/10 dark:bg-pink-500/5",
        activeIndicatorClassName:
          "bg-pink-500/5 border-pink-500/20 text-pink-600 dark:text-pink-400",
        activeTextClassName: "text-pink-600 dark:text-pink-400",
        activeIconClassName: "text-pink-500 dark:text-pink-400",
      },
      {
        id: "workshop",
        label: "Model Workshop",
        icon: SlidersHorizontal,
        themeColor: "#0091ff",
        glowClassName: "bg-[#0091ff]/20 dark:bg-[#0091ff]/10",
        activeIndicatorClassName:
          "bg-[#0091ff]/5 border-[#0091ff]/20 text-[#0091ff] dark:text-[#33a7ff] shadow-[inset_0_1px_0_rgba(0,145,255,0.15)]",
        activeTextClassName: "text-[#0091ff] dark:text-[#33a7ff]",
        activeIconClassName: "text-[#0091ff] dark:text-[#33a7ff]",
      },
      {
        id: "namesets",
        label: "Name Sets",
        icon: Users,
        themeColor: "#8b5cf6",
        glowClassName: "bg-violet-500/20 dark:bg-violet-500/10",
        activeIndicatorClassName:
          "bg-violet-500/5 border-violet-500/20 text-violet-600 dark:text-violet-400 shadow-[inset_0_1px_0_rgba(139,92,246,0.15)]",
        activeTextClassName: "text-violet-600 dark:text-violet-400",
        activeIconClassName: "text-violet-500 dark:text-violet-400",
      },
      {
        id: "lexicon",
        label: lexiconCount > 0 ? `Lexicon Dictionary (${lexiconCount})` : "Lexicon Dictionary",
        icon: BookOpen,
        themeColor: "#10b981",
        glowClassName: "bg-emerald-500/20 dark:bg-emerald-500/10",
        activeIndicatorClassName:
          "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-[inset_0_1px_0_rgba(16,185,129,0.15)]",
        activeTextClassName: "text-emerald-600 dark:text-emerald-400",
        activeIconClassName: "text-emerald-500 dark:text-emerald-400",
      },
      {
        id: "phonology",
        label: "IPA Studio",
        icon: AudioLines,
        themeColor: "#8b5cf6",
        glowClassName: "bg-violet-500/20 dark:bg-violet-500/10",
        activeIndicatorClassName:
          "bg-violet-500/5 border-violet-500/20 text-violet-600 dark:text-violet-400 shadow-[inset_0_1px_0_rgba(139,92,246,0.15)]",
        activeTextClassName: "text-violet-600 dark:text-violet-400",
        activeIconClassName: "text-violet-500 dark:text-violet-400",
      },
    ],
    [lexiconCount]
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

  // States to pass data to Studio from Name Bank
  const [studioInitialWords, setStudioInitialWords] = useState<string[] | undefined>(undefined);
  const [studioInitialTitle, setStudioInitialTitle] = useState<string | undefined>(undefined);

  // Handle Studio-specific subtab navigation
  const handleNavigateStudio = useCallback((tab: StudioSubTab) => {
    setActiveSubTab(tab);
    const href = `/labs/onoma/studio/${tab}`;
    window.history.pushState(null, "", withBasePath(href));
    document.title = `Onoma Lab - Studio: ${studioSubTabLabel(tab)} - IxStats`;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // Handle SPA navigation
  const handleNavigate = useCallback(
    (section: OnomaSection) => {
      if (section === activeSection) {
        // If unclicking stash, studio, or settings, return to the last standard tab
        if (section === "bank" || section === "studio" || section === "settings") {
          handleNavigate(lastActiveTab);
        }
        return;
      }

      // Track the last standard tab visited
      if (section !== "bank" && section !== "studio" && section !== "settings") {
        setLastActiveTab(section);
      }

      setActiveSection(section);

      // Sync URL without triggering Next.js route transitions
      const href =
        section === "overview"
          ? "/labs/onoma"
          : section === "studio"
            ? `/labs/onoma/studio/${activeSubTab}`
            : `/labs/onoma/${section}`;
      window.history.pushState(null, "", withBasePath(href));

      // Update document title
      document.title =
        section === "studio"
          ? `Onoma Lab - Studio: ${studioSubTabLabel(activeSubTab)} - IxStats`
          : `Onoma Lab - ${SECTION_TITLES[section]} - IxStats`;

      // Scroll to top
      window.scrollTo({ top: 0, behavior: "instant" });
    },
    [activeSection, lastActiveTab, activeSubTab]
  );

  // Handle browser back/forward navigation
  useEffect(() => {
    const onPopState = () => {
      const newSection = getSectionFromPathname(window.location.pathname);
      setActiveSection(newSection);
      if (newSection === "studio") {
        setActiveSubTab(getStudioSubTabFromPathname(window.location.pathname));
      }
      if (newSection !== "bank" && newSection !== "studio" && newSection !== "settings") {
        setLastActiveTab(newSection);
      }
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
      if (routeSection !== "bank" && routeSection !== "studio" && routeSection !== "settings") {
        setLastActiveTab(routeSection);
      }
    }
    if (routeSection === "studio") {
      setActiveSubTab(getStudioSubTabFromPathname(pathname));
    }
  }, [pathname, activeSection]);

  // Set document title on load/change
  useEffect(() => {
    if (activeSection === "studio") {
      document.title = `Onoma Lab - Studio: ${studioSubTabLabel(activeSubTab)} - IxStats`;
    } else {
      document.title = `Onoma Lab - ${SECTION_TITLES[activeSection]} - IxStats`;
    }
  }, [activeSection, activeSubTab]);

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
            activeSubTab={activeSubTab}
            setActiveSubTab={setActiveSubTab}
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
      case "settings":
        return <SettingsSection />;
      default:
        return <OverviewSection />;
    }
  };

  return (
    <div className="bg-background text-foreground min-h-screen p-4 antialiased transition-colors duration-300 sm:p-6">
      {fontLink && <link rel="stylesheet" href={fontLink} />}
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="border-border/40 flex justify-end border-b pb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setShowHelpModal(true)}
              title="Open Walkthrough Guide"
              className="border-border/40 bg-secondary/20 text-muted-foreground flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border transition-all hover:border-[#0091ff]/30 hover:bg-[#0091ff]/10 hover:text-[#0091ff] active:scale-95"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <motion.button
              animate={shouldAnimateStash ? { scale: [1, 1.15, 0.95, 1.05, 1] } : { scale: 1 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              onClick={() => handleNavigate("bank")}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                activeSection === "bank"
                  ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-600 shadow-[0_0_10px_rgba(99,102,241,0.15)] dark:text-indigo-400"
                  : "border-border/40 bg-secondary/20 text-muted-foreground hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400"
              }`}
            >
              <motion.span
                animate={shouldAnimateStash ? { rotate: [0, -18, 15, -10, 8, 0] } : { rotate: 0 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="inline-flex"
              >
                <Bookmark className="h-3.5 w-3.5" />
              </motion.span>
              <span>Stash</span>
            </motion.button>
            <button
              onClick={() => handleNavigate("studio")}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                activeSection === "studio"
                  ? "border-pink-500/30 bg-pink-500/10 text-pink-600 shadow-[0_0_10px_rgba(236,72,153,0.15)] dark:text-pink-400"
                  : "border-border/40 bg-secondary/20 text-muted-foreground hover:border-pink-500/30 hover:bg-pink-500/10 hover:text-pink-600 dark:hover:text-pink-400"
              }`}
            >
              <Wrench className="h-3.5 w-3.5" />
              <span>Studio</span>
            </button>
            <button
              onClick={() => handleNavigate("settings")}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                activeSection === "settings"
                  ? "border-[#0091ff]/30 bg-[#0091ff]/10 text-[#0091ff] shadow-[0_0_10px_rgba(0,145,255,0.15)] dark:text-[#33a7ff]"
                  : "border-border/40 bg-secondary/20 text-muted-foreground hover:border-[#0091ff]/30 hover:bg-[#0091ff]/10 hover:text-[#0091ff] dark:hover:text-[#33a7ff]"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Settings</span>
            </button>
          </div>
        </div>

        {/* Sliding Navigation Tabs */}
        <div className="border-border/30 overflow-hidden rounded-xl border shadow-sm">
          <FacetTabs
            tabs={activeSection === "studio" ? studioTabs : ONOMA_TABS}
            activeTab={activeSection === "studio" ? activeSubTab : activeSection}
            onChange={(id) => {
              if (activeSection === "studio") {
                if (id === "exit-studio") {
                  handleNavigate(lastActiveTab);
                } else {
                  handleNavigateStudio(id as StudioSubTab);
                }
              } else {
                handleNavigate(id as OnomaSection);
              }
            }}
            tone="accent"
            size="md"
          />
        </div>

        {/* Workspace Canvas (Frosted glass with dynamic themed borders & shadow transitions) */}
        <FacetMaterial
          material="satin"
          className="border p-5 shadow-xl transition-all duration-500 sm:p-6"
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
