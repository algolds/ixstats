// src/components/wiki-os/reader/hero/HeroSpotlightSearch.tsx
// Inline Apple Spotlight Search Bar for WikiOS Hero with featured thumbnail images, direct DB queries, page creation, and keyboard navigation.

"use client";

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
    setSelectedIndex(0);
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
    return snippetHtml.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
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
          "w-full flex items-center justify-between gap-2.5 px-3.5 sm:px-4 py-2 rounded-xl transition-all duration-200 cursor-text",
          "border border-black/[0.08] dark:border-white/[0.1]",
          "bg-white/75 dark:bg-zinc-900/75 backdrop-blur-2xl",
          "shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_4px_16px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_24px_rgba(0,0,0,0.3)]",
          isOpen
            ? "border-blue-500/50 dark:border-blue-400/50 ring-2 ring-blue-500/15 bg-white/95 dark:bg-zinc-900/95 shadow-lg"
            : "hover:border-black/20 dark:hover:border-white/20 hover:bg-white/90 dark:hover:bg-zinc-900/90"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Search className={cn("h-4 w-4 shrink-0 transition-colors", isOpen ? "text-blue-500" : "text-[#1d4e89] dark:text-[#60a5fa]")} />
          <div className="relative flex-1 min-w-0 flex items-center">
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
              className="w-full bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/60 outline-none border-none p-0 focus:ring-0 leading-normal"
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
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd className="hidden sm:inline-flex text-[10px] font-medium border border-border/80 px-1.5 py-0.5 rounded-md bg-background/80 text-muted-foreground shrink-0 shadow-2xs">
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
            className="absolute top-full left-0 right-0 mt-2 z-50 overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl shadow-2xl p-1.5 min-w-[320px]"
          >
            {/* Header / Results Count */}
            <div className="px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between border-b border-border/40 mb-1">
              <span>{isLoading ? "Searching encyclopedia..." : results.length > 0 ? "Articles & Categories" : "Direct Actions"}</span>
              {results.length > 0 && <span className="tabular-nums font-medium">{results.length} found</span>}
            </div>

            {/* Create Page Quick Action (Always available when query is typed) */}
            {query.trim().length > 0 && (
              <button
                type="button"
                onClick={() => handleCreatePage(query.trim())}
                onMouseEnter={() => setSelectedIndex(results.length)}
                className={cn(
                  "w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-left transition-all cursor-pointer mb-1 border group",
                  selectedIndex === results.length
                    ? "bg-blue-500/15 border-blue-500/35 text-blue-600 dark:text-blue-400 font-semibold"
                    : "bg-blue-500/5 hover:bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-500 shrink-0">
                    <Plus className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold block truncate">
                      Create new page: &ldquo;<span className="text-foreground">{query.trim()}</span>&rdquo;
                    </span>
                    <span className="text-[10px] text-muted-foreground/80 block">
                      Start writing in WikiOS visual & source editor
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </button>
            )}

            {/* Results Stream */}
            {isLoading ? (
              <div className="py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Search className="h-3.5 w-3.5 animate-pulse" />
                <span>Searching knowledge graph...</span>
              </div>
            ) : results.length === 0 && query.trim().length > 0 ? (
              <div className="py-5 text-center text-xs text-muted-foreground">
                No matching articles found. Press Enter or click above to create it!
              </div>
            ) : (
              <div className="max-h-[340px] overflow-y-auto space-y-0.5">
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
                        "w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-xl text-left transition-colors cursor-pointer group",
                        isSelected
                          ? "bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20"
                          : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04] border border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Featured Image Thumbnail or Fallback Icon */}
                        {item.thumbnail ? (
                          <div className="relative h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.1] shadow-2xs">
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
                              "h-10 w-10 rounded-lg shrink-0 flex items-center justify-center transition-colors",
                              isSelected
                                ? "bg-blue-500/20 text-blue-500"
                                : isCat
                                ? "bg-amber-500/10 text-amber-500"
                                : "bg-black/5 dark:bg-white/5 text-muted-foreground"
                            )}
                          >
                            {isCat ? <Folder className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "text-xs font-semibold truncate",
                                isSelected ? "text-blue-600 dark:text-blue-400" : "text-foreground"
                              )}
                            >
                              {displayTitle}
                            </span>
                            {isCat && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium">
                                Category
                              </span>
                            )}
                          </div>
                          {snippet ? (
                            <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                              {snippet}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {isSelected && <CornerDownLeft className="h-3 w-3 text-blue-500 shrink-0" />}
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
                      "w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-colors cursor-pointer mt-1 border-t border-border/40",
                      selectedIndex === results.length + 1
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                    )}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <Search className="h-3.5 w-3.5 text-blue-500" />
                      <span>Search all entries for &ldquo;<strong className="text-foreground">{query.trim()}</strong>&rdquo;</span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                  </button>
                )}
              </div>
            )}

            {/* Micro navigation tip footer */}
            <div className="px-2.5 pt-1.5 pb-0.5 text-[9.5px] text-muted-foreground/60 flex items-center justify-between select-none border-t border-border/20 mt-1">
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
