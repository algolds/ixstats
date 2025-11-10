"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Globe,
  Users,
  Trophy,
  Activity,
  MessageSquare,
  Heart,
  Share2,
  Eye,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { SimpleFlag } from "~/components/SimpleFlag";
import { formatDistanceToNow } from "date-fns";

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
}

interface ActivityFeedItemProps {
  activity: ActivityData;
}

const activityTypeConfig = {
  achievement: {
    icon: Trophy,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    label: "Achievement",
  },
  economic: {
    icon: TrendingUp,
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    label: "Economic",
  },
  diplomatic: {
    icon: Globe,
    color: "text-indigo-400",
    bgColor: "bg-indigo-500/10",
    label: "Diplomatic",
  },
  social: {
    icon: MessageSquare,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    label: "Social",
  },
  meta: {
    icon: Activity,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    label: "Platform",
  },
};

export function ActivityFeedItem({ activity }: ActivityFeedItemProps) {
  const [expanded, setExpanded] = React.useState(false);
  const config = activityTypeConfig[activity.type];
  const IconComponent = config.icon;

  return (
    <div className="glass-hierarchy-child group rounded-lg p-6 transition-all hover:scale-[1.01]">
      {/* Header */}
      <div className="mb-4 flex items-start gap-4">
        {/* Icon */}
        <div className={`rounded-full p-3 ${config.bgColor} transition-transform group-hover:scale-110`}>
          <IconComponent className={`h-5 w-5 ${config.color}`} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Title and Badge */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-foreground text-base font-semibold">{activity.content.title}</h3>
            <Badge variant="outline" className={`text-xs ${config.color}`}>
              {config.label}
            </Badge>
          </div>

          {/* User/Country Info */}
          <div className="text-muted-foreground mb-2 flex items-center gap-2 text-sm">
            {activity.user.countryName && (
              <>
                <SimpleFlag countryName={activity.user.countryName} size="sm" />
                <span>{activity.user.countryName}</span>
                <span>•</span>
              </>
            )}
            <span>{activity.user.name}</span>
            <span>•</span>
            <Clock className="h-3 w-3" />
            <span>
              {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
            </span>
          </div>

          {/* Description */}
          <p
            className={`text-muted-foreground text-sm ${
              !expanded && activity.content.description.length > 150 ? "line-clamp-2" : ""
            }`}
          >
            {activity.content.description}
          </p>

          {/* Expand Button */}
          {activity.content.description.length > 150 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-primary mt-2 flex items-center gap-1 text-xs font-medium hover:underline"
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
            </button>
          )}

          {/* Metadata */}
          {expanded && activity.content.metadata && (
            <div className="bg-muted/30 mt-3 rounded-lg p-3">
              <div className="text-muted-foreground text-xs font-medium">Additional Details:</div>
              <div className="mt-2 space-y-1">
                {Object.entries(activity.content.metadata).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground capitalize">
                      {key.replace(/([A-Z])/g, " $1").trim()}:
                    </span>
                    <span className="text-foreground font-medium">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer - Engagement Stats */}
      <div className="border-border flex items-center justify-between border-t pt-4">
        <div className="flex items-center gap-4">
          <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Heart className="h-4 w-4" />
            <span>{activity.engagement.likes}</span>
          </div>
          <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <MessageSquare className="h-4 w-4" />
            <span>{activity.engagement.comments}</span>
          </div>
          <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Share2 className="h-4 w-4" />
            <span>{activity.engagement.shares}</span>
          </div>
          <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Eye className="h-4 w-4" />
            <span>{activity.engagement.views}</span>
          </div>
        </div>

        {/* Priority Indicator */}
        {activity.priority === "high" || activity.priority === "critical" ? (
          <Badge variant="destructive" className="text-xs">
            {activity.priority === "critical" ? "Critical" : "High Priority"}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
