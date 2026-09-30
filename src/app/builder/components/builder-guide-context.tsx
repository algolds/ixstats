"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import type { BuilderSection } from "../lib/builder-theme";

export type GuideTab = "milestones" | "rules";

export interface GuideOpenOptions {
  tab?: GuideTab;
  section?: BuilderSection;
}

export interface BuilderGuideContextValue {
  guideOpen: boolean;
  activeTab: GuideTab;
  activeSection: BuilderSection;
  openGuide: (options?: GuideOpenOptions) => void;
  closeGuide: () => void;
  setGuideOpen: (open: boolean) => void;
  setActiveTab: (tab: GuideTab) => void;
  setActiveSection: (section: BuilderSection) => void;
  isSectionSeen: (section: BuilderSection) => boolean;
  markSectionSeen: (section: BuilderSection) => void;
}

const GUIDE_STORAGE_VERSION = "2.0";

const BuilderGuideContext = createContext<BuilderGuideContextValue | null>(null);

interface BuilderGuideProviderProps {
  children: React.ReactNode;
  currentSection: BuilderSection;
}

export function BuilderGuideProvider({
  children,
  currentSection,
}: BuilderGuideProviderProps) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<GuideTab>("milestones");
  const [overrideSection, setOverrideSection] = useState<BuilderSection | null>(null);

  const activeSection = overrideSection ?? currentSection;

  const isSectionSeen = useCallback((section: BuilderSection): boolean => {
    if (typeof window === "undefined") return true;
    try {
      const val = localStorage.getItem(`builder-guide-seen-${section}`);
      return val === GUIDE_STORAGE_VERSION;
    } catch {
      return true;
    }
  }, []);

  const markSectionSeen = useCallback((section: BuilderSection) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(`builder-guide-seen-${section}`, GUIDE_STORAGE_VERSION);
    } catch {
      // Storage unavailable or disabled
    }
  }, []);

  const openGuide = useCallback(
    (options?: GuideOpenOptions) => {
      if (options?.section) {
        setOverrideSection(options.section);
      } else {
        setOverrideSection(null);
      }

      if (options?.tab) {
        setActiveTab(options.tab);
      } else {
        setActiveTab("milestones");
      }

      setGuideOpen(true);
    },
    []
  );

  const closeGuide = useCallback(() => {
    setGuideOpen(false);
    markSectionSeen(activeSection);
  }, [activeSection, markSectionSeen]);

  const value = useMemo<BuilderGuideContextValue>(
    () => ({
      guideOpen,
      activeTab,
      activeSection,
      openGuide,
      closeGuide,
      setGuideOpen,
      setActiveTab,
      setActiveSection: (sec) => setOverrideSection(sec),
      isSectionSeen,
      markSectionSeen,
    }),
    [
      guideOpen,
      activeTab,
      activeSection,
      openGuide,
      closeGuide,
      isSectionSeen,
      markSectionSeen,
    ]
  );

  return (
    <BuilderGuideContext.Provider value={value}>
      {children}
    </BuilderGuideContext.Provider>
  );
}

export function useBuilderGuide(): BuilderGuideContextValue {
  const ctx = useContext(BuilderGuideContext);
  if (!ctx) {
    throw new Error("useBuilderGuide must be used within a BuilderGuideProvider");
  }
  return ctx;
}
