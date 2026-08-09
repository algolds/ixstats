export type DashboardFeedSource = "activity" | "thinkpages" | "wiki" | "forum";

export interface FeedUser {
  id?: string;
  name?: string;
  countryId?: string;
  countryName?: string;
  flagUrl?: string;
  slug?: string;
  avatarUrl?: string;
}

export interface ActivityMetadata {
  category?: string;
  pageTitle?: string;
  countryId?: string;
  countryName?: string;
  [key: string]: unknown;
}

export interface ActivityContent {
  title?: string;
  description?: string;
  link?: string;
  metadata?: ActivityMetadata;
}

export interface BaseFeedItem {
  id: string;
  timestamp: string | Date;
  source: DashboardFeedSource;
  user?: FeedUser;
}

export interface ActivityFeedItem extends BaseFeedItem {
  source: "activity";
  category?: string;
  content?: ActivityContent;
}

export interface ThinkpagesFeedItem extends BaseFeedItem {
  source: "thinkpages";
  post?: Record<string, unknown>;
  content?: ActivityContent;
}

export interface WikiFeedItem extends BaseFeedItem {
  source: "wiki";
  content?: ActivityContent;
  _grouped?: boolean;
  _editCount?: number;
  _editors?: string[];
  _totalBytes?: number;
  _subEdits?: WikiFeedItem[];
  _isNew?: boolean;
}

export interface ForumFeedItem extends BaseFeedItem {
  source: "forum";
  content?: ActivityContent;
}

export type UnifiedFeedItemType =
  | ActivityFeedItem
  | ThinkpagesFeedItem
  | WikiFeedItem
  | ForumFeedItem;

export interface GroupedActivityItem extends BaseFeedItem {
  source: "activity";
  content?: ActivityContent;
  _grouped?: boolean;
  _activityCount?: number;
  _displayName?: string;
  _subActivities?: ActivityFeedItem[];
}

export type ProcessedFeedItem = UnifiedFeedItemType | GroupedActivityItem;
