"use client";

// src/app/labs/onoma/hooks/useOnomaRouter.ts
// Encapsulated state management, navigation routing, and audio interactions for Onoma

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { withBasePath } from "~/lib/base-path";
import type { OnomaSection, StudioSubTab } from "~/lib/onoma/types";
import { getSectionFromPathname, getStudioSubTabFromPathname } from "~/lib/onoma/types";
import { useNameBank } from "~/hooks/useNameBank";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { speakName } from "~/lib/onoma/browser-speech";
import { getGoogleFontLink } from "~/lib/onoma/branding-utils";
import { SECTION_TITLES, studioSubTabLabel } from "../components/nav/onoma-tabs";

export function useOnomaRouter() {
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useUser();
  const { data: speechConfig } = api.onoma.getSpeechConfig.useQuery();

  const fontLink = useMemo(() => {
    return getGoogleFontLink(speechConfig?.brand?.fontFamily || "Inter");
  }, [speechConfig?.brand?.fontFamily]);

  // Active section state
  const [activeSection, setActiveSection] = useState<OnomaSection>(() => {
    const initial = getSectionFromPathname(pathname);
    const rawSegment = pathname.split("/labs/onoma")[1]?.replace(/^\//, "") || "";
    if (isSignedIn && !rawSegment) {
      return "studio";
    }
    return initial;
  });

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

  // When auth state loads, if user is signed in and at the root onoma page, default to Studio
  const hasAppliedAuthDefault = useRef(false);
  useEffect(() => {
    if (!isLoaded || hasAppliedAuthDefault.current) return;
    hasAppliedAuthDefault.current = true;
    const rawSegment = pathname.split("/labs/onoma")[1]?.replace(/^\//, "") || "";
    if (isSignedIn && !rawSegment) {
      setActiveSection("studio");
    }
  }, [isLoaded, isSignedIn, pathname]);

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

  // Pronunciation Audio Attractor State & Player
  const [hasInteractedPronunciation, setHasInteractedPronunciation] = useState(true);
  useEffect(() => {
    const tried = localStorage.getItem("onoma-pronunciation-tried");
    if (!tried) {
      setHasInteractedPronunciation(false);
    }
  }, []);

  const playPronunciation = useCallback(async () => {
    if (!hasInteractedPronunciation) {
      setHasInteractedPronunciation(true);
      localStorage.setItem("onoma-pronunciation-tried", "true");
    }
    const kokoroEnabled = Boolean(speechConfig?.kokoro?.enabled);
    if (kokoroEnabled) {
      try {
        await speakName({
          name: "Onoma",
          ipa: "ˈɒnəmə",
          culture: "constructed",
          kokoroEnabled: true,
          defaultVoice: speechConfig?.kokoro?.voice,
        });
        return;
      } catch (err) {
        console.error("Kokoro TTS failed for hero, falling back to browser speech:", err);
      }
    }

    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance();
    const voices = window.speechSynthesis.getVoices();
    const greekVoice = voices.find((v) => v.lang.startsWith("el-") || v.lang.includes("Greek"));
    if (greekVoice) {
      utterance.voice = greekVoice;
      utterance.text = "Όνομα";
      utterance.lang = "el-GR";
    } else {
      utterance.text = "OH-nuh-muh";
      utterance.lang = "en-US";
      const englishVoice = voices.find(
        (v) => v.lang.startsWith("en-") || v.lang.includes("English")
      );
      if (englishVoice) utterance.voice = englishVoice;
    }
    utterance.rate = 0.82;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }, [hasInteractedPronunciation, speechConfig?.kokoro?.enabled, speechConfig?.kokoro?.voice]);

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

  // Help walkthrough modal
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
    document.title = `Onoma Studio: ${studioSubTabLabel(tab)}`;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // Handle SPA navigation
  const handleNavigate = useCallback(
    (section: OnomaSection) => {
      if (section === activeSection) {
        if (section === "bank" || section === "studio" || section === "settings") {
          handleNavigate(lastActiveTab);
        }
        return;
      }

      if (section !== "bank" && section !== "studio" && section !== "settings") {
        setLastActiveTab(section);
      }

      setActiveSection(section);

      const href =
        section === "overview"
          ? "/labs/onoma"
          : section === "studio"
            ? `/labs/onoma/studio/${activeSubTab}`
            : `/labs/onoma/${section}`;
      window.history.pushState(null, "", withBasePath(href));

      document.title =
        section === "studio"
          ? `Onoma Studio: ${studioSubTabLabel(activeSubTab)}`
          : `Onoma — ${SECTION_TITLES[section]}`;

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
      document.title = `Onoma Studio: ${studioSubTabLabel(activeSubTab)} — Linguistic Engine`;
    } else {
      document.title = `Onoma — ${SECTION_TITLES[activeSection]}`;
    }
  }, [activeSection, activeSubTab]);

  const handleLoadToStudio = useCallback((words: string[], title: string) => {
    setStudioInitialWords(words);
    setStudioInitialTitle(title);
    handleNavigate("studio");
  }, [handleNavigate]);

  const handleClearStudioInitial = useCallback(() => {
    setStudioInitialWords(undefined);
    setStudioInitialTitle(undefined);
  }, []);

  return {
    fontLink,
    activeSection,
    activeSubTab,
    lastActiveTab,
    lexiconCount,
    shouldAnimateStash,
    hasInteractedPronunciation,
    setHasInteractedPronunciation,
    playPronunciation,
    showHelpModal,
    setShowHelpModal,
    studioInitialWords,
    studioInitialTitle,
    handleNavigate,
    handleNavigateStudio,
    handleLoadToStudio,
    handleClearStudioInitial,
    setActiveSubTab,
  };
}
