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
import { Badge } from "~/components/ui/badge";
import { FACET_INSET_SURFACE } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils/cn";
import type { WorkPayload } from "../../types";

/** An inset work card inside the passport (the passport itself is the opaque card). */
const CARD_CLASS = cn(FACET_INSET_SURFACE, "flex flex-col justify-between space-y-3 p-4");

const CARD_FOOTER = "border-separator flex items-center justify-between border-t pt-3";

/** Trailing card action link (tint, never colour alone: text + arrow). */
const CARD_LINK =
  "text-tint text-footnote rounded-control-sm focus-visible:outline-tint inline-flex cursor-pointer items-center gap-1 font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2";

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
        <h4 className="text-subhead text-label-secondary flex items-center gap-1.5">
          <BookOpen aria-hidden className="size-4" />
          <span>
            Authored wiki pages <span className="tabular-nums">({articles.length})</span>
          </span>
        </h4>
        <Link href="/wiki" className={CARD_LINK}>
          <span>Explore WikiOS</span>
          <ArrowUpRight aria-hidden className="size-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {articles.map((item) => (
          <article key={item.id} className={CARD_CLASS}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="info">
                  <FileText aria-hidden />
                  Authored Page
                </Badge>
                <span className="text-label-secondary text-footnote tabular-nums">
                  {formatDay(item.updatedAt || item.createdAt)}
                </span>
              </div>
              <div>
                <h3 className="text-label text-headline line-clamp-1">{item.title}</h3>
                {item.summary && (
                  <p className="text-label-secondary text-footnote mt-1 line-clamp-2">
                    {item.summary}
                  </p>
                )}
              </div>
            </div>
            <div className={CARD_FOOTER}>
              <span className="text-label-secondary text-footnote">WikiOS</span>
              <Link href={`/wiki/${encodeURIComponent(item.title)}`} className={CARD_LINK}>
                <span>Read Article</span>
                <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </div>
          </article>
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
        <h4 className="text-subhead text-label-secondary">Canonical realm and system creations</h4>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {conlangs.map((item) => (
          <article key={item.id} className={CARD_CLASS}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="tinted">
                  <Globe aria-hidden />
                  Language Pack
                </Badge>
                {item.culturalFamily && (
                  <span className="text-label-secondary text-footnote">{item.culturalFamily}</span>
                )}
              </div>
              <div>
                <h3 className="text-label text-headline">{item.name}</h3>
                {item.description && (
                  <p className="text-label-secondary text-footnote mt-1 line-clamp-2">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
            <div className={CARD_FOOTER}>
              <span className="text-label-secondary text-footnote">Onoma</span>
              <Link href={`/onoma/pack/${item.slug || item.id}`} className={CARD_LINK}>
                <span>View Pack</span>
                <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </div>
          </article>
        ))}

        {directives.map((item) => (
          <article key={item.id} className={CARD_CLASS}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="caution">
                  <Flash aria-hidden />
                  Directive
                </Badge>
                <span className="text-label-secondary text-footnote">{item.tier} Tier</span>
              </div>
              <div>
                <h3 className="text-label text-headline">{item.goal}</h3>
                {item.summary && (
                  <p className="text-label-secondary text-footnote mt-1 line-clamp-2">
                    {item.summary}
                  </p>
                )}
              </div>
            </div>
            <div className={CARD_FOOTER}>
              <span className="text-label-secondary text-footnote capitalize">
                {item.category || "Governance"}
              </span>
              <Badge variant="success">{item.status}</Badge>
            </div>
          </article>
        ))}

        {sportTeams.map((item) => (
          <article key={item.id} className={CARD_CLASS}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="success">
                  <Trophy aria-hidden />
                  Athletic Club
                </Badge>
                {item.city && (
                  <span className="text-label-secondary text-footnote">{item.city}</span>
                )}
              </div>
              <div>
                <h3 className="text-label text-headline">{item.name}</h3>
                {item.shortName && (
                  <p className="text-label-secondary text-footnote mt-0.5">
                    Abbreviation: {item.shortName}
                  </p>
                )}
              </div>
            </div>
            <div className={CARD_FOOTER}>
              <span className="text-label-secondary text-footnote">MyLeague</span>
              <Link href="/sports" className={CARD_LINK}>
                <span>View Club</span>
                <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
});
