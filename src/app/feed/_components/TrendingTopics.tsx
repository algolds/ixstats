"use client";

import React from "react";
import { api } from "~/trpc/react";
import { Flame, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";

export function TrendingTopics() {
  const { data: topics, isLoading } = api.activities.getTrendingTopics.useQuery({
    limit: 5,
    timeRange: "24h",
  });

  return (
    <div className="glass-hierarchy-child rounded-lg p-4">
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
          // Trending topics
          topics.map((topic, index) => (
            <div
              key={topic.id}
              className="hover:bg-accent/10 cursor-pointer rounded-lg p-2 transition-colors"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-foreground text-sm font-medium">{topic.title}</span>
                {topic.trend === "up" ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : topic.trend === "down" ? (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                ) : (
                  <Minus className="h-4 w-4 text-slate-400" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {topic.category}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {topic.participants} participant{topic.participants !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          ))
        ) : (
          // Empty state
          <div className="py-8 text-center">
            <Flame className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
            <p className="text-muted-foreground text-sm">No trending topics yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
