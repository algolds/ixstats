"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

/**
 * Like/reshare and comment interactions for the activity feed, plus the local
 * comment UI state (open panels, drafts, loaded comments).
 * Extracted from PlatformActivityFeed.tsx (audit C1).
 */
export function useActivityEngagement(params: {
  userId?: string;
  refetchActivities: () => Promise<unknown>;
}) {
  const { userId, refetchActivities } = params;

  const [showComments, setShowComments] = useState<Record<string, boolean>>({});
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, any[]>>({});

  const engageWithActivityMutation = api.activities.engageWithActivity.useMutation();
  const addCommentMutation = api.activities.addComment.useMutation();
  const utils = api.useUtils();

  const handleEngagement = async (
    activityId: string,
    action: "like" | "unlike" | "reshare" | "view"
  ) => {
    if (!userId || !activityId) {
      console.error("Missing user ID or activity ID", { userId, activityId });
      return;
    }

    try {
      const result = await engageWithActivityMutation.mutateAsync({ activityId, action, userId });
      if (result.success) {
        await refetchActivities();
      }
    } catch (error) {
      console.error("Error engaging with activity:", error);
    }
  };

  const handleComment = async (activityId: string) => {
    if (!userId || !newComment[activityId]?.trim()) return;

    try {
      await addCommentMutation.mutateAsync({
        activityId,
        userId,
        content: newComment[activityId].trim(),
      });

      setNewComment((prev) => ({ ...prev, [activityId]: "" }));

      await Promise.all([
        refetchActivities(),
        showComments[activityId]
          ? (async () => {
              const commentsData = await utils.activities.getComments.fetch({ activityId });
              setComments((prev) => ({ ...prev, [activityId]: commentsData.comments }));
            })()
          : Promise.resolve(),
      ]);
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const toggleComments = async (activityId: string) => {
    const isShowing = showComments[activityId];

    setShowComments((prev) => ({ ...prev, [activityId]: !prev[activityId] }));

    if (!isShowing && !comments[activityId]) {
      try {
        const commentsData = await utils.activities.getComments.fetch({ activityId });
        setComments((prev) => ({ ...prev, [activityId]: commentsData.comments }));
      } catch (error) {
        console.error("Error fetching comments:", error);
      }
    }
  };

  return {
    showComments,
    newComment,
    setNewComment,
    comments,
    isEngagePending: engageWithActivityMutation.isPending,
    isCommentPending: addCommentMutation.isPending,
    handleEngagement,
    handleComment,
    toggleComments,
  };
}
