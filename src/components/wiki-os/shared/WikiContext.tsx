"use client";
// src/components/wiki-os/shared/WikiContext.tsx
// Context for passing WikiOS state (TOC, current article) to the Dynamic Island.
// Provides article metadata, TOC entries, and session tracking for wiki mode.

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { navigateWithBasePath } from "~/lib/base-path";
import type { TocEntry } from "~/lib/wiki-os/transformers/html-transformer";

export interface WikiThemeColors {
  primary: string;
  secondary: string;
  accent: string;
}

export interface WikiNarratorState {
  isPlaying: boolean;
  activeBlockIndex: number;
  totalBlocks: number;
  activeText: string;
  activeSectionTitle: string;
  speed: number;
  voice: string;
}

export interface WikiNarratorActions {
  play: () => void;
  pause: () => void;
  stop: () => void;
  skipNext: () => void;
  skipPrev: () => void;
  setSpeed: (speed: number) => void;
  setVoice: (voice: string) => void;
  jumpToSection: (id: string) => void;
  jumpToBlock: (index: number) => void;
  clearCache?: () => Promise<void>;
}

interface WikiContextState {
  /** Whether we're on a WikiOS page */
  isWikiPage: boolean;
  /** Current article title (null if not on an article page) */
  articleTitle: string | null;
  /** TOC entries for the current article */
  tocEntries: TocEntry[];
  /** Theme colors of the current wiki article */
  themeColors: WikiThemeColors | null;
  /** Currently active section ID (tracked by IntersectionObserver) */
  activeSectionId: string | null;
  /** Recent wiki articles visited (from sessionStorage, newest first) */
  recentArticles: string[];
  /** Set the wiki page state */
  setWikiPage: (title: string | null, toc: TocEntry[], colors?: WikiThemeColors | null) => void;
  /** Update the active section */
  setActiveSectionId: (id: string | null) => void;
  /** Navigate to a section */
  navigateToSection: (id: string) => void;
  /** Navigate to a recently visited wiki article */
  restoreSession: (title?: string) => void;
  /** Active overlay modal (history, backlinks, or margin inspector) */
  activeModal: "history" | "backlinks" | "margin" | null;
  /** Set the active modal */
  setActiveModal: (modal: "history" | "backlinks" | "margin" | null) => void;
  /** Whether the Margin Split-Canvas suite is open */
  isMarginOpen: boolean;
  /** Set Margin open state */
  setIsMarginOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  /** Active tab in Margin */
  marginTab: "threads" | "markup";
  /** Set Margin active tab */
  setMarginTab: (tab: "threads" | "markup") => void;
  /** Toggle Margin open/close with optional tab */
  toggleMargin: (tab?: "threads" | "markup") => void;
  /** Audio Narrator playback state */
  narratorState: WikiNarratorState;
  /** Update audio narrator playback state */
  setNarratorState: (state: Partial<WikiNarratorState>) => void;
  /** Action hooks for controlling narrator playback */
  narratorActions: WikiNarratorActions | null;
  /** Register narrator playback control action hooks */
  registerNarratorActions: (actions: WikiNarratorActions | null) => void;
}

const WikiContext = createContext<WikiContextState>({
  isWikiPage: false,
  articleTitle: null,
  tocEntries: [],
  themeColors: null,
  activeSectionId: null,
  recentArticles: [],
  setWikiPage: () => {},
  setActiveSectionId: () => {},
  navigateToSection: () => {},
  restoreSession: () => {},
  activeModal: null,
  setActiveModal: () => {},
  isMarginOpen: false,
  setIsMarginOpen: () => {},
  marginTab: "threads",
  setMarginTab: () => {},
  toggleMargin: () => {},
  narratorState: {
    isPlaying: false,
    activeBlockIndex: 0,
    totalBlocks: 0,
    activeText: "",
    activeSectionTitle: "",
    speed: 1.0,
    voice: "",
  },
  setNarratorState: () => {},
  narratorActions: null,
  registerNarratorActions: () => {},
});

