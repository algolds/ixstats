"use client";

import React, { useState } from "react";
import { OpenBook as BookOpen } from "iconoir-react";
import type { PassportWiki, WorkPayload } from "../types";
import { WorkActivityFeed } from "./work/WorkActivityFeed";
import {
  WorkCategoryFilter,
  type WorkCategory,
  type WorkCategoryFilterValue,
} from "./work/WorkCategoryFilter";
import { WorkArticleCards, WorkCreationCards } from "./work/WorkCreationCards";

interface PassportWorkTabProps {
  work: WorkPayload;
  wiki: PassportWiki;
  cleanUsername: string;
}

function matchesSearch(query: string, title: string, summary: string | null): boolean {
  const q = query.toLowerCase();
  return !q || title.toLowerCase().includes(q) || Boolean(summary?.toLowerCase().includes(q));
}

/** Tab 3 — everything this identity authored, registered or enacted (plan 188 §4). */
export const PassportWorkTab = React.memo(function PassportWorkTab({
  work,
  wiki,
  cleanUsername,
}: PassportWorkTabProps) {
  const [selected, setSelected] = useState<WorkCategoryFilterValue>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { authoredArticles, conlangs, sportTeams, directives, wikiActivityFeed } = work;
  const counts: Record<WorkCategory, number> = {
    articles: authoredArticles.length,
    languages: conlangs.length,
    directives: directives.length,
    sports: sportTeams.length,
    feed: wikiActivityFeed.length,
  };
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  if (total === 0 && !wiki.linked) {
    return (
      <div className="space-y-3 rounded-3xl border border-black/8 bg-black/[0.015] p-12 text-center dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500">
          <BookOpen className="h-6 w-6" />
        </div>
        <h3 className="text-foreground text-base font-bold">No Published Work Found</h3>
        <p className="text-muted-foreground mx-auto max-w-md text-xs">
          @{cleanUsername} has not yet published any WikiOS articles, revisions, language packs, or
          simulation directives.
        </p>
      </div>
    );
  }

  const shows = (category: WorkCategory) =>
    selected === null || selected === "all" || selected === category;
  const articles = authoredArticles.filter((a) => matchesSearch(searchQuery, a.title, a.summary));
  const feed = wikiActivityFeed.filter((i) => matchesSearch(searchQuery, i.title, i.summary));
  const creations = {
    conlangs: shows("languages") ? conlangs : [],
    directives: shows("directives") ? directives : [],
    sportTeams: shows("sports") ? sportTeams : [],
  };
  const hasCreations =
    creations.conlangs.length + creations.directives.length + creations.sportTeams.length > 0;

  return (
    <div className="space-y-6">
      <WorkCategoryFilter
        selected={selected}
        onSelect={setSelected}
        total={total}
        counts={counts}
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        showSearch={authoredArticles.length > 4 || wikiActivityFeed.length > 6}
      />

      {shows("articles") && articles.length > 0 && <WorkArticleCards articles={articles} />}

      {hasCreations && (
        <WorkCreationCards showHeading={selected === null || selected === "all"} {...creations} />
      )}

      {shows("feed") && feed.length > 0 && (
        <WorkActivityFeed feed={feed} contributionsUser={wiki.username || cleanUsername} />
      )}
    </div>
  );
});
