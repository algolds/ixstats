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

export const PassportLoreTab = React.memo(function PassportLoreTab({
  work,
  wiki,
  cleanUsername,
}: PassportLoreTabProps) {
  const [selectedCategory, setSelectedCategory] = useState<LoreCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const feed = work?.wikiActivityFeed ?? [];
  const articles = work?.authoredArticles ?? [];
  const conlangs = work?.conlangs ?? [];
  const sportTeams = work?.sportTeams ?? [];
  const directives = work?.directives ?? [];
  const total = (articles.length + conlangs.length + sportTeams.length + directives.length + feed.length) || (work?.totalCreations ?? 0);

  const hasAnyWork = total > 0 || feed.length > 0 || wiki?.linked;

  if (!hasAnyWork) {
    return (
      <div className="rounded-3xl border border-black/8 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] p-12 text-center space-y-3">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
          <BookOpen className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-foreground">No Published Lore or Activity Found</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          @{cleanUsername} has not yet published any WikiOS articles, revisions, language packs, or simulation directives.
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

  const showArticles = selectedCategory === "all" || selectedCategory === "articles";
  const showLangs = selectedCategory === "all" || selectedCategory === "languages";
  const showDirectives = selectedCategory === "all" || selectedCategory === "directives";
  const showSports = selectedCategory === "all" || selectedCategory === "sports";
  const showFeed = selectedCategory === "all" || selectedCategory === "feed";

  return (
    <div className="space-y-6">
      {/* 1. Category Filter Pills & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl border border-black/6 dark:border-white/8 bg-black/[0.02] dark:bg-white/[0.02] max-w-fit">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            data-cuelume-press="soft"
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.97] cursor-pointer",
              selectedCategory === "all"
                ? "bg-stone-900 text-white dark:bg-white dark:text-stone-950 shadow-sm"
                : "text-stone-600 dark:text-stone-400 hover:text-foreground"
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
                "rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.97] cursor-pointer",
                selectedCategory === "articles"
                  ? "bg-stone-900 text-white dark:bg-white dark:text-stone-950 shadow-sm"
                  : "text-stone-600 dark:text-stone-400 hover:text-foreground"
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
                "rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.97] cursor-pointer",
                selectedCategory === "languages"
                  ? "bg-stone-900 text-white dark:bg-white dark:text-stone-950 shadow-sm"
                  : "text-stone-600 dark:text-stone-400 hover:text-foreground"
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
                "rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.97] cursor-pointer",
                selectedCategory === "directives"
                  ? "bg-stone-900 text-white dark:bg-white dark:text-stone-950 shadow-sm"
                  : "text-stone-600 dark:text-stone-400 hover:text-foreground"
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
                "rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.97] cursor-pointer",
                selectedCategory === "sports"
                  ? "bg-stone-900 text-white dark:bg-white dark:text-stone-950 shadow-sm"
                  : "text-stone-600 dark:text-stone-400 hover:text-foreground"
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
                "rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.97] cursor-pointer",
                selectedCategory === "feed"
                  ? "bg-stone-900 text-white dark:bg-white dark:text-stone-950 shadow-sm"
                  : "text-stone-600 dark:text-stone-400 hover:text-foreground"
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
              className="w-full rounded-xl border border-black/8 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            />
          </div>
        )}
      </div>

      {/* 2. Authored Articles Section (Every Page Created by Author) */}
      {showArticles && filteredArticles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-blue-500" />
              <span>AUTHORED WIKI PAGES ({filteredArticles.length})</span>
            </h4>
            <Link
              href="/wiki"
              data-cuelume-press="soft"
              className="font-mono text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
            >
              <span>Explore WikiOS</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredArticles.map((item) => (
              <FacetCard
                key={item.id}
                depth={1}
                interactive="hover"
                className="rounded-3xl border border-black/8 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] p-5 space-y-3 shadow-sm hover:border-black/15 dark:hover:border-white/20 transition-all flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Authored Page
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {new Date(item.updatedAt || item.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-foreground tracking-tight line-clamp-1">{item.title}</h3>
                    {item.summary && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.summary}</p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-black/6 dark:border-white/8 flex items-center justify-between">
                  <span className="font-mono text-[11px] text-muted-foreground uppercase">WikiOS</span>
                  <Link
                    href={`/wiki/${encodeURIComponent(item.title)}`}
                    data-cuelume-press="soft"
                    className="inline-flex items-center gap-1 font-mono text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
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
          {selectedCategory === "all" && (
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
              CANONICAL REALM & SYSTEM CREATIONS
            </h4>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Onoma Conlangs */}
            {showLangs &&
              conlangs.map((item) => (
                <FacetCard
                  key={item.id}
                  depth={1}
                  interactive="hover"
                  className="rounded-3xl border border-black/8 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] p-5 space-y-3 shadow-sm hover:border-black/15 dark:hover:border-white/20 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        Language Pack
                      </span>
                      {item.culturalFamily && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {item.culturalFamily}
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-foreground tracking-tight">{item.name}</h3>
                      {item.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-black/6 dark:border-white/8 flex items-center justify-between">
                    <span className="font-mono text-[11px] text-muted-foreground uppercase">Onoma</span>
                    <Link
                      href={`/onoma/pack/${item.slug || item.id}`}
                      data-cuelume-press="soft"
                      className="inline-flex items-center gap-1 font-mono text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
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
                  className="rounded-3xl border border-black/8 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] p-5 space-y-3 shadow-sm hover:border-black/15 dark:hover:border-white/20 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <Flash className="h-3 w-3" />
                        Directive
                      </span>
                      <span className="font-mono text-[10px] uppercase text-muted-foreground">
                        {item.tier} Tier
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-foreground tracking-tight">{item.goal}</h3>
                      {item.summary && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.summary}</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-black/6 dark:border-white/8 flex items-center justify-between">
                    <span className="font-mono text-[11px] text-muted-foreground capitalize">
                      {item.category || "Governance"}
                    </span>
                    <span className="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 font-mono text-[10px] font-semibold">
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
                  className="rounded-3xl border border-black/8 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] p-5 space-y-3 shadow-sm hover:border-black/15 dark:hover:border-white/20 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Trophy className="h-3 w-3" />
                        Athletic Club
                      </span>
                      {item.city && (
                        <span className="font-mono text-[10px] text-muted-foreground">{item.city}</span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-foreground tracking-tight">{item.name}</h3>
                      {item.shortName && (
                        <p className="font-mono text-xs text-muted-foreground mt-0.5">
                          Abbreviation: {item.shortName}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-black/6 dark:border-white/8 flex items-center justify-between">
                    <span className="font-mono text-[11px] text-muted-foreground uppercase">MyLeague</span>
                    <Link
                      href="/sports"
                      data-cuelume-press="soft"
                      className="inline-flex items-center gap-1 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
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
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <EditPencil className="h-3.5 w-3.5 text-blue-500" />
              <span>FULL WIKIOS & DATABASE ACTIVITY STREAM ({filteredFeed.length})</span>
            </h4>
            <Link
              href={`/wiki/contributions/${encodeURIComponent(wiki?.username || cleanUsername)}`}
              data-cuelume-press="soft"
              className="font-mono text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
            >
              <span>View All</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {filteredFeed.map((item) => (
              <FacetCard
                key={item.id}
                depth={1}
                interactive="hover"
                className="rounded-2xl border border-black/8 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] p-4 sm:p-4.5 shadow-xs hover:border-black/15 dark:hover:border-white/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div
                    className={cn(
                      "h-9 w-9 shrink-0 rounded-xl flex items-center justify-center border shadow-2xs",
                      item.type === "publish" && "bg-blue-500/10 border-blue-500/20 text-blue-500",
                      item.type === "revision" && "bg-purple-500/10 border-purple-500/20 text-purple-500",
                      item.type === "minor_edit" && "bg-stone-500/10 border-stone-500/20 text-stone-500",
                      item.type === "discussion" && "bg-cyan-500/10 border-cyan-500/20 text-cyan-500",
                      item.type === "laurel" && "bg-amber-500/10 border-amber-500/20 text-amber-500"
                    )}
                  >
                    {item.type === "publish" && <BookOpen className="h-4.5 w-4.5" />}
                    {item.type === "revision" && <EditPencil className="h-4.5 w-4.5" />}
                    {item.type === "minor_edit" && <EditPencil className="h-4.5 w-4.5 opacity-75" />}
                    {item.type === "discussion" && <ChatBubble className="h-4.5 w-4.5" />}
                    {item.type === "laurel" && <Medal className="h-4.5 w-4.5" />}
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase tracking-wider border",
                          item.type === "publish" &&
                            "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
                          item.type === "revision" &&
                            "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400",
                          item.type === "minor_edit" &&
                            "bg-stone-500/10 border-stone-500/20 text-stone-600 dark:text-stone-400",
                          item.type === "discussion" &&
                            "bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-400",
                          item.type === "laurel" &&
                            "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                        )}
                      >
                        {item.type === "publish" && "CREATED PAGE"}
                        {item.type === "revision" && "REVISED PAGE"}
                        {item.type === "minor_edit" && "COPYEDIT"}
                        {item.type === "discussion" && "DISCUSSION"}
                        {item.type === "laurel" && "LAUREL"}
                      </span>

                      <span className="font-mono text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5 inline" />
                        {new Date(item.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>

                      {item.byteDiff !== null && item.byteDiff !== undefined && (
                        <span
                          className={cn(
                            "font-mono text-[10px] font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5",
                            item.byteDiff > 0
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : item.byteDiff < 0
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                : "text-muted-foreground"
                          )}
                        >
                          {item.byteDiff > 0 ? (
                            <ArrowUpRight className="h-2.5 w-2.5 inline" />
                          ) : item.byteDiff < 0 ? (
                            <ArrowDownRight className="h-2.5 w-2.5 inline" />
                          ) : null}
                          {item.byteDiff > 0 ? `+${item.byteDiff}B` : `${item.byteDiff}B`}
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-foreground tracking-tight truncate">
                      {item.title}
                    </h4>

                    {item.summary && (
                      <p className="text-xs text-muted-foreground line-clamp-1 italic">
                        &ldquo;{item.summary}&rdquo;
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end shrink-0 pt-1 sm:pt-0">
                  <Link
                    href={item.url}
                    data-cuelume-press="soft"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 dark:bg-white text-white dark:text-stone-950 px-3 py-1.5 text-xs font-semibold shadow-2xs hover:opacity-90 active:scale-[0.97] transition-all cursor-pointer"
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
