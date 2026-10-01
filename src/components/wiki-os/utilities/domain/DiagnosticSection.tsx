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
import { RadioCard, RadioCardGroup } from "~/components/ui/radio-card";
import { Button } from "~/components/ui/button";

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
      color: "border-yellow/20 bg-yellow/10 text-yellow",
    },
    {
      id: "deadEnds",
      title: "Dead-End Pages Scanner",
      description: "Pages with 0 outgoing wikilinks or citations.",
      legacyAlias: "Special:DeadendPages",
      icon: LinkSlash,
      count: deadEnds?.length ?? 0,
      badge: "0 Outbound",
      color: "border-indigo/20 bg-indigo/10 text-indigo",
    },
    {
      id: "brokenRedirects",
      title: "Broken Redirects Detector",
      description: "Redirect aliases pointing to non-existent or archived targets.",
      legacyAlias: "Special:BrokenRedirects",
      icon: WarningTriangle,
      count: brokenRedirects?.length ?? 0,
      badge: "Broken Links",
      color: "border-red/20 bg-red/10 text-red",
    },
    {
      id: "short",
      title: "Short & Stub Articles",
      description: "Articles with minimal word counts requiring expansion.",
      legacyAlias: "Special:ShortPages",
      icon: Page,
      count: shortestArticles?.length ?? 0,
      badge: "Stubs",
      color: "border-blue/20 bg-blue/10 text-blue",
    },
    {
      id: "long",
      title: "Long & Comprehensive Articles",
      description: "Major flagship lore documents with extensive word counts.",
      legacyAlias: "Special:LongPages",
      icon: Page,
      count: longestArticles?.length ?? 0,
      badge: "Flagship",
      color: "border-green/20 bg-green/10 text-green",
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
        <Activity className="text-green h-4 w-4" />
        <h3 className="text-label-secondary text-subhead">
          Health & Link Integrity Diagnostics ({filteredCards.length})
        </h3>
      </div>

      {/* Card Selector Pills */}
      <RadioCardGroup
        aria-label="Diagnostics"
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as NonNullable<typeof activeTab>)}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
      >
        {filteredCards.map((card) => {
          const Icon = card.icon;
          return (
            <RadioCard
              key={card.id}
              value={card.id}
              indicator={false}
              // Pressing the open diagnostic again closes its inspector.
              onClick={(e) => {
                if (activeTab === card.id) {
                  e.preventDefault();
                  setActiveTab(null);
                }
              }}
              className="group flex-col items-stretch justify-between gap-0 p-4"
            >
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div
                    className={`rounded-control flex h-8 w-8 items-center justify-center border ${card.color}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="border-separator bg-fill-3 text-label text-caption rounded-full border px-2 py-0.5">
                    {card.count}
                  </span>
                </div>
                <h4 className="text-label group-hover:text-tint text-caption font-semibold">
                  {card.title}
                </h4>
                <p className="text-label-secondary text-footnote mt-1 line-clamp-1">
                  {card.description}
                </p>
              </div>

              <div className="text-label-secondary text-footnote mt-2 tabular-nums opacity-60">
                {card.legacyAlias}
              </div>
            </RadioCard>
          );
        })}
      </RadioCardGroup>

      {/* Live Data Inspector Table (Collapsed by Default) */}
      <AnimatePresence>
        {activeTab && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.98 }}
            animate={{ opacity: 1, height: "auto", scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.98 }}
            transition={{ type: "spring", bounce: 0.1, duration: 0.3 }}
            className="border-separator bg-surface rounded-row shadow-card overflow-hidden border"
          >
            <div className="border-separator bg-fill-4 flex items-center justify-between border-b px-4 py-3">
              <span className="text-label text-caption">
                Live Inspector:{" "}
                <span className="text-tint font-semibold">
                  {cards.find((c) => c.id === activeTab)?.title}
                </span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-label-secondary text-footnote">
                  Showing top results from PostgreSQL index
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close Inspector"
                  onClick={() => setActiveTab(null)}
                  title="Close Inspector"
                  className="text-label-secondary"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="divide-separator max-h-72 divide-y overflow-y-auto p-2">
              {activeTab === "orphans" && (
                <div>
                  {loadingOrphans ? (
                    <div className="text-label-secondary text-footnote flex items-center justify-center p-8">
                      <Refresh className="mr-2 h-4 w-4 animate-spin" /> Scanning orphan articles...
                    </div>
                  ) : orphans && orphans.length > 0 ? (
                    <div className="space-y-1">
                      {orphans.map((item: any, idx: number) => (
                        <div
                          key={item.id || item.slug || `orphan-${idx}`}
                          className="hover:bg-fill-4 rounded-control text-footnote flex items-center justify-between px-3 py-2 transition-colors"
                        >
                          <Link
                            href={withBasePath(
                              `/wiki/${encodeURIComponent(item.slug || item.title)}`
                            )}
                            data-cuelume-press="page"
                            data-cuelume-hover="tick"
                            className="text-label hover:text-tint font-medium hover:underline"
                          >
                            {item.title}
                          </Link>
                          <span className="text-label-secondary text-footnote tabular-nums">
                            {item.length} bytes
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-footnote text-green flex flex-col items-center justify-center p-6 text-center">
                      <CheckCircle className="mb-1 h-5 w-5" />
                      <span>Zero orphan pages detected — 100% graph connectivity!</span>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "deadEnds" && (
                <div>
                  {loadingDeadEnds ? (
                    <div className="text-label-secondary text-footnote flex items-center justify-center p-8">
                      <Refresh className="mr-2 h-4 w-4 animate-spin" /> Scanning dead-end pages...
                    </div>
                  ) : deadEnds && deadEnds.length > 0 ? (
                    <div className="space-y-1">
                      {deadEnds.map((item: any, idx: number) => (
                        <div
                          key={item.id || item.slug || `deadend-${idx}`}
                          className="hover:bg-fill-4 rounded-control text-footnote flex items-center justify-between px-3 py-2 transition-colors"
                        >
                          <Link
                            href={withBasePath(
                              `/wiki/${encodeURIComponent(item.slug || item.title)}`
                            )}
                            data-cuelume-press="page"
                            data-cuelume-hover="tick"
                            className="text-label hover:text-tint font-medium hover:underline"
                          >
                            {item.title}
                          </Link>
                          <span className="text-label-secondary text-footnote tabular-nums">
                            {item.length} bytes
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-footnote text-green flex flex-col items-center justify-center p-6 text-center">
                      <CheckCircle className="mb-1 h-5 w-5" />
                      <span>All lore articles have active outbound wikilinks!</span>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "brokenRedirects" && (
                <div>
                  {loadingRedirects ? (
                    <div className="text-label-secondary text-footnote flex items-center justify-center p-8">
                      <Refresh className="mr-2 h-4 w-4 animate-spin" /> Inspecting redirects...
                    </div>
                  ) : brokenRedirects && brokenRedirects.length > 0 ? (
                    <div className="space-y-1">
                      {brokenRedirects.map((item: any, idx: number) => (
                        <div
                          key={item.id || item.slug || `broken-${idx}`}
                          className="hover:bg-fill-4 rounded-control text-footnote flex items-center justify-between px-3 py-2 transition-colors"
                        >
                          <span className="text-label font-medium">{item.title}</span>
                          <span className="text-footnote text-red tabular-nums">
                            Target missing: [[{item.targetSlug}]]
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-footnote text-green flex flex-col items-center justify-center p-6 text-center">
                      <CheckCircle className="mb-1 h-5 w-5" />
                      <span>Zero broken redirects — all aliases resolve cleanly!</span>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "short" && (
                <div>
                  {loadingShort ? (
                    <div className="text-label-secondary text-footnote flex items-center justify-center p-8">
                      <Refresh className="mr-2 h-4 w-4 animate-spin" /> Loading short articles...
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {shortestArticles?.map((item: any, idx: number) => (
                        <div
                          key={item.id || item.slug || `short-${idx}`}
                          className="hover:bg-fill-4 rounded-control text-footnote flex items-center justify-between px-3 py-2 transition-colors"
                        >
                          <Link
                            href={withBasePath(
                              `/wiki/${encodeURIComponent(item.slug || item.title)}`
                            )}
                            data-cuelume-press="page"
                            data-cuelume-hover="tick"
                            className="text-label hover:text-tint font-medium hover:underline"
                          >
                            {item.title}
                          </Link>
                          <span className="text-label-secondary text-footnote tabular-nums">
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
                    <div className="text-label-secondary text-footnote flex items-center justify-center p-8">
                      <Refresh className="mr-2 h-4 w-4 animate-spin" /> Loading flagship articles...
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {longestArticles?.map((item: any, idx: number) => (
                        <div
                          key={item.id || item.slug || `long-${idx}`}
                          className="hover:bg-fill-4 rounded-control text-footnote flex items-center justify-between px-3 py-2 transition-colors"
                        >
                          <Link
                            href={withBasePath(
                              `/wiki/${encodeURIComponent(item.slug || item.title)}`
                            )}
                            data-cuelume-press="page"
                            data-cuelume-hover="tick"
                            className="text-label hover:text-tint font-medium hover:underline"
                          >
                            {item.title}
                          </Link>
                          <span className="text-footnote text-green tabular-nums">
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