export function WikiContextProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [articleTitle, setArticleTitle] = useState<string | null>(null);
  const [tocEntries, setTocEntries] = useState<TocEntry[]>([]);
  const [themeColors, setThemeColors] = useState<WikiThemeColors | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [recentArticles, setRecentArticles] = useState<string[]>([]);
  const [activeModal, setActiveModal] = useState<"history" | "backlinks" | "margin" | null>(null);
  const [isMarginOpen, setIsMarginOpen] = useState(false);
  const [marginTab, setMarginTab] = useState<"threads" | "markup">("threads");

  const toggleMargin = useCallback(
    (tab?: "threads" | "markup") => {
      setIsMarginOpen((prev) => {
        if (!prev && tab) {
          setMarginTab(tab);
          return true;
        }
        if (prev && tab && tab !== marginTab) {
          setMarginTab(tab);
          return true;
        }
        return !prev;
      });
    },
    [marginTab]
  );

  // Narrator state and action hooks
  const [narratorState, setNarratorStateInternal] = useState<WikiNarratorState>({
    isPlaying: false,
    activeBlockIndex: 0,
    totalBlocks: 0,
    activeText: "",
    activeSectionTitle: "",
    speed: 1.0,
    voice: "",
  });
  const [narratorActions, setNarratorActions] = useState<WikiNarratorActions | null>(null);

  const setNarratorState = useCallback((state: Partial<WikiNarratorState>) => {
    setNarratorStateInternal((prev) => ({ ...prev, ...state }));
  }, []);

  const registerNarratorActions = useCallback((actions: WikiNarratorActions | null) => {
    setNarratorActions(actions);
  }, []);

  // Restore recent articles from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("wikios:recentArticles");
      // oxlint-disable-next-line
      if (stored) setRecentArticles(JSON.parse(stored));
    } catch {
      /* SSR or private browsing */
    }
  }, []);

  const setWikiPage = useCallback(
    (title: string | null, toc: TocEntry[], colors: WikiThemeColors | null = null) => {
      setArticleTitle(title);
      setTocEntries(toc);
      setThemeColors(colors);

      // Track recent articles in sessionStorage (last 5, no duplicates)
      if (title && title !== "Main Page") {
        try {
          setRecentArticles((prev) => {
            const filtered = prev.filter((t) => t !== title);
            const next = [title, ...filtered].slice(0, 5);
            sessionStorage.setItem("wikios:recentArticles", JSON.stringify(next));
            return next;
          });
        } catch {
          /* ignore */
        }
      }
    },
    []
  );

  const navigateToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `#${id}`);
    }
  }, []);

  const restoreSession = useCallback(
    (title?: string) => {
      const target = title ?? recentArticles[0];
      if (target) {
        navigateWithBasePath(`/wiki/${encodeURIComponent(target.replace(/ /g, "_"))}`, router);
      }
    },
    [recentArticles, router]
  );

  // Auto-save scroll position on scroll
  useEffect(() => {
    if (!articleTitle || typeof window === "undefined" || articleTitle === "Main Page") return;

    let timeoutId: NodeJS.Timeout;

    const handleScroll = () => {
      // Debounce saving to avoid excessive localStorage writes on every pixel scrolled
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        const pct = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
        const roundedPct = Math.round(pct);

        try {
          const stored = localStorage.getItem("wikios:pausedSessions");
          let sessions: Array<{ title: string; scrollPercent: number; updatedAt: number }> = stored
            ? JSON.parse(stored)
            : [];
          if (!Array.isArray(sessions)) sessions = [];

          const existingIndex = sessions.findIndex((s) => s.title === articleTitle);

          if (existingIndex !== -1 && sessions[existingIndex]) {
            if (sessions[existingIndex].scrollPercent !== roundedPct) {
              sessions[existingIndex].scrollPercent = roundedPct;
              sessions[existingIndex].updatedAt = Date.now();
              sessions.sort((a, b) => b.updatedAt - a.updatedAt);
              localStorage.setItem("wikios:pausedSessions", JSON.stringify(sessions));
            }
          } else {
            sessions.unshift({
              title: articleTitle,
              scrollPercent: roundedPct,
              updatedAt: Date.now(),
            });
            sessions = sessions.slice(0, 5);
            localStorage.setItem("wikios:pausedSessions", JSON.stringify(sessions));
          }
        } catch {
          // ignore
        }
      }, 250);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(timeoutId);
    };
  }, [articleTitle]);

  // Restore scroll position on page load if progress exists
  useEffect(() => {
    if (!articleTitle || typeof window === "undefined" || articleTitle === "Main Page") return;

    try {
      const stored = localStorage.getItem("wikios:pausedSessions");
      if (stored) {
        const sessions: Array<{ title: string; scrollPercent: number; updatedAt: number }> =
          JSON.parse(stored);
        const session = sessions.find((s) => s.title === articleTitle);
        // Only auto-restore progress if it's substantial (between 2% and 98%)
        if (session && session.scrollPercent > 2 && session.scrollPercent < 98) {
          const timer = setTimeout(() => {
            const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
            if (scrollHeight > 0) {
              window.scrollTo({
                top: (session.scrollPercent / 100) * scrollHeight,
                behavior: "smooth",
              });
            }
          }, 350); // 350ms delay to let contents render
          return () => clearTimeout(timer);
        }
      }
    } catch {
      // ignore
    }
    return;
  }, [articleTitle]);

  return (
    <WikiContext.Provider
      value={{
        isWikiPage: articleTitle !== null,
        articleTitle,
        tocEntries,
        themeColors,
        activeSectionId,
        recentArticles,
        setWikiPage,
        setActiveSectionId,
        navigateToSection,
        restoreSession,
        activeModal,
        setActiveModal,
        isMarginOpen,
        setIsMarginOpen,
        marginTab,
        setMarginTab,
        toggleMargin,
        narratorState,
        setNarratorState,
        narratorActions,
        registerNarratorActions,
      }}
    >
      {children}
    </WikiContext.Provider>
  );
}

export function useWikiContext() {
  return useContext(WikiContext);
}
