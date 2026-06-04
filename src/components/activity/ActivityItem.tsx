"use client";

import React from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Heart, MessageSquare, Repeat } from "lucide-react";
import { cn } from "~/lib/utils";
import { formatCurrency } from "~/lib/chart-utils";
import {
  getActivityIcon,
  getActivityColor,
  getPriorityBorder,
  formatTimeAgo,
  type ActivityFeedItem,
} from "~/lib/activity-formatting";

interface ActivityItemProps {
  activity: ActivityFeedItem;
  index: number;
  liked: boolean;
  shared: boolean;
  isAuthenticated: boolean;
  isEngagePending: boolean;
  isCommentPending: boolean;
  showComments: boolean;
  commentDraft: string;
  commentsList?: any[];
  currentUserImageUrl?: string;
  currentUserInitials?: string;
  onEngage: (action: "like" | "unlike" | "reshare" | "view") => void;
  onToggleComments: () => void;
  onCommentDraftChange: (value: string) => void;
  onSubmitComment: () => void;
}

/** A single card in the platform activity feed. */
export const ActivityItem = React.memo(function ActivityItem({
  activity,
  index,
  liked,
  shared,
  isAuthenticated,
  isEngagePending,
  isCommentPending,
  showComments,
  commentDraft,
  commentsList,
  currentUserImageUrl,
  currentUserInitials,
  onEngage,
  onToggleComments,
  onCommentDraftChange,
  onSubmitComment,
}: ActivityItemProps) {
  const IconComponent = getActivityIcon(activity.type);
  const iconColor = getActivityColor(activity.type);
  const priorityBorder = getPriorityBorder(activity.priority);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={cn(
        "glass-hierarchy-child group relative overflow-hidden rounded-xl p-4 transition-all duration-200 hover:scale-[1.01]",
        priorityBorder
      )}
    >
      {/* Background Flag Blur */}
      {activity.user.countryFlag && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-10 blur-md"
          style={{ backgroundImage: `url(${activity.user.countryFlag})` }}
        />
      )}

      <div className="relative z-10 flex gap-4">
        {/* User Avatar */}
        <div className="shrink-0">
          <Avatar className="h-12 w-12">
            {activity.user.countryFlag ? (
              <AvatarImage src={activity.user.countryFlag} />
            ) : (
              <AvatarImage src={activity.user.avatar} />
            )}
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
              {activity.user.countryName ? activity.user.countryName.charAt(0).toUpperCase() : "U"}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Link href="/thinkpages" className="hover:underline">
                <h4 className="text-foreground font-semibold">
                  @{activity.user.countryName || "Unknown"}
                </h4>
              </Link>
              <IconComponent className={cn("h-4 w-4", iconColor)} />
            </div>
            <span className="text-muted-foreground text-xs">
              {formatTimeAgo(activity.timestamp)}
            </span>
          </div>

          <h5 className="text-foreground mb-1 font-medium">{activity.content.title}</h5>
          <p className="text-muted-foreground mb-3 line-clamp-2 text-sm">
            {activity.content.description}
          </p>

          {/* Metadata Display */}
          {activity.content.metadata && (
            <div className="mb-3 flex flex-wrap gap-2">
              {Object.entries(activity.content.metadata).map(([key, value]) => {
                if (key === "gdp" && typeof value === "number") {
                  return (
                    <Badge key={key} variant="secondary" className="text-xs">
                      GDP: {formatCurrency(value)}
                    </Badge>
                  );
                }
                if (key === "tier" && typeof value === "string") {
                  return (
                    <Badge key={key} variant="secondary" className="text-xs">
                      {value}
                    </Badge>
                  );
                }
                return null;
              })}
            </div>
          )}

          {/* Engagement Actions - LIVE DATA */}
          <div className="text-muted-foreground flex items-center gap-6 text-sm">
            {/* Like Button */}
            <button
              className={cn(
                "flex items-center gap-1 transition-colors disabled:opacity-50",
                liked ? "text-red-500 hover:text-red-600" : "hover:text-red-500",
                !isAuthenticated && "cursor-not-allowed opacity-50"
              )}
              onClick={() => {
                if (!isAuthenticated) return;
                onEngage(liked ? "unlike" : "like");
              }}
              disabled={isEngagePending || !isAuthenticated}
              title={!isAuthenticated ? "Please sign in to like posts" : ""}
            >
              <Heart className={cn("h-4 w-4", liked && "fill-current")} />
              {activity.engagement.likes}
            </button>

            {/* Comment Button */}
            <button
              className="flex items-center gap-1 transition-colors hover:text-blue-500"
              onClick={onToggleComments}
            >
              <MessageSquare className="h-4 w-4" />
              {activity.engagement.comments}
            </button>

            {/* Reshare Button */}
            <button
              className={cn(
                "flex items-center gap-1 transition-colors disabled:opacity-50",
                shared ? "text-green-500 hover:text-green-600" : "hover:text-green-500",
                !isAuthenticated && "cursor-not-allowed opacity-50"
              )}
              onClick={() => {
                if (!isAuthenticated) return;
                onEngage("reshare");
              }}
              disabled={isEngagePending || !isAuthenticated}
              title={!isAuthenticated ? "Please sign in to reshare posts" : "Reshare to your profile"}
            >
              <Repeat className="h-4 w-4" />
              {activity.engagement.reshares}
            </button>
          </div>

          {/* Comment Section */}
          {showComments && (
            <div className="border-border/50 mt-4 border-t pt-4">
              {/* Add Comment */}
              {isAuthenticated ? (
                <div className="mb-4 flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={currentUserImageUrl} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-sm text-white">
                      {currentUserInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <textarea
                      value={commentDraft}
                      onChange={(e) => onCommentDraftChange(e.target.value)}
                      placeholder="Write a comment..."
                      className="glass-hierarchy-interactive w-full resize-none rounded-lg p-3 text-sm"
                      rows={2}
                    />
                    <div className="mt-2 flex justify-end">
                      <Button
                        size="sm"
                        onClick={onSubmitComment}
                        disabled={isCommentPending || !commentDraft?.trim()}
                      >
                        {isCommentPending ? "Posting..." : "Comment"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="glass-hierarchy-child rounded-lg py-4 text-center">
                  <p className="text-muted-foreground mb-2 text-sm">Please sign in to comment</p>
                  <Button size="sm" variant="outline">
                    Sign In
                  </Button>
                </div>
              )}

              {/* Comments List */}
              <div className="space-y-3">
                {commentsList?.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-600 text-xs text-white">
                        U
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="glass-hierarchy-interactive rounded-lg p-3">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-foreground text-sm font-medium">User</span>
                          <span className="text-muted-foreground text-xs">
                            {formatTimeAgo(new Date(comment.createdAt))}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-sm">{comment.content}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {(!commentsList || commentsList.length === 0) && (
                  <div className="text-muted-foreground py-4 text-center text-sm">
                    No comments yet. Be the first to comment!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});
