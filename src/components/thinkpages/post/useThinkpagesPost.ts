"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { usePermissions } from "~/hooks/usePermissions";
import { extractHashtags, extractMentions } from "~/lib/utils";
import { parseSportsBulletin } from "~/lib/sports/feed-bulletins";
import { proxyDiscordUrl } from "./ThinkpagesPostUtils";

export interface BlurbMeta {
  isBlurb: boolean;
  promptTitle?: string;
  promptSlug?: string;
  cleanContent: string;
}

export function parseBlurbMeta(post: {
  hashtags?: string[] | string | null;
  content?: string;
}): BlurbMeta {
  const content = post.content ?? "";

  let hashtags: string[] = [];
  if (Array.isArray(post.hashtags)) {
    hashtags = post.hashtags;
  } else if (typeof post.hashtags === "string") {
    try {
      hashtags = JSON.parse(post.hashtags);
    } catch {}
  }

  if (!hashtags.includes("blurb")) {
    return { isBlurb: false, cleanContent: content };
  }

  const match = content.match(/^\[blurb:([^\]|]+)\|([^\]]+)\]\n\n([\s\S]*)$/);
  if (match) {
    return {
      isBlurb: true,
      promptSlug: match[1],
      promptTitle: match[2],
      cleanContent: match[3] ?? "",
    };
  }

  const cleaned = content.replace(/\n\n.*?— Read full blurb →.*$/, "").trim();
  return { isBlurb: true, cleanContent: cleaned };
}

