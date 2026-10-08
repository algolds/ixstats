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
import type { WorkPayload } from "../../types";
import { formatWorkDay, WORK_LINK, WORK_ROW, WorkSectionTitle } from "./WorkSection";

function Summary({ children }: { children: React.ReactNode }) {
  return <p className="text-label-secondary text-footnote mt-1 line-clamp-2">{children}</p>;
}

export const WorkArticleCards = React.memo(function WorkArticleCards({
  articles,
}: {
  articles: WorkPayload["authoredArticles"];
}) {
  return (
    <section className="space-y-1">
      <WorkSectionTitle
        icon={<BookOpen />}
        trailing={
          <Link href="/wiki" className={WORK_LINK}>
            <span>Open WikiOS</span>
            <ArrowUpRight aria-hidden className="size-3.5" />
          </Link>
        }
      >
        Authored wiki pages <span className="tabular-nums">({articles.length})</span>
      </WorkSectionTitle>

      <ul className="divide-separator divide-y">
        {articles.map((item) => (
          <li key={item.id} className={WORK_ROW}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">
                  <FileText aria-hidden />
                  Authored page
                </Badge>
                <span className="text-label-secondary text-footnote tabular-nums">
                  {formatWorkDay(item.updatedAt || item.createdAt)}
                </span>
              </div>
              <h3 className="text-label text-headline mt-2 line-clamp-1">{item.title}</h3>
              {item.summary && <Summary>{item.summary}</Summary>}
            </div>
            <Link href={`/wiki/${encodeURIComponent(item.title)}`} className={WORK_LINK}>
              <span>Read article</span>
              <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
});

interface WorkCreationCardsProps {
  showHeading: boolean;
  conlangs: WorkPayload["conlangs"];
  directives: WorkPayload["directives"];
  sportTeams: WorkPayload["sportTeams"];
}

/** Onoma language packs, MyCountry directives and MyLeague clubs in one list. */
export const WorkCreationCards = React.memo(function WorkCreationCards({
  showHeading,
  conlangs,
  directives,
  sportTeams,
}: WorkCreationCardsProps) {
  return (
    <section className="space-y-1">
      {showHeading && <WorkSectionTitle>Creations in realms and systems</WorkSectionTitle>}

      <ul className="divide-separator divide-y">
        {conlangs.map((item) => (
          <li key={item.id} className={WORK_ROW}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  <Globe aria-hidden />
                  Language pack
                </Badge>
                {item.culturalFamily && (
                  <span className="text-label-secondary text-footnote">{item.culturalFamily}</span>
                )}
              </div>
              <h3 className="text-label text-headline mt-2">{item.name}</h3>
              {item.description && <Summary>{item.description}</Summary>}
            </div>
            <Link href={`/onoma/pack/${item.slug || item.id}`} className={WORK_LINK}>
              <span>View pack</span>
              <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          </li>
        ))}

        {directives.map((item) => (
          <li key={item.id} className={WORK_ROW}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="warning">
                  <Flash aria-hidden />
                  Directive
                </Badge>
                <span className="text-label-secondary text-footnote">{item.tier} tier</span>
                {item.category && (
                  <span className="text-label-secondary text-footnote capitalize">
                    {item.category}
                  </span>
                )}
              </div>
              <h3 className="text-label text-headline mt-2">{item.goal}</h3>
              {item.summary && <Summary>{item.summary}</Summary>}
            </div>
            <Badge variant="success" className="shrink-0 self-start sm:self-center">
              {item.status}
            </Badge>
          </li>
        ))}

        {sportTeams.map((item) => (
          <li key={item.id} className={WORK_ROW}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success">
                  <Trophy aria-hidden />
                  Athletic club
                </Badge>
                {item.city && (
                  <span className="text-label-secondary text-footnote">{item.city}</span>
                )}
              </div>
              <h3 className="text-label text-headline mt-2">{item.name}</h3>
              {item.shortName && (
                <p className="text-label-secondary text-footnote mt-0.5">{item.shortName}</p>
              )}
            </div>
            <Link href="/sports" className={WORK_LINK}>
              <span>View club</span>
              <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
});
