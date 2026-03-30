// src/components/wikios/shared/WikiContext.tsx
// Context for passing WikiOS state (TOC, current article) to the Dynamic Island.
// Provides article metadata and TOC entries for wiki mode in the command palette.

"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
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
  /** Set the wiki page state */
  setWikiPage: (title: string | null, toc: TocEntry[]) => void;
  /** Update the active section */
  setActiveSectionId: (id: string | null) => void;
  /** Navigate to a section */
  navigateToSection: (id: string) => void;
}

const WikiContext = createContext<WikiContextState>({
  isWikiPage: false,
  articleTitle: null,
  tocEntries: [],
  activeSectionId: null,
  setWikiPage: () => {},
  setActiveSectionId: () => {},
  navigateToSection: () => {},
});

export function WikiContextProvider({ children }: { children: ReactNode }) {
  const [articleTitle, setArticleTitle] = useState<string | null>(null);
  const [tocEntries, setTocEntries] = useState<TocEntry[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  const setWikiPage = useCallback((title: string | null, toc: TocEntry[]) => {
    setArticleTitle(title);
    setTocEntries(toc);
  }, []);

  const navigateToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `#${id}`);
    }
  }, []);

  return (
    <WikiContext.Provider
      value={{
        isWikiPage: articleTitle !== null,
        articleTitle,
        tocEntries,
        activeSectionId,
        setWikiPage,
        setActiveSectionId,
        navigateToSection,
      }}
    >
      {children}
    </WikiContext.Provider>
  );
}

export function useWikiContext() {
  return useContext(WikiContext);
}
