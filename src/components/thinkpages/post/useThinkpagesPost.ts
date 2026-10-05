"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { usePermissions } from "~/hooks/usePermissions";
import { extractHashtags, extractMentions } from "~/lib/utils";
import { escapeRegExp } from "~/lib/utils/escape-regexp";
import { parseSportsBulletin } from "~/lib/sports/feed-bulletins";
import { proxyDiscordUrl } from "./ThinkpagesPostUtils";

const IMAGE_URL_PATTERN = /https?:\/\/[^\s<"']+\.(?:png|jpg|jpeg|gif|webp)(?:\?[^\s<"']*)?/gi;

const extractImageUrls = (content?: string | null): string[] => [
  ...new Set((content ?? "").match(IMAGE_URL_PATTERN) ?? []),
];

/** Declared attachments plus bare image URLs found in the text, routed through the Discord proxy. */
function buildMediaAttachments(declared: unknown, urls: string[], prefix: string) {
  return [
    ...(Array.isArray(declared) ? declared : []),
    ...urls.map((url, i) => ({
      id: `${prefix}raw_${i}`,
      url,
      type: "image",
      filename: `${prefix}image_${i + 1}`,
    })),
  ].map((att: any) => ({ ...att, url: proxyDiscordUrl(att.url) }));
}

const stripUrls = (content: string, urls: string[]) =>
  urls
    .reduce((c, url) => c.replace(new RegExp(`\\s*${escapeRegExp(url)}\\s*`, "gi"), " "), content)
    .trim();

function parseVisualizations(raw: unknown) {
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw || [];
  } catch (e) {
    console.warn("Failed to parse visualizations:", e);
    return [];
  }
}

interface BlurbMeta {
  isBlurb: boolean;
  promptTitle?: string;
  promptSlug?: string;
  cleanContent: string;
}

