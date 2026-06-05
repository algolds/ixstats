/**
 * Pure transforms for the platform activity feed.
 *
 * Extracted from PlatformActivityFeed.tsx (audit C1). Maps raw tRPC payloads
 * (global activity feed + ThinkPages posts + trending topics) into the view model,
 * then merges/deduplicates/sorts. No React dependencies.
 */
import type { ActivityFeedItem, TrendingTopic, ActivityUserProfile } from "./activity-formatting";

export type ActivityTab = "all" | "following" | "friends" | "achievements";
export type ActivityFilterType = "all" | "game" | "platform" | "social";

/** Filter the activity feed by tab, category, and search query. Pure. */
export function filterActivities(
  activityFeed: ActivityFeedItem[],
  opts: { activeTab: ActivityTab; filterType: ActivityFilterType; searchQuery: string },
  userProfile?: ActivityUserProfile
): ActivityFeedItem[] {
  const { activeTab, filterType, searchQuery } = opts;
  const query = searchQuery.toLowerCase();
  return activityFeed.filter((activity) => {
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "following" &&
        userProfile?.followingCountries?.some((id) => activity.relatedCountries?.includes(id))) ||
      (activeTab === "friends" && userProfile?.friends?.includes(activity.user.id)) ||
      (activeTab === "achievements" && activity.type === "achievement");

    const matchesFilter = filterType === "all" || activity.category === filterType;

    const matchesSearch =
      searchQuery === "" ||
      activity.content.title.toLowerCase().includes(query) ||
      activity.content.description.toLowerCase().includes(query) ||
      activity.user.name.toLowerCase().includes(query);

    return matchesTab && matchesFilter && matchesSearch;
  });
}

export function buildTrendingTopics(trendingData: any): TrendingTopic[] {
  if (!trendingData) return [];
  return trendingData.map((topic: any) => ({
    id: topic.id,
    title: topic.title,
    category: topic.category,
    participants: topic.participants,
    trend: topic.trend,
  }));
}

/**
 * Build the merged, deduplicated, time-sorted activity feed from the global
 * activity feed and ThinkPages posts. `flagUrls` maps country name -> flag URL.
 */
export function buildActivityFeed(
  activitiesData: any,
  thinkpagesFeed: any,
  flagUrls: Record<string, string>
): ActivityFeedItem[] {
  const regularActivities: ActivityFeedItem[] = activitiesData?.activities
    ? activitiesData.activities.map((activity: any) => ({
        id: activity.id,
        type: activity.type as ActivityFeedItem["type"],
        category: activity.category as ActivityFeedItem["category"],
        user: {
          id: activity.user.id,
          name:
            activity.category === "platform" || activity.type === "meta"
              ? "SYSTEM"
              : activity.user.name,
          avatar: undefined, // No placeholder avatars - only real user avatars
          countryName:
            activity.category === "platform" || activity.type === "meta"
              ? "System"
              : activity.user.countryName,
          countryFlag:
            activity.category === "platform" || activity.type === "meta"
              ? undefined
              : activity.user.countryName
                ? flagUrls[activity.user.countryName]
                : undefined,
        },
        content: {
          title: activity.content.title,
          description: activity.content.description,
          metadata: activity.content.metadata,
        },
        engagement: {
          likes: activity.engagement.likes,
          comments: activity.engagement.comments,
          reshares: activity.engagement.shares, // Map shares to reshares for backend compatibility
          views: activity.engagement.views || 0,
        },
        timestamp: new Date(activity.timestamp),
        priority: activity.priority as ActivityFeedItem["priority"],
        visibility: activity.visibility as ActivityFeedItem["visibility"],
        relatedCountries: activity.relatedCountries || [],
      }))
    : [];

  // Add ThinkPages posts as social activities
  const thinkpagesActivities: ActivityFeedItem[] = thinkpagesFeed?.posts
    ? thinkpagesFeed.posts.map((post: any) => ({
        id: `thinkpages-${post.id}`,
        type: "social" as const,
        category: "social" as const,
        user: {
          id: post.account?.id || post.accountId,
          name: post.account?.displayName || "ThinkPages User",
          avatar: post.account?.profileImageUrl ? post.account.profileImageUrl : undefined,
          countryName: post.account?.username, // Use username for @ display
          countryFlag: undefined,
        },
        content: {
          title: "Posted on ThinkPages",
          description: post.content,
          metadata: {
            postId: post.id,
            hashtags: post.hashtags,
          },
        },
        engagement: {
          likes: post.reactions.length,
          comments: post._count.replies,
          reshares: post._count.reposts || 0,
          views: 0, // View tracking not implemented yet
        },
        timestamp: new Date(post.createdAt),
        priority: "low" as const,
        visibility: "public" as const,
        relatedCountries: [],
      }))
    : [];

  // Merge, deduplicate, and sort by timestamp
  const allActivities = [...regularActivities, ...thinkpagesActivities];
  const uniqueActivities = allActivities.filter(
    (activity, index, self) => index === self.findIndex((a) => a.id === activity.id)
  );
  return uniqueActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}