export function useThinkpagesPost(post: any, currentUserAccountId: string, showThread = false) {
  const notify = useNotify();
  const utils = api.useUtils();
  const blurbMeta = parseBlurbMeta(post);

  const { user: currentUserData } = usePermissions();
  const currentUserRoleLevel = currentUserData?.role?.level ?? 100;

  const isOwnPost = currentUserAccountId === post.account?.id;
  const isCurrentUserStaff = currentUserRoleLevel === 20;
  const targetUserClerkUserId = post.account?.clerkUserId;

  const targetUserQuery = api.users.getUserWithRole.useQuery(
    { clerkUserId: targetUserClerkUserId || "" },
    {
      enabled: isCurrentUserStaff && !isOwnPost && !!targetUserClerkUserId,
      staleTime: 5 * 60_000,
    }
  );

  const targetUserRoleLevel = targetUserQuery.data?.user?.role?.level ?? 100;

  const canEdit =
    isOwnPost ||
    currentUserRoleLevel <= 10 ||
    (currentUserRoleLevel === 20 && targetUserRoleLevel >= 20);

  const canDelete =
    isOwnPost ||
    currentUserRoleLevel <= 10 ||
    (currentUserRoleLevel === 20 && targetUserRoleLevel >= 20);

  const visualizations = useMemo(() => {
    try {
      if (typeof post.visualizations === "string") {
        return JSON.parse(post.visualizations);
      }
      return post.visualizations || [];
    } catch (e) {
      console.warn("Failed to parse visualizations:", e);
      return [];
    }
  }, [post.visualizations]);

  const rawImageUrls = useMemo(() => {
    const content = post.content ?? "";
    const imageRegex = /https?:\/\/[^\s<"']+\.(?:png|jpg|jpeg|gif|webp)(?:\?[^\s<"']*)?/gi;
    const matches = content.match(imageRegex);
    return matches ? Array.from(new Set(matches)) : [];
  }, [post.content]);

  const mediaAttachments = useMemo(() => {
    const raw = [
      ...(Array.isArray(post.mediaAttachments) ? post.mediaAttachments : []),
      ...rawImageUrls.map((url, i) => ({
        id: `raw_${i}`,
        url,
        type: "image",
        filename: `image_${i + 1}`,
      })),
    ];
    return raw.map((att: any) => ({
      ...att,
      url: proxyDiscordUrl(att.url),
    }));
  }, [post.mediaAttachments, rawImageUrls]);

  const cleanPostContent = useMemo(() => {
    let c = blurbMeta.isBlurb ? blurbMeta.cleanContent : post.content;
    if (!c) return "";
    rawImageUrls.forEach((url: any) => {
      const stringUrl = String(url);
      const escapedUrl = stringUrl.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
      const reg = new RegExp(`\\s*${escapedUrl}\\s*`, "gi");
      c = c.replace(reg, " ");
    });
    return c.trim();
  }, [blurbMeta.isBlurb, blurbMeta.cleanContent, post.content, rawImageUrls]);

  const sportsBulletin = useMemo(() => parseSportsBulletin(cleanPostContent), [cleanPostContent]);

  const repostImageUrls = useMemo(() => {
    const content = post.repostOf?.content ?? "";
    const imageRegex = /https?:\/\/[^\s<"']+\.(?:png|jpg|jpeg|gif|webp)(?:\?[^\s<"']*)?/gi;
    const matches = content.match(imageRegex);
    return matches ? Array.from(new Set(matches)) : [];
  }, [post.repostOf?.content]);

  const repostMediaAttachments = useMemo(() => {
    const raw = [
      ...(Array.isArray(post.repostOf?.mediaAttachments) ? post.repostOf.mediaAttachments : []),
      ...repostImageUrls.map((url, i) => ({
        id: `repost_raw_${i}`,
        url,
        type: "image",
        filename: `repost_image_${i + 1}`,
      })),
    ];
    return raw.map((att: any) => ({
      ...att,
      url: proxyDiscordUrl(att.url),
    }));
  }, [post.repostOf?.mediaAttachments, repostImageUrls]);

  const cleanRepostContent = useMemo(() => {
    let c = post.repostOf?.content;
    if (!c) return "";
    repostImageUrls.forEach((url: any) => {
      const stringUrl = String(url);
      const escapedUrl = stringUrl.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
      const reg = new RegExp(`\\s*${escapedUrl}\\s*`, "gi");
      c = c.replace(reg, " ");
    });
    return c.trim();
  }, [post.repostOf?.content, repostImageUrls]);

  const [showReplies, setShowReplies] = useState(false);
  const threadQuery = api.thinkpages.getPost.useQuery(
    { postId: post.id },
    { enabled: showReplies && showThread }
  );

  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [showEditComposer, setShowEditComposer] = useState(false);
  const [editText, setEditText] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [showReactionsDialog, setShowReactionsDialog] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string; id: string } | null>(null);

  useEffect(() => {
    if (!lightboxMedia) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxMedia(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxMedia]);

  const { data: discordEmojisData } = api.thinkpages.getDiscordEmojis.useQuery(
    {},
    { staleTime: 5 * 60_000 }
  );
  const apiDiscordEmojis = discordEmojisData?.emojis;

  useEffect(() => {
    const handleClickOutside = () => {
      if (showMoreOptions) {
        setShowMoreOptions(false);
      }
    };

    if (showMoreOptions) {
      document.addEventListener("click", handleClickOutside);
    }
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showMoreOptions]);

  const createPostMutation = api.thinkpages.createPost.useMutation({
    onSuccess: () => {
      void utils.thinkpages.getFeed.invalidate();
      void utils.activities.getGlobalFeed.invalidate();
      void utils.activities.getFollowingFeed.invalidate();
      if (post.account?.clerkUserId) {
        void utils.thinkpages.getPostsByClerkUserId.invalidate({
          clerkUserId: post.account.clerkUserId,
        });
      }
      void utils.thinkpages.getPost.invalidate({ postId: post.id });
    },
  });

  const updatePostMutation = api.thinkpages.updatePost.useMutation({
    onSuccess: () => {
      void utils.thinkpages.getFeed.invalidate();
      if (post.account?.clerkUserId) {
        void utils.thinkpages.getPostsByClerkUserId.invalidate({
          clerkUserId: post.account.clerkUserId,
        });
      }
      void utils.thinkpages.getPost.invalidate({ postId: post.id });
    },
  });

  const deletePostMutation = api.thinkpages.deletePost.useMutation({
    onSuccess: () => {
      void utils.thinkpages.getFeed.invalidate();
      if (post.account?.clerkUserId) {
        void utils.thinkpages.getPostsByClerkUserId.invalidate({
          clerkUserId: post.account.clerkUserId,
        });
      }
      if (post.parentPostId) {
        void utils.thinkpages.getPost.invalidate({ postId: post.parentPostId });
      }
      void utils.thinkpages.getPost.invalidate({ postId: post.id });
    },
  });

  const pinPostMutation = api.thinkpages.pinPost.useMutation({
    onSuccess: () => {
      void utils.thinkpages.getFeed.invalidate();
      if (post.account?.clerkUserId) {
        void utils.thinkpages.getPostsByClerkUserId.invalidate({
          clerkUserId: post.account.clerkUserId,
        });
      }
      void utils.thinkpages.getPost.invalidate({ postId: post.id });
    },
  });

  const bookmarkPostMutation = api.thinkpages.bookmarkPost.useMutation({
    onSuccess: () => {
      void utils.thinkpages.getFeed.invalidate();
      if (post.account?.clerkUserId) {
        void utils.thinkpages.getPostsByClerkUserId.invalidate({
          clerkUserId: post.account.clerkUserId,
        });
      }
      void utils.thinkpages.getPost.invalidate({ postId: post.id });
    },
  });

  const flagPostMutation = api.thinkpages.flagPost.useMutation();

  const handlePin = useCallback(async () => {
    if (!currentUserAccountId) return;
    try {
      await pinPostMutation.mutateAsync({
        postId: post.id,
        accountId: currentUserAccountId,
        pinned: !post.pinned,
      });
      notify.success(post.pinned ? "Post unpinned" : "Post pinned");
    } catch (error: any) {
      notify.error(error.message || "Failed to pin post");
    }
  }, [pinPostMutation, post.id, post.pinned, currentUserAccountId, notify]);

  const handleBookmark = useCallback(async () => {
    if (!currentUserAccountId) return;
    try {
      await bookmarkPostMutation.mutateAsync({
        postId: post.id,
        userId: currentUserAccountId,
        bookmarked: true,
      });
      notify.success("Post bookmarked");
    } catch (error: any) {
      notify.error(error.message || "Failed to bookmark post");
    }
  }, [bookmarkPostMutation, post.id, currentUserAccountId, notify]);

  const handleFlag = useCallback(() => {
    if (!currentUserAccountId) return;
    setShowFlagDialog(true);
    setShowMoreOptions(false);
  }, [currentUserAccountId]);

  const handleSubmitFlag = useCallback(async () => {
    if (!flagReason.trim()) return;

    try {
      await flagPostMutation.mutateAsync({
        postId: post.id,
        userId: currentUserAccountId,
        reason: flagReason,
      });
      notify.success("Post flagged");
      setShowFlagDialog(false);
      setFlagReason("");
    } catch (error: any) {
      notify.error(error.message || "Failed to flag post");
    }
  }, [flagPostMutation, post.id, currentUserAccountId, flagReason, notify]);

  const handleEdit = useCallback(() => {
    if (!canEdit) return;
    setEditText(post.content);
    setShowEditComposer(true);
    setShowMoreOptions(false);
  }, [post.content, canEdit]);

  const handleSubmitEdit = useCallback(async () => {
    if (!editText.trim() || editText === post.content) {
      setShowEditComposer(false);
      return;
    }

    try {
      await updatePostMutation.mutateAsync({
        postId: post.id,
        content: editText,
      });
      notify.success("Post updated");
      setShowEditComposer(false);
    } catch (error: any) {
      notify.error(error.message || "Failed to update post");
    }
  }, [updatePostMutation, post.id, editText, post.content, notify]);

  const handleDelete = useCallback(() => {
    if (!canDelete) return;
    setShowDeleteConfirm(true);
    setShowMoreOptions(false);
  }, [canDelete]);

  const handleConfirmDelete = useCallback(async () => {
    try {
      await deletePostMutation.mutateAsync({
        postId: post.id,
      });
      notify.success("Post deleted");
      setShowDeleteConfirm(false);
    } catch (error: any) {
      notify.error(error.message || "Failed to delete post");
    }
  }, [deletePostMutation, post.id, notify]);

  const handleReply = useCallback(() => {
    setShowReplyComposer(!showReplyComposer);
    if (!showReplyComposer) {
      const mentionText = `@${post.account?.username} `;
      setReplyText(mentionText);
    }
  }, [showReplyComposer, post.account?.username]);

  const handleSubmitReply = useCallback(
    async (mediaUrls: string[] = []) => {
      if (!currentUserAccountId) {
        notify.error("Please select or create an account first to reply.");
        return;
      }
      if (!replyText.trim() && mediaUrls.length === 0) {
        notify.error("Please enter a reply or attach media.");
        return;
      }

      try {
        await createPostMutation.mutateAsync({
          accountId: currentUserAccountId,
          content: replyText.trim(),
          parentPostId: post.id,
          visibility: "public",
          hashtags: extractHashtags(replyText),
          mentions: extractMentions(replyText),
          mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
        });
        notify.success("Reply posted!");
        setReplyText("");
        setShowReplyComposer(false);
        setShowReplies(true);
      } catch (error: any) {
        notify.error(error.message || "Failed to post reply");
      }
    },
    [createPostMutation, replyText, currentUserAccountId, post.id, notify]
  );

  return {
    blurbMeta,
    isOwnPost,
    canEdit,
    canDelete,
    visualizations,
    mediaAttachments,
    cleanPostContent,
    sportsBulletin,
    repostMediaAttachments,
    cleanRepostContent,
    showReplies,
    setShowReplies,
    threadQuery,
    showMoreOptions,
    setShowMoreOptions,
    showReplyComposer,
    setShowReplyComposer,
    replyText,
    setReplyText,
    showEditComposer,
    setShowEditComposer,
    editText,
    setEditText,
    showDeleteConfirm,
    setShowDeleteConfirm,
    showFlagDialog,
    setShowFlagDialog,
    flagReason,
    setFlagReason,
    showReactionsDialog,
    setShowReactionsDialog,
    lightboxMedia,
    setLightboxMedia,
    apiDiscordEmojis,
    createPostMutation,
    updatePostMutation,
    deletePostMutation,
    flagPostMutation,
    handlePin,
    handleBookmark,
    handleFlag,
    handleSubmitFlag,
    handleEdit,
    handleSubmitEdit,
    handleDelete,
    handleConfirmDelete,
    handleReply,
    handleSubmitReply,
    notify,
  };
}
