"use client";

import React from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { FireFlame as Flame, StatUp as TrendingUp, Minus } from "iconoir-react";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import { withBasePath } from "~/lib/base-path";

export function TrendingTopics() {
  // Hashtags ranked by the thinkpages-trending cron job (TrendingTopic).
  const { data: topics, isLoading } = api.activities.getTrendingTopics.useQuery({ limit: 5 });

  return (
    <div className="facet-hierarchy-child rounded-lg p-4">
      <div className="mb-4 flex items-center gap-2">
        <Flame className="h-5 w-5 text-orange-600 dark:text-orange-400" />
        <h3 className="text-foreground font-semibold">Trending Now</h3>
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
              className="hover:bg-accent/10 block cursor-pointer rounded-lg p-2 transition-colors"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-foreground text-sm font-medium">{topic.title}</span>
                {topic.trend === "up" ? (
                  <TrendingUp className="h-4 w-4 text-green-500" aria-label="Rising" />
                ) : (
                  <Minus className="h-4 w-4 text-slate-400" aria-label="Steady" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {topic.category}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {topic.postCount} post{topic.postCount !== 1 ? "s" : ""}
                  {topic.engagement > 0 ? ` · ${topic.engagement} engagement` : ""}
                </span>
              </div>
            </Link>
          ))
        ) : (
          // Empty state
          <div className="py-8 text-center">
            <Flame className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
            <p className="text-muted-foreground text-sm">No trending topics right now</p>
            <p className="text-muted-foreground mt-1 text-xs">
              A hashtag trends when several people use it in recent posts.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
