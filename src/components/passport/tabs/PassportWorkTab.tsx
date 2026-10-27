"use client";

import React, { useState } from "react";
import { ChatBubble, OpenBook as BookOpen } from "iconoir-react";
import { EmptyState } from "~/components/ui/empty-state";
import type { PassportForum, PassportWiki, WorkPayload } from "../types";
import { WorkActivityFeed } from "./work/WorkActivityFeed";
import {
  WorkCategoryFilter,
  type WorkCategory,
  type WorkCategoryFilterValue,
} from "./work/WorkCategoryFilter";
import { WorkArticleCards, WorkCreationCards } from "./work/WorkCreationCards";
import { Card } from "~/components/ui/card";

interface PassportWorkTabProps {
  work: WorkPayload;
  wiki: PassportWiki;
  /** Forum counters lead the tab; `forum.stats` is null when hidden or unavailable. */
  forum: PassportForum;
  handle: string;
}

function counted(n: number, one: string, many: string): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

/** The holder's forum activity in one line: messages and threads on the ThinkPages forum. */
function ForumCounters({ stats }: { stats: NonNullable<PassportForum["stats"]> }) {
  const parts = [
    counted(stats.messageCount, "message", "messages"),
    counted(stats.threadCount, "thread", "threads"),
  ];
  return (
    <div
      role="group"
      aria-label="Forum"
      className="text-footnote text-label-secondary flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums"
    >
      <ChatBubble aria-hidden className="text-tint size-4 shrink-0" />
      <span className="text-label font-medium">Forum</span>
      {parts.map((part) => (
        <React.Fragment key={part}>
          <span aria-hidden>·</span>
          <span>{part}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

function matchesSearch(query: string, title: string, summary: string | null): boolean {
  const q = query.toLowerCase();
  return !q || title.toLowerCase().includes(q) || Boolean(summary?.toLowerCase().includes(q));
}

/** Everything this identity authored, registered or enacted. */
export const PassportWorkTab = React.memo(function PassportWorkTab({
  work,
  wiki,
  forum,
  handle,
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

  const header = forum.stats ? <ForumCounters stats={forum.stats} /> : null;

  if (total === 0 && !wiki.linked) {
    return (
      <div className="space-y-6">
        {header}
        <Card variant="well" padding="none">
          <EmptyState
            compact
            icon={<BookOpen />}
            title="No published work"
            message={`@${handle} has not published any WikiOS articles, language packs or directives yet.`}
          />
        </Card>
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
      {header}
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
        <WorkActivityFeed feed={feed} contributionsUser={wiki.username || handle} />
      )}
    </div>
  );
});
