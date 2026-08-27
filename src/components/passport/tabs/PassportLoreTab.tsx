"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  OpenBook as BookOpen,
  Globe,
  Trophy,
  Flash,
  ArrowRight,
  PageEdit as EditPencil,
  ChatBubbleCheck as ChatBubble,
  Medal,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Page as FileText,
} from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";
import type { WorkPayload, PassportWiki } from "../types";

interface PassportLoreTabProps {
  work: WorkPayload;
  wiki?: PassportWiki;
  cleanUsername: string;
}

type LoreCategory = "all" | "articles" | "languages" | "directives" | "sports" | "feed";
type LoreCategoryFilter = LoreCategory | null;

export const PassportLoreTab = React.memo(function PassportLoreTab({
  work,
  wiki,
  cleanUsername,
}: PassportLoreTabProps) {
  const [selectedCategory, setSelectedCategory] = useState<LoreCategoryFilter>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const feed = work?.wikiActivityFeed ?? [];
  const articles = work?.authoredArticles ?? [];
  const conlangs = work?.conlangs ?? [];
  const sportTeams = work?.sportTeams ?? [];
  const directives = work?.directives ?? [];
  const total =
    articles.length + conlangs.length + sportTeams.length + directives.length + feed.length ||
    (work?.totalCreations ?? 0);

  const hasAnyWork = total > 0 || feed.length > 0 || wiki?.linked;

  if (!hasAnyWork) {
    return (
      <div className="space-y-3 rounded-3xl border border-black/8 bg-black/[0.015] p-12 text-center dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500">
          <BookOpen className="h-6 w-6" />
        </div>
        <h3 className="text-foreground text-base font-bold">No Published Lore or Activity Found</h3>
        <p className="text-muted-foreground mx-auto max-w-md text-xs">
          @{cleanUsername} has not yet published any WikiOS articles, revisions, language packs, or
          simulation directives.
        </p>
      </div>
    );
  }

  const filteredArticles = articles.filter(
    (a) =>
      !searchQuery ||
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.summary && a.summary.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredFeed = feed.filter(
    (item) =>
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.summary && item.summary.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const isAll = selectedCategory === null || selectedCategory === "all";
  const showArticles = isAll || selectedCategory === "articles";
  const showLangs = isAll || selectedCategory === "languages";
  const showDirectives = isAll || selectedCategory === "directives";
  const showSports = isAll || selectedCategory === "sports";
  const showFeed = isAll || selectedCategory === "feed";

  return (
    <div className="space-y-6">
      {/* 1. Category Filter Pills & Search */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex max-w-fit flex-wrap items-center gap-1.5 rounded-2xl border border-black/6 bg-black/[0.02] p-1 dark:border-white/8 dark:bg-white/[0.02]">
          <button
            type="button"
            onClick={() => setSelectedCategory((c) => (c === "all" ? null : "all"))}
            aria-pressed={selectedCategory === "all"}
            data-cuelume-press="soft"
            className={cn(
              "cursor-pointer rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.97]",
              selectedCategory === "all"
                ? "bg-stone-900 text-white shadow-sm dark:bg-white dark:text-stone-950"
                : "hover:text-foreground text-stone-600 dark:text-stone-400"
            )}
          >
            All Overview ({total})
          </button>

          {articles.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedCategory("articles")}
              data-cuelume-press="soft"
              className={cn(
                "cursor-pointer rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.97]",
                selectedCategory === "articles"
                  ? "bg-stone-900 text-white shadow-sm dark:bg-white dark:text-stone-950"
                  : "hover:text-foreground text-stone-600 dark:text-stone-400"
              )}
            >
              Authored Pages ({articles.length})
            </button>
          )}

          {conlangs.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedCategory("languages")}
              data-cuelume-press="soft"
              className={cn(
                "cursor-pointer rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.97]",
                selectedCategory === "languages"
                  ? "bg-stone-900 text-white shadow-sm dark:bg-white dark:text-stone-950"
                  : "hover:text-foreground text-stone-600 dark:text-stone-400"
              )}
            >
              Languages ({conlangs.length})
            </button>
          )}

          {directives.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedCategory("directives")}
              data-cuelume-press="soft"
              className={cn(
                "cursor-pointer rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.97]",
                selectedCategory === "directives"
                  ? "bg-stone-900 text-white shadow-sm dark:bg-white dark:text-stone-950"
                  : "hover:text-foreground text-stone-600 dark:text-stone-400"
              )}
            >
              Directives ({directives.length})
            </button>
          )}

          {sportTeams.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedCategory("sports")}
              data-cuelume-press="soft"
              className={cn(
                "cursor-pointer rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.97]",
                selectedCategory === "sports"
                  ? "bg-stone-900 text-white shadow-sm dark:bg-white dark:text-stone-950"
                  : "hover:text-foreground text-stone-600 dark:text-stone-400"
              )}
            >
              Clubs ({sportTeams.length})
            </button>
          )}

          {feed.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedCategory("feed")}
              data-cuelume-press="soft"
              className={cn(
                "cursor-pointer rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.97]",
                selectedCategory === "feed"
                  ? "bg-stone-900 text-white shadow-sm dark:bg-white dark:text-stone-950"
                  : "hover:text-foreground text-stone-600 dark:text-stone-400"
              )}
            >
              Activity Stream ({feed.length})
            </button>
          )}
        </div>

        {/* Search input if multiple items */}
        {(articles.length > 4 || feed.length > 6) && (
          <div className="w-full sm:w-56">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search lore & articles..."
              className="text-foreground placeholder:text-muted-foreground w-full rounded-xl border border-black/8 bg-black/[0.02] px-3 py-1.5 font-mono text-xs focus:ring-1 focus:ring-blue-500/40 focus:outline-none dark:border-white/10 dark:bg-white/[0.03]"
            />
          </div>
        )}
      </div>

      {/* 2. Authored Articles Section (Every Page Created by Author) */}
      {showArticles && filteredArticles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-muted-foreground flex items-center gap-1.5 font-mono text-xs font-bold tracking-wider uppercase">
              <BookOpen className="h-3.5 w-3.5 text-blue-500" />
              <span>AUTHORED WIKI PAGES ({filteredArticles.length})</span>
            </h4>
            <Link
              href="/wiki"
              data-cuelume-press="soft"
              className="flex items-center gap-0.5 font-mono text-[11px] text-blue-600 hover:underline dark:text-blue-400"
            >
              <span>Explore WikiOS</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            {filteredArticles.map((item) => (
              <FacetCard
                key={item.id}
                depth={1}
                interactive="hover"
                className="flex flex-col justify-between space-y-3 rounded-3xl border border-black/8 bg-black/[0.015] p-5 shadow-sm transition-all hover:border-black/15 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400">
                      <FileText className="h-3 w-3" />
                      Authored Page
                    </span>
                    <span className="text-muted-foreground font-mono text-[10px]">
                      {new Date(item.updatedAt || item.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-foreground line-clamp-1 text-base font-bold tracking-tight">
                      {item.title}
                    </h3>
                    {item.summary && (
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                        {item.summary}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-black/6 pt-3 dark:border-white/8">
                  <span className="text-muted-foreground font-mono text-[11px] uppercase">
                    WikiOS
                  </span>
                  <Link
                    href={`/wiki/${encodeURIComponent(item.title)}`}
                    data-cuelume-press="soft"
                    className="inline-flex cursor-pointer items-center gap-1 font-mono text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <span>Read Article</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </FacetCard>
            ))}
          </div>
        </div>
      )}

      {/* 3. Canonical Creations (Languages, Directives, Clubs) */}
      {(showLangs || showDirectives || showSports) && (
        <div className="space-y-3 pt-2">
          {isAll && (
            <h4 className="text-muted-foreground font-mono text-xs font-bold tracking-wider uppercase">
              CANONICAL REALM & SYSTEM CREATIONS
            </h4>
          )}

          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            {/* Onoma Conlangs */}
            {showLangs &&
              conlangs.map((item) => (
                <FacetCard
                  key={item.id}
                  depth={1}
                  interactive="hover"
                  className="flex flex-col justify-between space-y-3 rounded-3xl border border-black/8 bg-black/[0.015] p-5 shadow-sm transition-all hover:border-black/15 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 rounded-md border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-purple-600 dark:text-purple-400">
                        <Globe className="h-3 w-3" />
                        Language Pack
                      </span>
                      {item.culturalFamily && (
                        <span className="text-muted-foreground font-mono text-[10px]">
                          {item.culturalFamily}
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-foreground text-base font-bold tracking-tight">
                        {item.name}
                      </h3>
                      {item.description && (
                        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-black/6 pt-3 dark:border-white/8">
                    <span className="text-muted-foreground font-mono text-[11px] uppercase">
                      Onoma
                    </span>
                    <Link
                      href={`/onoma/pack/${item.slug || item.id}`}
                      data-cuelume-press="soft"
                      className="inline-flex cursor-pointer items-center gap-1 font-mono text-xs font-bold text-purple-600 hover:underline dark:text-purple-400"
                    >
                      <span>View Pack</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </FacetCard>
              ))}

            {/* Enacted Directives */}
            {showDirectives &&
              directives.map((item) => (
                <FacetCard
                  key={item.id}
                  depth={1}
                  interactive="hover"
                  className="flex flex-col justify-between space-y-3 rounded-3xl border border-black/8 bg-black/[0.015] p-5 shadow-sm transition-all hover:border-black/15 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-600 dark:text-amber-400">
                        <Flash className="h-3 w-3" />
                        Directive
                      </span>
                      <span className="text-muted-foreground font-mono text-[10px] uppercase">
                        {item.tier} Tier
                      </span>
                    </div>

                    <div>
                      <h3 className="text-foreground text-sm font-bold tracking-tight">
                        {item.goal}
                      </h3>
                      {item.summary && (
                        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                          {item.summary}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-black/6 pt-3 dark:border-white/8">
                    <span className="text-muted-foreground font-mono text-[11px] capitalize">
                      {item.category || "Governance"}
                    </span>
                    <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      {item.status}
                    </span>
                  </div>
                </FacetCard>
              ))}

            {/* Sports Clubs */}
            {showSports &&
              sportTeams.map((item) => (
                <FacetCard
                  key={item.id}
                  depth={1}
                  interactive="hover"
                  className="flex flex-col justify-between space-y-3 rounded-3xl border border-black/8 bg-black/[0.015] p-5 shadow-sm transition-all hover:border-black/15 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        <Trophy className="h-3 w-3" />
                        Athletic Club
                      </span>
                      {item.city && (
                        <span className="text-muted-foreground font-mono text-[10px]">
                          {item.city}
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-foreground text-base font-bold tracking-tight">
                        {item.name}
                      </h3>
                      {item.shortName && (
                        <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                          Abbreviation: {item.shortName}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-black/6 pt-3 dark:border-white/8">
                    <span className="text-muted-foreground font-mono text-[11px] uppercase">
                      MyLeague
                    </span>
                    <Link
                      href="/sports"
                      data-cuelume-press="soft"
                      className="inline-flex cursor-pointer items-center gap-1 font-mono text-xs font-bold text-emerald-600 hover:underline dark:text-emerald-400"
                    >
                      <span>View Club</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </FacetCard>
              ))}
          </div>
        </div>
      )}

      {/* 4. Full Database Activity Stream */}
      {showFeed && filteredFeed.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-muted-foreground flex items-center gap-1.5 font-mono text-xs font-bold tracking-wider uppercase">
              <EditPencil className="h-3.5 w-3.5 text-blue-500" />
              <span>FULL WIKIOS & DATABASE ACTIVITY STREAM ({filteredFeed.length})</span>
            </h4>
            <Link
              href={`/wiki/contributions/${encodeURIComponent(wiki?.username || cleanUsername)}`}
              data-cuelume-press="soft"
              className="flex items-center gap-0.5 font-mono text-[11px] text-blue-600 hover:underline dark:text-blue-400"
            >
              <span>View All</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {filteredFeed.map((item, idx) => (
              <FacetCard
                key={`${item.id}-${idx}`}
                depth={1}
                interactive="hover"
                className="flex flex-col justify-between gap-3.5 rounded-2xl border border-black/8 bg-black/[0.015] p-4 shadow-xs transition-all hover:border-black/15 sm:flex-row sm:items-center sm:p-4.5 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3.5">
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-2xs",
                      item.type === "publish" && "border-blue-500/20 bg-blue-500/10 text-blue-500",
                      item.type === "revision" &&
                        "border-purple-500/20 bg-purple-500/10 text-purple-500",
                      item.type === "minor_edit" &&
                        "border-stone-500/20 bg-stone-500/10 text-stone-500",
                      item.type === "discussion" &&
                        "border-cyan-500/20 bg-cyan-500/10 text-cyan-500",
                      item.type === "laurel" && "border-amber-500/20 bg-amber-500/10 text-amber-500"
                    )}
                  >
                    {item.type === "publish" && <BookOpen className="h-4.5 w-4.5" />}
                    {item.type === "revision" && <EditPencil className="h-4.5 w-4.5" />}
                    {item.type === "minor_edit" && (
                      <EditPencil className="h-4.5 w-4.5 opacity-75" />
                    )}
                    {item.type === "discussion" && <ChatBubble className="h-4.5 w-4.5" />}
                    {item.type === "laurel" && <Medal className="h-4.5 w-4.5" />}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "py-0.2 rounded border px-1.5 font-mono text-[9px] font-bold tracking-wider uppercase",
                          item.type === "publish" &&
                            "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
                          item.type === "revision" &&
                            "border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400",
                          item.type === "minor_edit" &&
                            "border-stone-500/20 bg-stone-500/10 text-stone-600 dark:text-stone-400",
                          item.type === "discussion" &&
                            "border-cyan-500/20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
                          item.type === "laurel" &&
                            "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        )}
                      >
                        {item.type === "publish" && "CREATED PAGE"}
                        {item.type === "revision" && "REVISED PAGE"}
                        {item.type === "minor_edit" && "COPYEDIT"}
                        {item.type === "discussion" && "DISCUSSION"}
                        {item.type === "laurel" && "LAUREL"}
                      </span>

                      <span className="text-muted-foreground flex items-center gap-1 font-mono text-[10px]">
                        <Clock className="inline h-2.5 w-2.5" />
                        {new Date(item.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>

                      {item.byteDiff !== null && item.byteDiff !== undefined && (
                        <span
                          className={cn(
                            "py-0.2 flex items-center gap-0.5 rounded px-1.5 font-mono text-[10px] font-bold",
                            item.byteDiff > 0
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : item.byteDiff < 0
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                : "text-muted-foreground"
                          )}
                        >
                          {item.byteDiff > 0 ? (
                            <ArrowUpRight className="inline h-2.5 w-2.5" />
                          ) : item.byteDiff < 0 ? (
                            <ArrowDownRight className="inline h-2.5 w-2.5" />
                          ) : null}
                          {item.byteDiff > 0 ? `+${item.byteDiff}B` : `${item.byteDiff}B`}
                        </span>
                      )}
                    </div>

                    <h4 className="text-foreground truncate text-sm font-bold tracking-tight">
                      {item.title}
                    </h4>

                    {item.summary && (
                      <p className="text-muted-foreground line-clamp-1 text-xs italic">
                        &ldquo;{item.summary}&rdquo;
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-end pt-1 sm:pt-0">
                  <Link
                    href={item.url}
                    data-cuelume-press="soft"
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition-all hover:opacity-90 active:scale-[0.97] dark:bg-white dark:text-stone-950"
                  >
                    <span>View in WikiOS</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </FacetCard>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