function parseBlurbMeta(post: {
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
    } catch {
      // malformed hashtags JSON — show no hashtags
    }
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

function usePostPermissions(post: any, currentUserAccountId: string) {
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

  const canModify =
    isOwnPost ||
    currentUserRoleLevel <= 10 ||
    (currentUserRoleLevel === 20 && targetUserRoleLevel >= 20);

  return { isOwnPost, canModify };
}

function derivePostContent(post: any, blurbMeta: BlurbMeta) {
  const rawImageUrls = extractImageUrls(post.content);
  const repostImageUrls = extractImageUrls(post.repostOf?.content);
  const cleanPostContent = stripUrls(
    (blurbMeta.isBlurb ? blurbMeta.cleanContent : post.content) ?? "",
    rawImageUrls
  );

  return {
    visualizations: parseVisualizations(post.visualizations),
    mediaAttachments: buildMediaAttachments(post.mediaAttachments, rawImageUrls, ""),
    cleanPostContent,
    sportsBulletin: parseSportsBulletin(cleanPostContent),
    repostMediaAttachments: buildMediaAttachments(
      post.repostOf?.mediaAttachments,
      repostImageUrls,
      "repost_"
    ),
    cleanRepostContent: stripUrls(post.repostOf?.content ?? "", repostImageUrls),
  };
}

export function useThinkpagesPost(post: any, currentUserAccountId: string, showThread = false) {
  const notify = useNotify();
  const utils = api.useUtils();
  const blurbMeta = parseBlurbMeta(post);

  const { isOwnPost, canModify } = usePostPermissions(post, currentUserAccountId);

  const [showReplies, setShowReplies] = useState(false);
  const threadQuery = api.thinkpages.getPost.useQuery(
    { postId: post.id },
    { enabled: showReplies && showThread }
  );

  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [showEditComposer, setShowEditComposer] = useState(false);
  const [editText, setEditText] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [showReactionsDialog, setShowReactionsDialog] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string; id: string } | null>(null);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  useEffect(() => {
    if (!lightboxMedia) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxMedia(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxMedia]);

  useEffect(() => {
    if (!showMoreOptions) return;
    const handleClickOutside = () => setShowMoreOptions(false);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showMoreOptions]);

  const { data: discordEmojisData } = api.thinkpages.getDiscordEmojis.useQuery(
    {},
    { staleTime: 5 * 60_000 }
  );

  /** Refreshes the feeds and post queries a mutation on this post can affect. */
  const invalidatePost = ({ activities = false, parent = false } = {}) => {
    void utils.thinkpages.getFeed.invalidate();
    if (activities) {
      void utils.activities.getGlobalFeed.invalidate();
      void utils.activities.getFollowingFeed.invalidate();
    }
    if (post.account?.clerkUserId) {
      void utils.thinkpages.getPostsByClerkUserId.invalidate({
        clerkUserId: post.account.clerkUserId,
      });
    }
    if (parent && post.parentPostId) {
      void utils.thinkpages.getPost.invalidate({ postId: post.parentPostId });
    }
    void utils.thinkpages.getPost.invalidate({ postId: post.id });
  };

  const createPostMutation = api.thinkpages.createPost.useMutation({
    onSuccess: () => invalidatePost({ activities: true }),
  });
  const updatePostMutation = api.thinkpages.updatePost.useMutation({
    onSuccess: () => invalidatePost(),
  });
  const deletePostMutation = api.thinkpages.deletePost.useMutation({
    onSuccess: () => invalidatePost({ parent: true }),
  });
  const pinPostMutation = api.thinkpages.pinPost.useMutation({ onSuccess: () => invalidatePost() });
  const bookmarkPostMutation = api.thinkpages.bookmarkPost.useMutation({
    onSuccess: () => invalidatePost(),
  });
  const flagPostMutation = api.thinkpages.flagPost.useMutation();

  /** Runs a mutation, toasting the outcome; resolves true when it succeeded. */
  const attempt = async (action: () => Promise<unknown>, success: string, failure: string) => {
    try {
      await action();
      notify.success(success);
      return true;
    } catch (error: any) {
      notify.error(error.message || failure);
      return false;
    }
  };

  const closeMenuAnd = (open: () => void) => {
    open();
    setShowMoreOptions(false);
  };

  const handlePin = async () => {
    if (!currentUserAccountId) return;
    await attempt(
      () =>
        pinPostMutation.mutateAsync({
          postId: post.id,
          accountId: currentUserAccountId,
          pinned: !post.pinned,
        }),
      post.pinned ? "Post unpinned" : "Post pinned",
      "Failed to pin post"
    );
  };

  const handleBookmark = async () => {
    if (!currentUserAccountId) return;
    await attempt(
      () => bookmarkPostMutation.mutateAsync({ postId: post.id, bookmarked: true }),
      "Post bookmarked",
      "Failed to bookmark post"
    );
  };

  const handleFlag = () => {
    if (currentUserAccountId) closeMenuAnd(() => setShowFlagDialog(true));
  };

  const handleSubmitFlag = async () => {
    if (!flagReason.trim()) return;
    const flagged = await attempt(
      () =>
        flagPostMutation.mutateAsync({
          postId: post.id,
          reason: flagReason,
        }),
      "Post flagged",
      "Failed to flag post"
    );
    if (flagged) {
      setShowFlagDialog(false);
      setFlagReason("");
    }
  };

  const handleEdit = () => {
    if (!canModify) return;
    setEditText(post.content);
    closeMenuAnd(() => setShowEditComposer(true));
  };

  const handleSubmitEdit = async () => {
    if (!editText.trim() || editText === post.content) {
      setShowEditComposer(false);
      return;
    }
    const updated = await attempt(
      () => updatePostMutation.mutateAsync({ postId: post.id, content: editText }),
      "Post updated",
      "Failed to update post"
    );
    if (updated) setShowEditComposer(false);
  };

  const handleDelete = () => {
    if (canModify) closeMenuAnd(() => setShowDeleteConfirm(true));
  };

  const handleConfirmDelete = async () => {
    const deleted = await attempt(
      () => deletePostMutation.mutateAsync({ postId: post.id }),
      "Post deleted",
      "Failed to delete post"
    );
    if (deleted) setShowDeleteConfirm(false);
  };

  const handleReply = () => {
    setShowReplyComposer(!showReplyComposer);
    if (!showReplyComposer) setReplyText(`@${post.account?.username} `);
  };

  const handleSubmitReply = async (mediaUrls: string[] = []) => {
    if (!currentUserAccountId) {
      notify.error("Please select or create an account first to reply.");
      return;
    }
    if (!replyText.trim() && mediaUrls.length === 0) {
      notify.error("Please enter a reply or attach media.");
      return;
    }

    const posted = await attempt(
      () =>
        createPostMutation.mutateAsync({
          accountId: currentUserAccountId,
          content: replyText.trim(),
          parentPostId: post.id,
          visibility: "public",
          hashtags: extractHashtags(replyText),
          mentions: extractMentions(replyText),
          mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
        }),
      "Reply posted",
      "Failed to post reply"
    );
    if (posted) {
      setReplyText("");
      setShowReplyComposer(false);
      setShowReplies(true);
    }
  };

  return {
    blurbMeta,
    isOwnPost,
    canEdit: canModify,
    canDelete: canModify,
    ...derivePostContent(post, blurbMeta),
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
    apiDiscordEmojis: discordEmojisData?.emojis,
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
