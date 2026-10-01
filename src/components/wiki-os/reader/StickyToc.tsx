"use client";
// src/components/wiki-os/reader/StickyToc.tsx

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Xmark as X,
  NavArrowUp as ChevronUp,
  NavArrowDown as ChevronDown,
} from "iconoir-react";
import type { TocEntry } from "~/lib/wiki-os/transformers/html-transformer";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { Button } from "~/components/ui/button";

interface StickyTocProps {
  entries: TocEntry[];
  contentRef: React.RefObject<HTMLElement | null>;
  isCollapsed?: boolean;
}

function highlightText(element: HTMLElement, query: string) {
  if (!element || !query) return;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");

  const walk = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walk.nextNode())) {
    const parentName = node.parentNode?.nodeName?.toLowerCase();
    if (parentName === "script" || parentName === "style" || parentName === "textarea") {
      continue;
    }
    if (node.nodeValue && node.nodeValue.match(regex)) {
      nodes.push(node as Text);
    }
  }

  for (const textNode of nodes) {
    const parent = textNode.parentNode;
    if (!parent) continue;

    const val = textNode.nodeValue ?? "";
    const matches = val.split(regex);

    const frag = document.createDocumentFragment();
    for (const part of matches) {
      if (part.toLowerCase() === query.toLowerCase()) {
        const mark = document.createElement("mark");
        mark.className = "wikios-search-match";
        mark.textContent = part;
        frag.appendChild(mark);
      } else {
        frag.appendChild(document.createTextNode(part));
      }
    }

    parent.replaceChild(frag, textNode);
  }
}

export function StickyToc({ entries, contentRef, isCollapsed = false }: StickyTocProps) {
  const { activeSectionId } = useWikiContext();
  const activeId = activeSectionId;
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const originalHtml = useRef<string | null>(null);

  const visibleEntries = useMemo(() => entries.filter((e) => e.level <= 3), [entries]);

  // Close and clean search state
  const handleCloseSearch = () => {
    setSearchQuery("");
    setShowSearch(false);
    setMatchCount(0);
    setCurrentMatchIndex(-1);
    const container = contentRef.current;
    if (container && originalHtml.current) {
      container.innerHTML = originalHtml.current;
      originalHtml.current = null;
    }
  };

  // Reset search and original HTML when entries (page) change
  useEffect(() => {
    originalHtml.current = null;
    // oxlint-disable-next-line
    setSearchQuery("");
    setShowSearch(false);
    setMatchCount(0);
    setCurrentMatchIndex(-1);
    // oxlint-disable-next-line
  }, [entries]);

  // Find in page search highlighting effect
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    if (searchQuery && !originalHtml.current) {
      originalHtml.current = container.innerHTML;
    }

    if (originalHtml.current) {
      container.innerHTML = originalHtml.current;
    }

    if (!searchQuery.trim()) {
      // oxlint-disable-next-line
      setMatchCount(0);
      setCurrentMatchIndex(-1);
      return;
    }

    highlightText(container, searchQuery.trim());

    const matches = container.querySelectorAll(".wikios-search-match");
    setMatchCount(matches.length);
    setCurrentMatchIndex(matches.length > 0 ? 0 : -1);
  }, [searchQuery, contentRef]);

  // Cycle current active match and scroll it into view
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const matches = container.querySelectorAll(".wikios-search-match");
    matches.forEach((m, idx) => {
      if (idx === currentMatchIndex) {
        m.classList.add("wikios-search-match-active");
        m.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        m.classList.remove("wikios-search-match-active");
      }
    });
  }, [currentMatchIndex, contentRef]);

  const handleNext = () => {
    if (matchCount <= 0) return;
    setCurrentMatchIndex((prev: number) => (prev + 1) % matchCount);
  };

  const handlePrev = () => {
    if (matchCount <= 0) return;
    setCurrentMatchIndex((prev: number) => (prev - 1 + matchCount) % matchCount);
  };

  if (isCollapsed) return null;

  return (
    <nav
      className="wikios-sticky-toc transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300 ease-out select-none"
      aria-label="Table of contents"
    >
      <div className="wikios-sticky-toc-header">
        {showSearch ? (
          <div className="wikios-sticky-toc-search-container">
            <div className="wikios-sticky-toc-search-input-wrapper">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find in page..."
                className="wikios-sticky-toc-search-input"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    handleCloseSearch();
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    if (e.shiftKey) {
                      handlePrev();
                    } else {
                      handleNext();
                    }
                  }
                }}
              />
              {searchQuery && (
                <span className="wikios-sticky-toc-search-count">
                  {matchCount > 0 ? `${currentMatchIndex + 1}/${matchCount}` : "0/0"}
                </span>
              )}
            </div>
            <div className="wikios-sticky-toc-search-nav">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Previous match"
                onClick={handlePrev}
                disabled={matchCount === 0}
                title="Previous match"
                className="text-label-secondary size-6 shrink-0"
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Next match"
                onClick={handleNext}
                disabled={matchCount === 0}
                title="Next match"
                className="text-label-secondary size-6 shrink-0"
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close search"
                onClick={handleCloseSearch}
                title="Close search"
                className="text-label-secondary hover:text-red size-6 shrink-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ) : (
          <>
            <span>On this page</span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Find on page"
              onClick={() => setShowSearch(true)}
              title="Find on page"
              className="text-label-secondary size-6 shrink-0"
            >
              <Search className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>
      <div className="wikios-sticky-toc-list">
        {visibleEntries.map((item: TocEntry) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`wikios-sticky-toc-item ${activeId === item.id ? "wikios-sticky-toc-item--active" : ""}`}
            style={{ paddingLeft: `${(item.level - 2) * 12 + 12}px` }}
          >
            <span className="wikios-sticky-toc-text">{item.text}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
