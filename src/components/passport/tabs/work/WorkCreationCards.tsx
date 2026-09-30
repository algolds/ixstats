"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  OpenBook as BookOpen,
  Page as FileText,
  Flash,
  Globe,
  Trophy,
} from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import type { WorkPayload } from "../../types";

const CARD_CLASS =
  "flex flex-col justify-between space-y-3 rounded-3xl border border-black/8 bg-black/[0.015] p-5 shadow-sm transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:border-black/15 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20";

const CARD_FOOTER =
  "flex items-center justify-between border-t border-black/6 pt-3 dark:border-white/8";

function formatDay(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const WorkArticleCards = React.memo(function WorkArticleCards({
  articles,
}: {
  articles: WorkPayload["authoredArticles"];
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-muted-foreground flex items-center gap-1.5 font-mono text-xs font-bold tracking-wider uppercase">
          <BookOpen className="h-3.5 w-3.5 text-blue-500" />
          <span>AUTHORED WIKI PAGES ({articles.length})</span>
        </h4>
        <Link
          href="/wiki"
          data-cuelume-press="soft"
          className="flex items-center gap-0.5 font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
        >
          <span>Explore WikiOS</span>
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {articles.map((item) => (
          <FacetCard key={item.id} depth={1} interactive="hover" className={CARD_CLASS}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                  <FileText className="h-3 w-3" />
                  Authored Page
                </span>
                <span className="text-muted-foreground font-mono text-xs">
                  {formatDay(item.updatedAt || item.createdAt)}
                </span>
              </div>
              <div>
                <h3 className="text-foreground line-clamp-1 text-base font-bold tracking-tight">
                  {item.title}
                </h3>
                {item.summary && (
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{item.summary}</p>
                )}
              </div>
            </div>
            <div className={CARD_FOOTER}>
              <span className="text-muted-foreground font-mono text-xs uppercase">WikiOS</span>
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
  );
});

interface WorkCreationCardsProps {
  showHeading: boolean;
  conlangs: WorkPayload["conlangs"];
  directives: WorkPayload["directives"];
  sportTeams: WorkPayload["sportTeams"];
}

/** Onoma language packs, MyCountry directives and MyLeague clubs in one grid. */
export const WorkCreationCards = React.memo(function WorkCreationCards({
  showHeading,
  conlangs,
  directives,
  sportTeams,
}: WorkCreationCardsProps) {
  return (
    <div className="space-y-3 pt-2">
      {showHeading && (
        <h4 className="text-muted-foreground font-mono text-xs font-bold tracking-wider uppercase">
          CANONICAL REALM & SYSTEM CREATIONS
        </h4>
      )}

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {conlangs.map((item) => (
          <FacetCard key={item.id} depth={1} interactive="hover" className={CARD_CLASS}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 rounded-md border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  <Globe className="h-3 w-3" />
                  Language Pack
                </span>
                {item.culturalFamily && (
                  <span className="text-muted-foreground font-mono text-xs">
                    {item.culturalFamily}
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-foreground text-base font-bold tracking-tight">{item.name}</h3>
                {item.description && (
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
            <div className={CARD_FOOTER}>
              <span className="text-muted-foreground font-mono text-xs uppercase">Onoma</span>
              <Link
                href={`/onoma/pack/${item.slug || item.id}`}
                data-cuelume-press="soft"
                className="inline-flex cursor-pointer items-center gap-1 font-mono text-xs font-bold text-indigo-600 hover:underline dark:text-indigo-400"
              >
                <span>View Pack</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </FacetCard>
        ))}

        {directives.map((item) => (
          <FacetCard key={item.id} depth={1} interactive="hover" className={CARD_CLASS}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                  <Flash className="h-3 w-3" />
                  Directive
                </span>
                <span className="text-muted-foreground font-mono text-xs uppercase">
                  {item.tier} Tier
                </span>
              </div>
              <div>
                <h3 className="text-foreground text-sm font-bold tracking-tight">{item.goal}</h3>
                {item.summary && (
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{item.summary}</p>
                )}
              </div>
            </div>
            <div className={CARD_FOOTER}>
              <span className="text-muted-foreground font-mono text-xs capitalize">
                {item.category || "Governance"}
              </span>
              <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {item.status}
              </span>
            </div>
          </FacetCard>
        ))}

        {sportTeams.map((item) => (
          <FacetCard key={item.id} depth={1} interactive="hover" className={CARD_CLASS}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <Trophy className="h-3 w-3" />
                  Athletic Club
                </span>
                {item.city && (
                  <span className="text-muted-foreground font-mono text-xs">{item.city}</span>
                )}
              </div>
              <div>
                <h3 className="text-foreground text-base font-bold tracking-tight">{item.name}</h3>
                {item.shortName && (
                  <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                    Abbreviation: {item.shortName}
                  </p>
                )}
              </div>
            </div>
            <div className={CARD_FOOTER}>
              <span className="text-muted-foreground font-mono text-xs uppercase">MyLeague</span>
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
  );
});
