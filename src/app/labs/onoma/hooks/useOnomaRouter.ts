"use client";

// src/app/labs/onoma/hooks/useOnomaRouter.ts
// Encapsulated state management and navigation routing for Onoma (Product Model: CREATE · STUDIO · EXPLORE)

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { withBasePath } from "~/lib/base-path";
import type { OnomaSection, StudioSubTab, ExploreSubTab } from "~/lib/onoma/types";
import {
  getSectionFromPathname,
  getStudioSubTabFromPathname,
  getExploreSubTabFromPathname,
} from "~/lib/onoma/types";
import { useNameBank } from "~/hooks/useNameBank";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { getGoogleFontLink } from "~/lib/onoma/branding-utils";
import {
  SECTION_TITLES,
  studioSubTabLabel,
  exploreSubTabLabel,
} from "../components/nav/onoma-tabs";
import { useOnomaPronunciation } from "./useOnomaPronunciation";

export function useOnomaRouter() {
  const pathname = usePathname();
  // oxlint-disable-next-line eslint/no-unused-vars
  const { isSignedIn, isLoaded } = useUser();
  const { data: speechConfig } = api.onoma.getSpeechConfig.useQuery();

  const fontLink = useMemo(() => {
    return getGoogleFontLink(speechConfig?.brand?.fontFamily || "Inter");
  }, [speechConfig?.brand?.fontFamily]);

  // Pronunciation hook
  const { hasInteractedPronunciation, setHasInteractedPronunciation, playPronunciation } =
    useOnomaPronunciation({
      kokoroEnabled: Boolean(speechConfig?.kokoro?.enabled),
      kokoroVoice: speechConfig?.kokoro?.voice,
    });

  // Active top-level section state
  const [activeSection, setActiveSection] = useState<OnomaSection>(() => {
    const initial = getSectionFromPathname(pathname);
    const rawSegment = pathname.split("/labs/onoma")[1]?.replace(/^\//, "") || "";
    if (isSignedIn && !rawSegment) {
      return "overview";
    }
    return initial;
  });

  // Active sub-tab state for STUDIO (Construction Engine)
  const [activeSubTab, setActiveSubTab] = useState<StudioSubTab>(() =>
    getStudioSubTabFromPathname(pathname)
  );

  // Active sub-tab state for EXPLORE (Analysis & Understanding Engine)
  const [activeExploreSubTab, setActiveExploreSubTab] = useState<ExploreSubTab>(() =>
    getExploreSubTabFromPathname(pathname)
  );

  // Track the last standard CREATE tab visited (default to overview)
  const [lastActiveTab, setLastActiveTab] = useState<OnomaSection>(() => {
    const initial = getSectionFromPathname(pathname);
    return initial === "bank" ||
      initial === "studio" ||
      initial === "explore" ||
      initial === "settings"
      ? "overview"
      : initial;
  });

  const isUtilityOrMode = useCallback(
    (s: OnomaSection) => s === "bank" || s === "studio" || s === "explore" || s === "settings",
    []
  );

  const bank = useNameBank();

  // Stash animation trigger
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

  // Help walkthrough modal state & mode
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpModalMode, setHelpModalMode] = useState<"walkthrough" | "module">("module");

  const openHelp = useCallback((mode: "walkthrough" | "module" = "module") => {
    setHelpModalMode(mode);
    setShowHelpModal(true);
  }, []);

  // Auto-open guide for first-time visitors in walkthrough mode
  useEffect(() => {
    const seen = localStorage.getItem("onoma-welcome-seen");
    if (!seen) {
      setHelpModalMode("walkthrough");
      setShowHelpModal(true);
    }
  }, []);

  // States to pass data to Studio from Stash
  const [studioInitialWords, setStudioInitialWords] = useState<string[] | undefined>(undefined);
  const [studioInitialTitle, setStudioInitialTitle] = useState<string | undefined>(undefined);

  // Handle Studio-specific subtab navigation
  const handleNavigateStudio = useCallback(
    (tab: StudioSubTab, words?: string[], title?: string) => {
      if (words && words.length > 0) {
        setStudioInitialWords(words);
        setStudioInitialTitle(title || "Custom Corpus");
      }
      setActiveSection("studio");
      setActiveSubTab(tab);
      const href = `/labs/onoma/studio/${tab}`;
      window.history.pushState(null, "", withBasePath(href));
      document.title = `Onoma Studio — ${studioSubTabLabel(tab)}`;
      window.scrollTo({ top: 0, behavior: "instant" });
    },
    []
  );

  // Handle Explore-specific subtab navigation
  const handleNavigateExplore = useCallback(
    (tab: ExploreSubTab, words?: string[], title?: string) => {
      if (words && words.length > 0) {
        setStudioInitialWords(words);
        setStudioInitialTitle(title || "Custom Corpus");
      }
      setActiveSection("explore");
      setActiveExploreSubTab(tab);
      const href = `/labs/onoma/explore/${tab}`;
      window.history.pushState(null, "", withBasePath(href));
      document.title = `Onoma Explore — ${exploreSubTabLabel(tab)}`;
      window.scrollTo({ top: 0, behavior: "instant" });
    },
    []
  );

  // Handle top-level SPA navigation
  const handleNavigate = useCallback(
    (section: OnomaSection) => {
      // Toggle behavior if clicking the same utility button
      if (section === activeSection) {
        if (isUtilityOrMode(section)) {
          handleNavigate(lastActiveTab);
        }
        return;
      }

      if (!isUtilityOrMode(section)) {
        setLastActiveTab(section);
      }

      setActiveSection(section);

      const href =
        section === "overview"
          ? "/labs/onoma"
          : section === "bank"
            ? "/labs/onoma/stash"
            : section === "studio"
              ? `/labs/onoma/studio/${activeSubTab}`
              : section === "explore"
                ? `/labs/onoma/explore/${activeExploreSubTab}`
                : `/labs/onoma/${section}`;
      window.history.pushState(null, "", withBasePath(href));

      document.title =
        section === "studio"
          ? `Onoma Studio — ${studioSubTabLabel(activeSubTab)}`
          : section === "explore"
            ? `Onoma Explore — ${exploreSubTabLabel(activeExploreSubTab)}`
            : `Onoma — ${SECTION_TITLES[section]}`;

      window.scrollTo({ top: 0, behavior: "instant" });
    },
    [activeSection, lastActiveTab, activeSubTab, activeExploreSubTab, isUtilityOrMode]
  );

  // Handle browser back/forward navigation
  useEffect(() => {
    const onPopState = () => {
      const newSection = getSectionFromPathname(window.location.pathname);
      setActiveSection(newSection);
      if (newSection === "studio") {
        setActiveSubTab(getStudioSubTabFromPathname(window.location.pathname));
      } else if (newSection === "explore") {
        setActiveExploreSubTab(getExploreSubTabFromPathname(window.location.pathname));
      }
      if (!isUtilityOrMode(newSection)) {
        setLastActiveTab(newSection);
      }
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isUtilityOrMode]);

  // Sync state if pathname changes externally
  useEffect(() => {
    const routeSection = getSectionFromPathname(pathname);
    if (routeSection !== activeSection) {
      setActiveSection(routeSection);
      if (!isUtilityOrMode(routeSection)) {
        setLastActiveTab(routeSection);
      }
    }
    if (routeSection === "studio") {
      setActiveSubTab(getStudioSubTabFromPathname(pathname));
    } else if (routeSection === "explore") {
      setActiveExploreSubTab(getExploreSubTabFromPathname(pathname));
    }
  }, [pathname, activeSection, isUtilityOrMode]);

  // Set document title on load/change
  useEffect(() => {
    if (activeSection === "studio") {
      document.title = `Onoma Studio — ${studioSubTabLabel(activeSubTab)}`;
    } else if (activeSection === "explore") {
      document.title = `Onoma Explore — ${exploreSubTabLabel(activeExploreSubTab)}`;
    } else {
      document.title = `Onoma — ${SECTION_TITLES[activeSection]}`;
    }
  }, [activeSection, activeSubTab, activeExploreSubTab]);

  const handleLoadToStudio = useCallback(
    (words: string[], title: string) => {
      setStudioInitialWords(words);
      setStudioInitialTitle(title);
      handleNavigateStudio("workshop");
    },
    [handleNavigateStudio]
  );

  const handleClearStudioInitial = useCallback(() => {
    setStudioInitialWords(undefined);
    setStudioInitialTitle(undefined);
  }, []);

  return {
    fontLink,
    activeSection,
    activeSubTab,
    activeExploreSubTab,
    lastActiveTab,
    lexiconCount,
    shouldAnimateStash,
    hasInteractedPronunciation,
    setHasInteractedPronunciation,
    playPronunciation,
    showHelpModal,
    setShowHelpModal,
    helpModalMode,
    openHelp,
    studioInitialWords,
    studioInitialTitle,
    handleNavigate,
    handleNavigateStudio,
    handleNavigateExplore,
    handleLoadToStudio,
    handleClearStudioInitial,
    setActiveSubTab,
    setActiveExploreSubTab,
  };
}
