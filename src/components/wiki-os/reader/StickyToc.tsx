// src/components/wiki-os/reader/StickyToc.tsx
"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";
import type { TocEntry } from "~/lib/wiki-os/transformers/html-transformer";

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
  const [activeId, setActiveId] = useState<string | null>(null);
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
    setSearchQuery("");
    setShowSearch(false);
    setMatchCount(0);
    setCurrentMatchIndex(-1);
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

  // Scroll spy to highlight active section
  useEffect(() => {
    const ids = visibleEntries.map((e) => e.id);
    if (ids.length === 0) return;

    function tick() {
      let current: string | null = null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 120) {
            current = id;
          }
        }
      }
      setActiveId(current);
    }

    window.addEventListener("scroll", tick, { passive: true });
    tick();

    return () => window.removeEventListener("scroll", tick);
  }, [visibleEntries]);

  if (isCollapsed) return null;

  return (
    <nav
      className="wikios-sticky-toc transition-all duration-300 ease-out select-none"
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
              <button
                onClick={handlePrev}
                disabled={matchCount === 0}
                className="wikios-sticky-toc-search-nav-btn"
                title="Previous match"
                type="button"
              >
                <ChevronUp size={12} />
              </button>
              <button
                onClick={handleNext}
                disabled={matchCount === 0}
                className="wikios-sticky-toc-search-nav-btn"
                title="Next match"
                type="button"
              >
                <ChevronDown size={12} />
              </button>
              <button
                onClick={handleCloseSearch}
                className="wikios-sticky-toc-search-close"
                title="Close search"
                type="button"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        ) : (
          <>
            <span>On this page</span>
            <button
              onClick={() => setShowSearch(true)}
              className="wikios-sticky-toc-search-btn"
              title="Find on page"
              type="button"
            >
              <Search size={12} />
            </button>
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
