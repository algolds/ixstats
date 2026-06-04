/**
 * Activity feed types and pure presentation helpers.
 *
 * Extracted from PlatformActivityFeed.tsx (audit C1) so the formatting logic is
 * framework-free and unit-testable. No React dependencies.
 */
import {
  Activity,
  Users,
  TrendingUp,
  Trophy,
  Target,
  Handshake,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface TrendingTopic {
  id: string;
  title: string;
  category: string;
  participants: number;
  trend: "up" | "down" | "stable";
}

export interface ActivityFeedItem {
  id: string;
  type: "achievement" | "milestone" | "social" | "diplomatic" | "economic" | "meta";
  category: "game" | "platform" | "social";
  user: {
    id: string;
    name: string;
    avatar?: string;
    countryName?: string;
    countryFlag?: string;
  };
  content: {
    title: string;
    description: string;
    metadata?: Record<string, any>;
  };
  engagement: {
    likes: number;
    comments: number;
    reshares: number;
    views?: number;
  };
  timestamp: Date;
  priority: "low" | "medium" | "high" | "critical";
  visibility: "public" | "followers" | "friends";
  relatedCountries?: string[];
  attachments?: {
    type: "image" | "chart" | "document";
    url: string;
    caption?: string;
  }[];
}

export interface ActivityUserProfile {
  id: string;
  countryId?: string;
  followingCountries?: string[];
  friends?: string[];
  achievements?: number;
  influence?: number;
}

export function getActivityIcon(type: ActivityFeedItem["type"]): LucideIcon {
  switch (type) {
    case "achievement":
      return Trophy;
    case "milestone":
      return Target;
    case "social":
      return Users;
    case "diplomatic":
      return Handshake;
    case "economic":
      return TrendingUp;
    case "meta":
      return Zap;
    default:
      return Activity;
  }
}

export function getActivityColor(type: ActivityFeedItem["type"]): string {
  switch (type) {
    case "achievement":
      return "text-yellow-500";
    case "milestone":
      return "text-blue-500";
    case "social":
      return "text-green-500";
    case "diplomatic":
      return "text-purple-500";
    case "economic":
      return "text-emerald-500";
    case "meta":
      return "text-orange-500";
    default:
      return "text-gray-500";
  }
}

export function getPriorityBorder(priority: ActivityFeedItem["priority"]): string {
  switch (priority) {
    case "critical":
      return "border-l-4 border-l-red-500";
    case "high":
      return "border-l-4 border-l-yellow-500";
    case "medium":
      return "border-l-2 border-l-blue-500";
    default:
      return "border-l border-l-gray-300";
  }
}

export function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
