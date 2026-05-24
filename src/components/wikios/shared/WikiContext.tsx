// src/components/wikios/shared/WikiContext.tsx
// Context for passing WikiOS state (TOC, current article) to the Dynamic Island.
// Provides article metadata, TOC entries, and session tracking for wiki mode.

"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { withBasePath, navigateWithBasePath } from "~/lib/base-path";
import type { TocEntry } from "~/lib/wikios/html-transformer";

interface WikiContextState {
  /** Whether we're on a WikiOS page */
  isWikiPage: boolean;
  /** Current article title (null if not on an article page) */
  articleTitle: string | null;
  /** TOC entries for the current article */
  tocEntries: TocEntry[];
  /** Currently active section ID (tracked by IntersectionObserver) */
  activeSectionId: string | null;
  /** Recent wiki articles visited (from sessionStorage, newest first) */
  recentArticles: string[];
  /** Set the wiki page state */
  setWikiPage: (title: string | null, toc: TocEntry[]) => void;
  /** Update the active section */
  setActiveSectionId: (id: string | null) => void;
  /** Navigate to a section */
  navigateToSection: (id: string) => void;
  /** Navigate to a recently visited wiki article */
  restoreSession: (title?: string) => void;
}

const WikiContext = createContext<WikiContextState>({
  isWikiPage: false,
  articleTitle: null,
  tocEntries: [],
  activeSectionId: null,
  recentArticles: [],
  setWikiPage: () => {},
  setActiveSectionId: () => {},
  navigateToSection: () => {},
  restoreSession: () => {},
});

export function WikiContextProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [articleTitle, setArticleTitle] = useState<string | null>(null);
  const [tocEntries, setTocEntries] = useState<TocEntry[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [recentArticles, setRecentArticles] = useState<string[]>([]);

  // Restore recent articles from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("wikios:recentArticles");
      if (stored) setRecentArticles(JSON.parse(stored));
    } catch { /* SSR or private browsing */ }
  }, []);

  const setWikiPage = useCallback((title: string | null, toc: TocEntry[]) => {
    setArticleTitle(title);
    setTocEntries(toc);

    // Track recent articles in sessionStorage (last 5, no duplicates)
    if (title && title !== "Main Page") {
      try {
        setRecentArticles((prev) => {
          const filtered = prev.filter((t) => t !== title);
          const next = [title, ...filtered].slice(0, 5);
          sessionStorage.setItem("wikios:recentArticles", JSON.stringify(next));
          return next;
        });
      } catch { /* ignore */ }
    }
  }, []);

  const navigateToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `#${id}`);
    }
  }, []);

  const restoreSession = useCallback((title?: string) => {
    const target = title ?? recentArticles[0];
    if (target) {
      navigateWithBasePath(`/w/${encodeURIComponent(target.replace(/ /g, "_"))}`, router);
    }
  }, [recentArticles, router]);

  return (
    <WikiContext.Provider
      value={{
        isWikiPage: articleTitle !== null,
        articleTitle,
        tocEntries,
        activeSectionId,
        recentArticles,
        setWikiPage,
        setActiveSectionId,
        navigateToSection,
        restoreSession,
      }}
    >
      {children}
    </WikiContext.Provider>
  );
}

export function useWikiContext() {
  return useContext(WikiContext);
}
