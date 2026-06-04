"use client";

import React from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { CardTitle } from "~/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Activity, Globe, Eye, Users, Trophy, TrendingUp, Search } from "lucide-react";
import { cn } from "~/lib/utils";
import type { ActivityTab } from "~/lib/activity-data-transformer";

interface ActivityFeedHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  showTrending: boolean;
  onToggleTrending: () => void;
  activeTab: ActivityTab;
  onTabChange: (tab: ActivityTab) => void;
}

/** Header for the platform activity feed: title, search, trending toggle, tabs. */
export const ActivityFeedHeader = React.memo(function ActivityFeedHeader({
  searchQuery,
  onSearchChange,
  showTrending,
  onToggleTrending,
  activeTab,
  onTabChange,
}: ActivityFeedHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-500" />
          Activity Feed
          <Badge variant="secondary" className="ml-2">
            Live
          </Badge>
        </CardTitle>

        {/* Search & Filter */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
            <input
              type="text"
              placeholder="Search activity..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="glass-hierarchy-interactive w-48 rounded-lg py-2 pr-4 pl-9 text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleTrending}
            className={cn("flex items-center gap-2", showTrending && "bg-accent")}
          >
            <TrendingUp className="h-4 w-4" />
            Trending
          </Button>
        </div>
      </div>

      {/* Activity Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as ActivityTab)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            All Activity
          </TabsTrigger>
          <TabsTrigger value="following" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Following
          </TabsTrigger>
          <TabsTrigger value="friends" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Friends
          </TabsTrigger>
          <TabsTrigger value="achievements" className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Achievements
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </>
  );
});
