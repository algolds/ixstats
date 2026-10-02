"use client";

import React from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { FireFlame as Flame, StatUp as TrendingUp, Minus } from "iconoir-react";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import { withBasePath } from "~/lib/base-path";
import { EmptyState } from "~/components/ui/empty-state";
import { Card } from "~/components/ui/card";

export function TrendingTopics() {
  // Hashtags ranked by the thinkpages-trending cron job (TrendingTopic).
  const { data: topics, isLoading } = api.activities.getTrendingTopics.useQuery({ limit: 5 });

  return (
    <Card padding="md">
      <div className="mb-4 flex items-center gap-2">
        <Flame aria-hidden className="text-orange h-5 w-5" />
        <h3 className="text-headline text-label">Trending Now</h3>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          // Loading skeletons
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))
        ) : topics && topics.length > 0 ? (
          topics.map((topic) => (
            <Link
              key={topic.id}
              href={withBasePath(`/hashtags/${encodeURIComponent(topic.hashtag)}`)}
              className="hover:bg-fill-4 rounded-row block cursor-pointer p-2 transition-colors"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-headline text-label">{topic.title}</span>
                {topic.trend === "up" ? (
                  <TrendingUp className="text-green h-4 w-4" aria-label="Rising" />
                ) : (
                  <Minus className="text-label-secondary h-4 w-4" aria-label="Steady" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{topic.category}</Badge>
                <span className="text-label-secondary text-footnote">
                  {topic.postCount} post{topic.postCount !== 1 ? "s" : ""}
                  {topic.engagement > 0 ? ` · ${topic.engagement} engagement` : ""}
                </span>
              </div>
            </Link>
          ))
        ) : (
          // Empty state
          <EmptyState
            compact
            icon={<Flame />}
            title="No trending topics right now"
            message="A hashtag trends when several people use it in recent posts."
          />
        )}
      </div>
    </Card>
  );
}
