"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Activity,
  WarningTriangle,
  LinkSlash,
  EyeClosed,
  Page,
  Refresh,
  CheckCircle,
  Xmark as X,
} from "iconoir-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";

interface DiagnosticSectionProps {
  searchFilter: string;
}

export function DiagnosticSection({ searchFilter }: DiagnosticSectionProps) {
  const [activeTab, setActiveTab] = useState<
    "orphans" | "deadEnds" | "brokenRedirects" | "short" | "long" | null
  >(null);

  const query = searchFilter.toLowerCase().trim();

  // tRPC Queries
  const { data: orphans, isLoading: loadingOrphans } = api.wikios.getOrphanArticles.useQuery({
    limit: 50,
  });
  const { data: deadEnds, isLoading: loadingDeadEnds } = api.wikios.getDeadEndArticles.useQuery({
    limit: 50,
  });
  const { data: brokenRedirects, isLoading: loadingRedirects } =
    api.wikios.getBrokenRedirects.useQuery({
      limit: 50,
    });
  const { data: shortestArticles, isLoading: loadingShort } =
    api.wikios.getShortestArticles.useQuery({
      limit: 25,
    });
  const { data: longestArticles, isLoading: loadingLong } = api.wikios.getLongestArticles.useQuery({
    limit: 25,
  });

  const cards = [
    {
      id: "orphans",
      title: "Orphan Pages Scanner",
      description: "Pages with 0 incoming links from other lore documents.",
      legacyAlias: "Special:LonelyPages",
      icon: EyeClosed,
      count: orphans?.length ?? 0,
      badge: "0 Inbound",
      color: "from-amber-500/10 to-orange-500/10 text-amber-400 border-amber-500/20",
    },
    {
      id: "deadEnds",
      title: "Dead-End Pages Scanner",
      description: "Pages with 0 outgoing wikilinks or citations.",
      legacyAlias: "Special:DeadendPages",
      icon: LinkSlash,
      count: deadEnds?.length ?? 0,
      badge: "0 Outbound",
      color: "from-purple-500/10 to-pink-500/10 text-purple-400 border-purple-500/20",
    },
    {
      id: "brokenRedirects",
      title: "Broken Redirects Detector",
      description: "Redirect aliases pointing to non-existent or archived targets.",
      legacyAlias: "Special:BrokenRedirects",
      icon: WarningTriangle,
      count: brokenRedirects?.length ?? 0,
      badge: "Broken Links",
      color: "from-rose-500/10 to-red-500/10 text-rose-400 border-rose-500/20",
    },
    {
      id: "short",
      title: "Short & Stub Articles",
      description: "Articles with minimal word counts requiring expansion.",
      legacyAlias: "Special:ShortPages",
      icon: Page,
      count: shortestArticles?.length ?? 0,
      badge: "Stubs",
      color: "from-blue-500/10 to-cyan-500/10 text-blue-400 border-blue-500/20",
    },
    {
      id: "long",
      title: "Long & Comprehensive Articles",
      description: "Major flagship lore documents with extensive word counts.",
      legacyAlias: "Special:LongPages",
      icon: Page,
      count: longestArticles?.length ?? 0,
      badge: "Flagship",
      color: "from-emerald-500/10 to-teal-500/10 text-emerald-400 border-emerald-500/20",
    },
  ];

  const filteredCards = cards.filter(
    (c) =>
      !query ||
      c.title.toLowerCase().includes(query) ||
      c.description.toLowerCase().includes(query) ||
      c.legacyAlias.toLowerCase().includes(query)
  );

  if (filteredCards.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Activity className="h-4 w-4 text-emerald-400" />
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Health & Link Integrity Diagnostics ({filteredCards.length})
        </h3>
      </div>

      {/* Card Selector Pills */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {filteredCards.map((card) => {
          const Icon = card.icon;
          const isSelected = activeTab === card.id;
          return (
            <button
              key={card.id}
              type="button"
              data-cuelume-press="soft"
              data-cuelume-hover="tick"
              onClick={() => setActiveTab(activeTab === card.id ? null : (card.id as any))}
              className={`group flex flex-col justify-between rounded-xl border p-4 text-left backdrop-blur-md transition-all duration-200 active:scale-[0.98] ${
                isSelected
                  ? "border-wiki/60 bg-card/90 ring-wiki/30 shadow-md ring-1"
                  : "border-border/40 bg-card/60 hover:border-wiki/30 hover:bg-card/80"
              }`}
            >
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border bg-gradient-to-br ${card.color}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="border-border/40 bg-secondary/50 text-foreground rounded-full border px-2 py-0.5 text-[10px] font-medium">
                    {card.count}
                  </span>
                </div>
                <h4 className="text-foreground group-hover:text-wiki text-xs font-semibold">
                  {card.title}
                </h4>
                <p className="text-muted-foreground mt-1 line-clamp-1 text-[11px]">
                  {card.description}
                </p>
              </div>

              <div className="text-muted-foreground mt-2 font-mono text-[10px] opacity-60">
                {card.legacyAlias}
              </div>
            </button>
          );
        })}
      </div>

      {/* Live Data Inspector Table (Collapsed by Default) */}
      <AnimatePresence>
        {activeTab && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.98 }}
            animate={{ opacity: 1, height: "auto", scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.98 }}
            transition={{ type: "spring", bounce: 0.1, duration: 0.3 }}
            className="border-border/40 bg-card/50 overflow-hidden rounded-xl border shadow-md backdrop-blur-md"
          >
            <div className="border-border/40 bg-muted/20 flex items-center justify-between border-b px-4 py-2.5">
              <span className="text-foreground text-xs font-medium">
                Live Inspector:{" "}
                <span className="text-wiki font-semibold">
                  {cards.find((c) => c.id === activeTab)?.title}
                </span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-[11px]">
                  Showing top results from PostgreSQL index
                </span>
                <button
                  type="button"
                  data-cuelume-press="tap"
                  onClick={() => setActiveTab(null)}
                  className="text-muted-foreground hover:bg-muted/40 hover:text-foreground rounded-md p-1 active:scale-90"
                  title="Close Inspector"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="divide-border/20 max-h-72 divide-y overflow-y-auto p-2">
              {activeTab === "orphans" && (
                <div>
                  {loadingOrphans ? (
                    <div className="text-muted-foreground flex items-center justify-center p-8 text-xs">
                      <Refresh className="mr-2 h-4 w-4 animate-spin" /> Scanning orphan articles...
                    </div>
                  ) : orphans && orphans.length > 0 ? (
                    <div className="space-y-1">
                      {orphans.map((item: any, idx: number) => (
                        <div
                          key={item.id || item.slug || `orphan-${idx}`}
                          className="hover:bg-muted/30 flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors"
                        >
                          <Link
                            href={withBasePath(
                              `/wiki/${encodeURIComponent(item.slug || item.title)}`
                            )}
                            data-cuelume-press="page"
                            data-cuelume-hover="tick"
                            className="text-foreground hover:text-wiki font-medium hover:underline"
                          >
                            {item.title}
                          </Link>
                          <span className="text-muted-foreground font-mono text-[11px]">
                            {item.length} bytes
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-emerald-400">
                      <CheckCircle className="mb-1 h-5 w-5" />
                      <span>Zero orphan pages detected — 100% graph connectivity!</span>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "deadEnds" && (
                <div>
                  {loadingDeadEnds ? (
                    <div className="text-muted-foreground flex items-center justify-center p-8 text-xs">
                      <Refresh className="mr-2 h-4 w-4 animate-spin" /> Scanning dead-end pages...
                    </div>
                  ) : deadEnds && deadEnds.length > 0 ? (
                    <div className="space-y-1">
                      {deadEnds.map((item: any, idx: number) => (
                        <div
                          key={item.id || item.slug || `deadend-${idx}`}
                          className="hover:bg-muted/30 flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors"
                        >
                          <Link
                            href={withBasePath(
                              `/wiki/${encodeURIComponent(item.slug || item.title)}`
                            )}
                            data-cuelume-press="page"
                            data-cuelume-hover="tick"
                            className="text-foreground hover:text-wiki font-medium hover:underline"
                          >
                            {item.title}
                          </Link>
                          <span className="text-muted-foreground font-mono text-[11px]">
                            {item.length} bytes
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-emerald-400">
                      <CheckCircle className="mb-1 h-5 w-5" />
                      <span>All lore articles have active outbound wikilinks!</span>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "brokenRedirects" && (
                <div>
                  {loadingRedirects ? (
                    <div className="text-muted-foreground flex items-center justify-center p-8 text-xs">
                      <Refresh className="mr-2 h-4 w-4 animate-spin" /> Inspecting redirects...
                    </div>
                  ) : brokenRedirects && brokenRedirects.length > 0 ? (
                    <div className="space-y-1">
                      {brokenRedirects.map((item: any, idx: number) => (
                        <div
                          key={item.id || item.slug || `broken-${idx}`}
                          className="hover:bg-muted/30 flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors"
                        >
                          <span className="text-foreground font-medium">{item.title}</span>
                          <span className="font-mono text-[11px] text-rose-400">
                            Target missing: [[{item.targetSlug}]]
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-emerald-400">
                      <CheckCircle className="mb-1 h-5 w-5" />
                      <span>Zero broken redirects — all aliases resolve cleanly!</span>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "short" && (
                <div>
                  {loadingShort ? (
                    <div className="text-muted-foreground flex items-center justify-center p-8 text-xs">
                      <Refresh className="mr-2 h-4 w-4 animate-spin" /> Loading short articles...
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {shortestArticles?.map((item: any, idx: number) => (
                        <div
                          key={item.id || item.slug || `short-${idx}`}
                          className="hover:bg-muted/30 flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors"
                        >
                          <Link
                            href={withBasePath(
                              `/wiki/${encodeURIComponent(item.slug || item.title)}`
                            )}
                            data-cuelume-press="page"
                            data-cuelume-hover="tick"
                            className="text-foreground hover:text-wiki font-medium hover:underline"
                          >
                            {item.title}
                          </Link>
                          <span className="text-muted-foreground font-mono text-[11px]">
                            {item.wordCount} words ({item.readingTime}m read)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "long" && (
                <div>
                  {loadingLong ? (
                    <div className="text-muted-foreground flex items-center justify-center p-8 text-xs">
                      <Refresh className="mr-2 h-4 w-4 animate-spin" /> Loading flagship articles...
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {longestArticles?.map((item: any, idx: number) => (
                        <div
                          key={item.id || item.slug || `long-${idx}`}
                          className="hover:bg-muted/30 flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors"
                        >
                          <Link
                            href={withBasePath(
                              `/wiki/${encodeURIComponent(item.slug || item.title)}`
                            )}
                            data-cuelume-press="page"
                            data-cuelume-hover="tick"
                            className="text-foreground hover:text-wiki font-medium hover:underline"
                          >
                            {item.title}
                          </Link>
                          <span className="font-mono text-[11px] text-emerald-400">
                            {item.wordCount} words ({item.readingTime}m read)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
