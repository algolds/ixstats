"use client";
// src/components/wiki-os/reader/hero/HeroSpotlightSearch.tsx
// Inline Apple Spotlight Search Bar for WikiOS Hero with featured thumbnail images, direct DB queries, page creation, and keyboard navigation.

import { pageEditHref } from "~/lib/wiki-os/page-tools";
import React, { useState, useEffect, useRef, useDeferredValue, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Xmark as X,
  ArrowRight,
  OpenBook as BookOpen,
  Plus,
  CornerBottomLeft as CornerDownLeft,
  Folder,
} from "iconoir-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";

interface HeroSpotlightSearchProps {
  className?: string;
  placeholderHints?: string[];
}

/** Characters before the typeahead looks anything up. */
const MIN_QUERY_LENGTH = 2;

const DEFAULT_PLACEHOLDERS = [
  "Search all articles, categories, lore...",
  "Search 'Urcea'...",
  "Search 'Caphiria'...",
  "Search 'Juan Kerr'...",
  "Search 'Bureau of International Statistics'...",
  "Search 'Treaty of 1842'...",
];

export function HeroSpotlightSearch({
  className,
  placeholderHints = DEFAULT_PLACEHOLDERS,
}: HeroSpotlightSearchProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  // Cycling placeholder text when idle
  useEffect(() => {
    if (query || isOpen) return;
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholderHints.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [query, isOpen, placeholderHints.length]);

  // Debounce search query (150ms: one title lookup per pause, not per keystroke)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  const deferredQuery = useDeferredValue(debouncedQuery);

  // Title typeahead (prefix + trigram) with featured image thumbnails, from 2 characters
  const { data: searchData, isFetching: isLoading } = api.wikios.typeahead.useQuery(
    { query: deferredQuery, limit: 8 },
    {
      enabled: isOpen && deferredQuery.length >= MIN_QUERY_LENGTH,
      staleTime: 60_000,
    }
  );

  const results = searchData?.results ?? [];

  // Reset selected index when results change
  useEffect(() => {
    // oxlint-disable-next-line
    setSelectedIndex(0);
    // oxlint-disable-next-line
  }, [results.length]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navigateToArticle = useCallback(
    (title: string) => {
      setIsOpen(false);
      router.push(withBasePath(`/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`));
    },
    [router]
  );

  const handleCreatePage = useCallback(
    (rawTitle: string) => {
      setIsOpen(false);
      router.push(withBasePath(pageEditHref(rawTitle.trim(), null, { mode: "visual" })));
    },
    [router]
  );

  const navigateToSearchPage = useCallback(
    (searchTerms: string) => {
      setIsOpen(false);
      router.push(withBasePath(`/util/search?q=${encodeURIComponent(searchTerms)}`));
    },
    [router]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const totalOptions = results.length + (query.trim() ? 2 : 0); // results + create + full search
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      setSelectedIndex((prev) => Math.min(prev + 1, totalOptions - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results.length > 0 && selectedIndex < results.length && results[selectedIndex]) {
        navigateToArticle(results[selectedIndex].title);
      } else if (query.trim() && selectedIndex === results.length) {
        handleCreatePage(query.trim());
      } else if (query.trim()) {
        navigateToSearchPage(query.trim());
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const isCategory = (title: string) => title.startsWith("Category:");

  const cleanSnippet = (snippetHtml?: string) => {
    if (!snippetHtml) return "";
    return snippetHtml
      .replace(/<[^>]+>/g, "")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&");
  };

  return (
    <div ref={containerRef} className={cn("relative w-full select-none", className)}>
      {/* ── Search Input Frame ── */}
      <div
        onClick={() => {
          inputRef.current?.focus();
          setIsOpen(true);
        }}
        className={cn(
          "rounded-row flex w-full cursor-text items-center justify-between gap-2 px-4 py-2 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 sm:px-4",
          "border-separator border",
          "bg-surface",
          "",
          isOpen
            ? "border-tint/50 bg-surface shadow-floating ring-tint/15 ring-2"
            : "hover:border-separator hover:bg-surface"
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Search
            className={cn("h-4 w-4 shrink-0 transition-colors", isOpen ? "text-tint" : "text-tint")}
          />
          <div className="relative flex min-w-0 flex-1 items-center">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!isOpen) setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={placeholderHints[placeholderIndex]}
              className="text-label placeholder:text-label-tertiary text-footnote sm:text-body w-full border-none bg-transparent p-0 leading-normal outline-none focus:ring-0"
            />
          </div>
        </div>

        {/* Clear Button or Cmd+K Badge */}
        {query ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Clear search"
            onClick={(e) => {
              e.stopPropagation();
              setQuery("");
              inputRef.current?.focus();
            }}
            title="Clear search"
            className="text-label-secondary size-6"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <kbd className="border-separator bg-surface text-label-secondary rounded-control-sm text-caption hidden shrink-0 border px-2 py-0.5 sm:inline-flex">
            ⌘K
          </kbd>
        )}
      </div>

      {/* ── Spotlight Live Dropdown Popover ── */}
      <AnimatePresence>
        {isOpen && (deferredQuery.length >= 1 || query.trim().length > 0) && (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-card border-separator bg-surface shadow-floating absolute top-full right-0 left-0 z-50 mt-2 min-w-[320px] overflow-hidden border p-2"
          >
            {/* Header / Results Count */}
            <div className="text-label-secondary border-separator text-eyebrow mb-1 flex items-center justify-between border-b px-3 py-2">
              <span>
                {isLoading
                  ? "Searching encyclopedia..."
                  : results.length > 0
                    ? "Articles & Categories"
                    : "Direct Actions"}
              </span>
              {results.length > 0 && (
                <span className="font-medium tabular-nums">{results.length} found</span>
              )}
            </div>

            {/* Create Page Quick Action (Always available when query is typed) */}
            {query.trim().length > 0 && (
              <button
                type="button"
                onClick={() => handleCreatePage(query.trim())}
                onMouseEnter={() => setSelectedIndex(results.length)}
                className={cn(
                  "group rounded-row mb-1 flex w-full cursor-pointer items-center justify-between gap-2 border px-3 py-2 text-left transition-[color,background-color,border-color,box-shadow,opacity,transform]",
                  selectedIndex === results.length
                    ? "border-tint/35 bg-tint/15 text-tint font-semibold"
                    : "border-tint/20 bg-tint/5 text-tint hover:bg-tint/10"
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <div className="rounded-control bg-tint/20 text-tint shrink-0 p-2">
                    <Plus className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-caption block truncate font-semibold">
                      Create new page: &ldquo;
                      <span className="text-label">{query.trim()}</span>&rdquo;
                    </span>
                    <span className="text-label-secondary text-footnote block">
                      Start writing in WikiOS visual & source editor
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60 transition-[color,background-color,border-color,box-shadow,opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100" />
              </button>
            )}

            {/* Results Stream */}
            {isLoading ? (
              <div className="text-label-secondary text-footnote flex items-center justify-center gap-2 py-6 text-center">
                <Search className="h-3.5 w-3.5 animate-pulse" />
                <span>Searching knowledge graph...</span>
              </div>
            ) : results.length === 0 && query.trim().length > 0 ? (
              <div className="text-label-secondary text-footnote py-5 text-center">
                {query.trim().length < MIN_QUERY_LENGTH
                  ? "Keep typing to search articles…"
                  : "No matching articles found. Press Enter or click above to create it!"}
              </div>
            ) : (
              <div className="max-h-[340px] space-y-0.5 overflow-y-auto">
                {results.map((item, idx) => {
                  const isSelected = selectedIndex === idx;
                  const isCat = isCategory(item.title);
                  const displayTitle = isCat ? item.title.replace(/^Category:/, "") : item.title;
                  const snippet = cleanSnippet(item.snippet);

                  return (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => navigateToArticle(item.title)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        "group rounded-row flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left transition-colors",
                        isSelected
                          ? "border-tint/20 bg-tint/10 border"
                          : "hover:bg-fill-4 border border-transparent"
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        {/* Featured Image Thumbnail or Fallback Icon */}
                        {item.thumbnail ? (
                          <div className="rounded-control border-separator bg-fill-4 relative h-10 w-10 shrink-0 overflow-hidden border">
                            <img
                              src={item.thumbnail}
                              alt={displayTitle}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          <div
                            className={cn(
                              "rounded-control flex h-10 w-10 shrink-0 items-center justify-center transition-colors",
                              isSelected
                                ? "bg-tint/20 text-tint"
                                : isCat
                                  ? "bg-yellow/10 text-yellow"
                                  : "text-label-secondary bg-black/5"
                            )}
                          >
                            {isCat ? (
                              <Folder className="h-4 w-4" />
                            ) : (
                              <BookOpen className="h-4 w-4" />
                            )}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "text-caption truncate font-semibold",
                                isSelected ? "text-tint" : "text-label"
                              )}
                            >
                              {displayTitle}
                            </span>
                            {isCat && (
                              <span className="py-0.2 rounded-control-sm bg-yellow/15 text-caption text-yellow px-2">
                                Category
                              </span>
                            )}
                          </div>
                          {snippet ? (
                            <p className="text-label-secondary text-footnote mt-0.5 truncate leading-tight">
                              {snippet}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {isSelected && <CornerDownLeft className="text-tint h-3 w-3 shrink-0" />}
                    </button>
                  );
                })}

                {/* Full Search Action */}
                {query.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => navigateToSearchPage(query.trim())}
                    onMouseEnter={() => setSelectedIndex(results.length + 1)}
                    className={cn(
                      "border-separator rounded-row mt-1 flex w-full cursor-pointer items-center justify-between border-t px-3 py-2 text-left transition-colors",
                      selectedIndex === results.length + 1
                        ? "bg-tint/10 text-tint font-semibold"
                        : "text-label-secondary hover:text-label hover:bg-fill-4"
                    )}
                  >
                    <div className="text-footnote flex items-center gap-2">
                      <Search className="text-tint h-3.5 w-3.5" />
                      <span>
                        Search all entries for &ldquo;
                        <strong className="text-label">{query.trim()}</strong>&rdquo;
                      </span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                  </button>
                )}
              </div>
            )}

            {/* Micro navigation tip footer */}
            <div className="text-label-secondary border-separator text-footnote mt-1 flex items-center justify-between border-t px-3 pt-2 pb-0.5 select-none">
              <span>↑↓ Navigate</span>
              <span>↵ Select / Create</span>
              <span>Esc Close</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
