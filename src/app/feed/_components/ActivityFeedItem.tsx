"use client";

import React from "react";
import {
  StatUp as TrendingUp,
  Globe,
  Trophy,
  Activity,
  ChatBubble as MessageSquare,
  Heart,
  ShareAndroid as Share2,
  Eye,
  Clock,
  NavArrowDown as ChevronDown,
  NavArrowUp as ChevronUp,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { formatDistanceToNow } from "date-fns";
import { FeedPollWidget } from "~/components/shared/polls/FeedPollWidget";
import { FacetCard } from "~/components/ui/facet-container";
import { Button } from "~/components/ui/button";

interface ActivityData {
  id: string;
  type: "achievement" | "diplomatic" | "economic" | "social" | "meta";
  category: "game" | "platform" | "social";
  user: {
    id: string;
    name: string;
    countryName?: string;
    countryId?: string;
  };
  content: {
    title: string;
    description: string;
    metadata?: Record<string, any>;
  };
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
  timestamp: Date;
  priority: string;
  visibility: string;
  relatedCountries: string[];
  poll?: any;
}

interface ActivityFeedItemProps {
  activity: ActivityData;
}

const activityTypeConfig = {
  achievement: {
    icon: Trophy,
    color: "text-yellow",
    bgColor: "bg-yellow/10",
    label: "Achievement",
  },
  economic: {
    icon: TrendingUp,
    color: "text-green",
    bgColor: "bg-green/10",
    label: "Economic",
  },
  diplomatic: {
    icon: Globe,
    color: "text-indigo",
    bgColor: "bg-indigo/10",
    label: "Diplomatic",
  },
  social: {
    icon: MessageSquare,
    color: "text-blue",
    bgColor: "bg-blue/10",
    label: "Social",
  },
  meta: {
    icon: Activity,
    color: "text-teal",
    bgColor: "bg-teal/10",
    label: "Platform",
  },
};

export function ActivityFeedItem({ activity }: ActivityFeedItemProps) {
  const [expanded, setExpanded] = React.useState(false);
  const config = activityTypeConfig[activity.type];
  const IconComponent = config.icon;

  return (
    <FacetCard className="group p-4 sm:p-6">
      {/* Header */}
      <div className="mb-3 flex items-start gap-3 sm:mb-4 sm:gap-4">
        {/* Icon */}
        <div className={`shrink-0 rounded-full p-2 sm:p-3 ${config.bgColor}`}>
          <IconComponent className={`h-4 w-4 sm:h-5 sm:w-5 ${config.color}`} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Title and Badge */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-headline text-label break-words">{activity.content.title}</h3>
            <Badge variant="outline" className={`text-footnote ${config.color}`}>
              {config.label}
            </Badge>
          </div>

          {/* User/Country Info */}
          <div className="text-label-secondary text-footnote sm:text-body mb-2 flex flex-wrap items-center gap-2 sm:gap-2">
            {activity.user.countryName && (
              <>
                <UnifiedCountryFlag
                  showTooltip={false}
                  countryName={activity.user.countryName}
                  size="sm"
                />
                <span className="max-w-[120px] truncate sm:max-w-none">
                  {activity.user.countryName}
                </span>
                <span className="hidden sm:inline">•</span>
              </>
            )}
            {(!activity.poll || activity.user.name !== "User") && (
              <>
                <span className="max-w-[100px] truncate sm:max-w-none">{activity.user.name}</span>
                <span className="hidden sm:inline">•</span>
              </>
            )}
            <Clock className="h-3 w-3 shrink-0" />
            <span className="text-footnote">
              {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
            </span>
          </div>

          {/* Description or Poll */}
          {activity.poll ? (
            <FeedPollWidget poll={activity.poll} />
          ) : (
            <>
              {/* Description */}
              <p
                className={`text-label-secondary text-body ${
                  !expanded && activity.content.description.length > 150 ? "line-clamp-2" : ""
                }`}
              >
                {activity.content.description}
              </p>

              {/* Expand Button */}
              {activity.content.description.length > 150 && (
                <Button
                  variant="plain"
                  size="sm"
                  onClick={() => setExpanded(!expanded)}
                  className="mt-1 px-0"
                  aria-expanded={expanded}
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="h-3 w-3" /> Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3" /> Show more
                    </>
                  )}
                </Button>
              )}
            </>
          )}

          {/* Metadata */}
          {expanded && activity.content.metadata && (
            <div className="bg-surface-secondary rounded-row mt-3 p-3">
              <div className="text-label-secondary text-caption">Additional Details:</div>
              <div className="mt-2 space-y-1">
                {Object.entries(activity.content.metadata).map(([key, value]) => (
                  <div key={key} className="text-footnote flex items-center gap-2">
                    <span className="text-label-secondary capitalize">
                      {key.replace(/([A-Z])/g, " $1").trim()}:
                    </span>
                    <span className="text-label font-medium">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer - Engagement Stats */}
      <div className="border-separator flex flex-wrap items-center justify-between gap-2 border-t pt-3 sm:pt-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="text-label-secondary text-footnote sm:text-body flex items-center gap-1 sm:gap-2">
            <Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>{activity.engagement.likes}</span>
          </div>
          <div className="text-label-secondary text-footnote sm:text-body flex items-center gap-1 sm:gap-2">
            <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>{activity.engagement.comments}</span>
          </div>
          <div className="text-label-secondary text-footnote sm:text-body flex items-center gap-1 sm:gap-2">
            <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>{activity.engagement.shares}</span>
          </div>
          <div className="text-label-secondary text-body hidden items-center gap-2 sm:flex">
            <Eye className="h-4 w-4" />
            <span>{activity.engagement.views}</span>
          </div>
        </div>

        {/* Priority Indicator */}
        {activity.priority === "high" || activity.priority === "critical" ? (
          <Badge variant="destructive" className="text-footnote">
            {activity.priority === "critical" ? "Critical" : "High Priority"}
          </Badge>
        ) : null}
      </div>
    </FacetCard>
  );
}
