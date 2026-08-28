"use client";
// src/components/wiki-os/reader/hero/HeroSpotlightSearch.tsx
// Inline Apple Spotlight Search Bar for WikiOS Hero with featured thumbnail images, direct DB queries, page creation, and keyboard navigation.

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
import { soundEffects } from "~/lib/sound/cuelume";

interface HeroSpotlightSearchProps {
  className?: string;
  placeholderHints?: string[];
}

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

  // Debounce search query (120ms for instant native database spotlight feel)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 120);
    return () => clearTimeout(timer);
  }, [query]);

  const deferredQuery = useDeferredValue(debouncedQuery);

  // Direct native database query with featured image thumbnails
  const { data: searchData, isFetching: isLoading } = api.wikios.advancedSearch.useQuery(
    { query: deferredQuery, limit: 8 },
    {
      enabled: isOpen && deferredQuery.length >= 1,
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
      soundEffects.press();
      setIsOpen(false);
      router.push(withBasePath(`/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`));
    },
    [router]
  );

  const handleCreatePage = useCallback(
    (rawTitle: string) => {
      soundEffects.press();
      setIsOpen(false);
      const encodedTitle = encodeURIComponent(rawTitle.trim().replace(/ /g, "_"));
      router.push(withBasePath(`/wiki/${encodedTitle}/edit?mode=visual`));
    },
    [router]
  );

  const navigateToSearchPage = useCallback(
    (searchTerms: string) => {
      soundEffects.press();
      setIsOpen(false);
      router.push(withBasePath(`/wiki/search?q=${encodeURIComponent(searchTerms)}`));
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
      soundEffects.tick();
      setSelectedIndex((prev) => Math.min(prev + 1, totalOptions - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      soundEffects.tick();
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
          "flex w-full cursor-text items-center justify-between gap-2.5 rounded-xl px-3.5 py-2 transition-all duration-200 sm:px-4",
          "border border-black/[0.08] dark:border-white/[0.1]",
          "bg-white/75 backdrop-blur-2xl dark:bg-zinc-900/75",
          "shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_4px_16px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_24px_rgba(0,0,0,0.3)]",
          isOpen
            ? "border-blue-500/50 bg-white/95 shadow-lg ring-2 ring-blue-500/15 dark:border-blue-400/50 dark:bg-zinc-900/95"
            : "hover:border-black/20 hover:bg-white/90 dark:hover:border-white/20 dark:hover:bg-zinc-900/90"
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Search
            className={cn(
              "h-4 w-4 shrink-0 transition-colors",
              isOpen ? "text-blue-500" : "text-wiki dark:text-blue-400"
            )}
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
              className="text-foreground placeholder:text-muted-foreground/60 w-full border-none bg-transparent p-0 text-xs leading-normal outline-none focus:ring-0 sm:text-sm"
            />
          </div>
        </div>

        {/* Clear Button or Cmd+K Badge */}
        {query ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setQuery("");
              inputRef.current?.focus();
            }}
            className="text-muted-foreground hover:text-foreground cursor-pointer rounded-md p-1 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            title="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd className="border-border/80 bg-background/80 text-muted-foreground hidden shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium shadow-2xs sm:inline-flex">
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
            className="absolute top-full right-0 left-0 z-50 mt-2 min-w-[320px] overflow-hidden rounded-2xl border border-black/[0.08] bg-white/95 p-1.5 shadow-2xl backdrop-blur-2xl dark:border-white/[0.1] dark:bg-zinc-950/95"
          >
            {/* Header / Results Count */}
            <div className="text-muted-foreground border-border/40 mb-1 flex items-center justify-between border-b px-2.5 py-1.5 text-[10px] font-semibold tracking-wider uppercase">
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
                  "group mb-1 flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border px-3 py-2 text-left transition-all",
                  selectedIndex === results.length
                    ? "border-blue-500/35 bg-blue-500/15 font-semibold text-blue-600 dark:text-blue-400"
                    : "border-blue-500/20 bg-blue-500/5 text-blue-600 hover:bg-blue-500/10 dark:text-blue-400"
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="shrink-0 rounded-lg bg-blue-500/20 p-1.5 text-blue-500">
                    <Plus className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="block truncate text-xs font-semibold">
                      Create new page: &ldquo;
                      <span className="text-foreground">{query.trim()}</span>&rdquo;
                    </span>
                    <span className="text-muted-foreground/80 block text-[10px]">
                      Start writing in WikiOS visual & source editor
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
              </button>
            )}

            {/* Results Stream */}
            {isLoading ? (
              <div className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-center text-xs">
                <Search className="h-3.5 w-3.5 animate-pulse" />
                <span>Searching knowledge graph...</span>
              </div>
            ) : results.length === 0 && query.trim().length > 0 ? (
              <div className="text-muted-foreground py-5 text-center text-xs">
                No matching articles found. Press Enter or click above to create it!
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
                        "group flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
                        isSelected
                          ? "border border-blue-500/20 bg-blue-500/10 dark:bg-blue-500/15"
                          : "border border-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        {/* Featured Image Thumbnail or Fallback Icon */}
                        {item.thumbnail ? (
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-black/[0.08] bg-black/[0.04] shadow-2xs dark:border-white/[0.1] dark:bg-white/[0.06]">
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
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors",
                              isSelected
                                ? "bg-blue-500/20 text-blue-500"
                                : isCat
                                  ? "bg-amber-500/10 text-amber-500"
                                  : "text-muted-foreground bg-black/5 dark:bg-white/5"
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
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "truncate text-xs font-semibold",
                                isSelected ? "text-blue-600 dark:text-blue-400" : "text-foreground"
                              )}
                            >
                              {displayTitle}
                            </span>
                            {isCat && (
                              <span className="py-0.2 rounded bg-amber-500/15 px-1.5 text-[9px] font-medium text-amber-600 dark:text-amber-400">
                                Category
                              </span>
                            )}
                          </div>
                          {snippet ? (
                            <p className="text-muted-foreground mt-0.5 truncate text-[11px] leading-tight">
                              {snippet}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {isSelected && <CornerDownLeft className="h-3 w-3 shrink-0 text-blue-500" />}
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
                      "border-border/40 mt-1 flex w-full cursor-pointer items-center justify-between rounded-xl border-t px-2.5 py-2 text-left transition-colors",
                      selectedIndex === results.length + 1
                        ? "bg-blue-500/10 font-semibold text-blue-600 dark:text-blue-400"
                        : "text-muted-foreground hover:text-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                    )}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <Search className="h-3.5 w-3.5 text-blue-500" />
                      <span>
                        Search all entries for &ldquo;
                        <strong className="text-foreground">{query.trim()}</strong>&rdquo;
                      </span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                  </button>
                )}
              </div>
            )}

            {/* Micro navigation tip footer */}
            <div className="text-muted-foreground/60 border-border/20 mt-1 flex items-center justify-between border-t px-2.5 pt-1.5 pb-0.5 text-[9.5px] select-none">
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
