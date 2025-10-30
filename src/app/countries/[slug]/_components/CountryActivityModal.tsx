"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { api } from "~/trpc/react";
import {
  Activity,
  TrendingUp,
  Users,
  Trophy,
  MessageSquare,
  Heart,
  Share2,
  Calendar,
  Filter,
  Loader2,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface CountryActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  countryId: string;
  countryName: string;
}

export function CountryActivityModal({
  isOpen,
  onClose,
  countryId,
  countryName,
}: CountryActivityModalProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  const { data, isLoading } = api.activities.getCountryActivity.useQuery(
    {
      countryId,
      limit: 50,
      timeRange,
    },
    {
      enabled: isOpen && !!countryId,
    }
  );

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'achievement':
        return <Trophy className="h-4 w-4" />;
      case 'economic':
        return <TrendingUp className="h-4 w-4" />;
      case 'diplomatic':
        return <Users className="h-4 w-4" />;
      case 'social':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'achievement':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'economic':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'diplomatic':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'social':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] backdrop-blur-sm bg-card/95">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Activity className="h-5 w-5" />
            Recent Activity - {countryName.replace(/_/g, ' ')}
          </DialogTitle>
          <DialogDescription>
            Track major milestones, ThinkPages posts, and country developments
          </DialogDescription>
        </DialogHeader>

        {/* Time Range Filter */}
        <div className="flex items-center gap-2 pb-4 border-b">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Time Range:</span>
          <div className="flex gap-2">
            <Button
              variant={timeRange === '7d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange('7d')}
            >
              7 Days
            </Button>
            <Button
              variant={timeRange === '30d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange('30d')}
            >
              30 Days
            </Button>
            <Button
              variant={timeRange === '90d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange('90d')}
            >
              90 Days
            </Button>
          </div>
        </div>

        {/* Activity List */}
        <ScrollArea className="h-[50vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !data?.activities || data.activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No recent activity found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try selecting a different time range
              </p>
            </div>
          ) : (
            <div className="space-y-3 pr-4">
              {data.activities.map((activity) => (
                <div
                  key={activity.id}
                  className="group p-4 rounded-lg border border-border/50 hover:border-border hover:bg-muted/30 transition-all"
                >
                  <div className="flex items-start gap-3">
                    {/* Activity Icon */}
                    <div
                      className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${getActivityColor(activity.type)}`}
                    >
                      {getActivityIcon(activity.type)}
                    </div>

                    {/* Activity Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-semibold text-sm leading-tight">
                          {activity.title}
                        </h4>
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {activity.source === 'thinkpages' ? 'ThinkPages' : 'Milestone'}
                        </Badge>
                      </div>

                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {activity.description}
                      </p>

                      {/* Metadata */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(activity.timestamp), {
                            addSuffix: true,
                          })}
                        </div>

                        {activity.engagement && (
                          <>
                            {activity.engagement.likes > 0 && (
                              <div className="flex items-center gap-1">
                                <Heart className="h-3 w-3" />
                                {activity.engagement.likes}
                              </div>
                            )}
                            {activity.engagement.comments > 0 && (
                              <div className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {activity.engagement.comments}
                              </div>
                            )}
                            {activity.engagement.shares > 0 && (
                              <div className="flex items-center gap-1">
                                <Share2 className="h-3 w-3" />
                                {activity.engagement.shares}
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Additional metadata badges */}
                      {activity.metadata && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {activity.metadata.tier && (
                            <Badge variant="secondary" className="text-xs">
                              {activity.metadata.tier}
                            </Badge>
                          )}
                          {activity.metadata.verified && (
                            <Badge variant="secondary" className="text-xs">
                              Verified
                            </Badge>
                          )}
                          {activity.metadata.trending && (
                            <Badge variant="secondary" className="text-xs flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              Trending
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            {data?.activities && data.activities.length > 0
              ? `Showing ${data.activities.length} activities`
              : 'No activities to display'}
          </p>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
