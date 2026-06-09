// @ts-nocheck
"use client";

import React, { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "~/lib/utils";
import { useRelativeTime } from "~/hooks/useRelativeTime";
import Link from "next/link";
import { usePermissions } from "~/hooks/usePermissions";
import {
  MoreHorizontal,
  Pin,
  Bookmark,
  BookOpen,
  Flag,
  Smile,
  Angry,
  ThumbsUp,
  ThumbsDown,
  Flame,
  Heart,
  Edit,
  Trash2,
  Crown,
  Newspaper,
  Users,
  Repeat2,
  MessageCircle,
  ExternalLink,
  Eye,
  MessageSquare,
  TrendingUp,
  Globe,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  X,
  Copy,
  Briefcase,
  Activity,
} from "lucide-react";
import { withBasePath } from "~/lib/base-path";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";
import { Dialog, DialogContent } from "~/components/ui/dialog";
import { PostActions } from "./primitives/PostActions";
import { ReactionsDialog } from "./ReactionsDialog";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import {
  formatThinkpagesContentForDisplay,
  extractHashtags,
  extractMentions,
} from "~/lib/text-formatter";
import { WikiHtmlContent } from "~/components/wiki/WikiLinkPreview";

const DISCORD_CDN_HOSTNAMES = ["cdn.discordapp.com", "media.discordapp.net"];

function proxyDiscordUrl(url: string): string {
  if (!url) return "";
  try {
    const parsed = new URL(url as string);
    if (DISCORD_CDN_HOSTNAMES.includes(parsed.hostname)) {
      return withBasePath(`/api/proxy-discord-image?url=${encodeURIComponent(url as string)}`);
    }
  } catch {}
  if (url.startsWith("/")) {
    let cleanPath = url;
    if (cleanPath.startsWith("/projects/ixstates/")) {
      cleanPath = cleanPath.slice("/projects/ixstates".length);
    } else if (cleanPath.startsWith("/projects/ixstates")) {
      cleanPath = cleanPath.slice("/projects/ixstates".length);
    }
    return withBasePath(cleanPath);
  }
  return url;
}

interface ThinkpagesPostProps {
  post: any;
  currentUserAccountId: string;
  accounts?: any[];
  countryId?: string;
  isOwner?: boolean;
  onAccountSelect?: (account: any) => void;
  onAccountSettings?: (account: any) => void;
  onCreateAccount?: () => void;
  onLike?: (postId: string) => void;
  onRepost?: (postId: string) => void;
  onReply?: (postId: string) => void;
  onShare?: (postId: string) => void;
  onReaction?: (postId: string, reactionType: string) => void;
  onAccountClick?: (accountId: string) => void;
  compact?: boolean;
  showThread?: boolean;
}

function RelativeTimestamp({ timestamp }: { timestamp: Date | string | number }) {
  const relativeTime = useRelativeTime(timestamp);
  const date = new Date(timestamp);
  const now = new Date();
  const hoursDiff = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  return (
    <span
      className="text-muted-foreground cursor-help text-sm"
      title={`IxTime: ${date.toLocaleString()}`}
    >
      {hoursDiff > 24 ? date.toLocaleDateString() : relativeTime}
    </span>
  );
}

const ACCOUNT_TYPE_ICONS = {
  government: Crown,
  media: Newspaper,
  citizen: Users,
};

const ACCOUNT_TYPE_COLORS = {
  government: "text-amber-500 bg-amber-500/20",
  media: "text-blue-500 bg-blue-500/20",
  citizen: "text-green-500 bg-green-500/20",
};

const REACTION_ICONS: { [key: string]: React.ElementType } = {
  like: Heart,
  laugh: Smile,
  angry: Angry,
  fire: Flame,
  thumbsup: ThumbsUp,
  thumbsdown: ThumbsDown,
};

const DISCORD_EMOJI_REACTIONS = [
  { name: "ixnay", url: "https://cdn.discordapp.com/emojis/559232409451888640.png" },
  { name: "heky_boi", url: "https://cdn.discordapp.com/emojis/580813300733157376.png" },
  { name: "pog", url: "https://cdn.discordapp.com/emojis/739969522139209748.png" },
];

function getDiscordEmojiUrl(
  reactionType: string,
  apiEmojis?: Array<{ name: string; url: string }>
): string | null {
  if (!reactionType.startsWith("discord:")) return null;

  // Handle new format: discord:name:id
  const parts = reactionType.split(":");
  const emojiName = parts[1] || "";
  const emojiId = parts[2] || "";

  if (emojiId) {
    return `https://cdn.discordapp.com/emojis/${emojiId}.png`;
  }

  // Fallback for legacy formats
  const hardcoded = DISCORD_EMOJI_REACTIONS.find((e) => e.name === emojiName);
  if (hardcoded) return hardcoded.url;
  const fromApi = apiEmojis?.find((e) => e.name === emojiName);
  if (fromApi) return fromApi.url;
  return null;
}

// ---------------------------------------------------------------------------
// Blurb detection — parses structured [blurb:slug|title] prefix from content
// ---------------------------------------------------------------------------

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

  // Check hashtags for "blurb" marker
  let hashtags: string[] = [];
  if (Array.isArray(post.hashtags)) {
    hashtags = post.hashtags;
  } else if (typeof post.hashtags === "string") {
    try {
      hashtags = JSON.parse(post.hashtags);
    } catch {
      /* ignore */
    }
  }

  if (!hashtags.includes("blurb")) {
    return { isBlurb: false, cleanContent: content };
  }

  // Try to extract structured prefix: [blurb:slug|Title]\n\ncontent
  const match = content.match(/^\[blurb:([^\]|]+)\|([^\]]+)\]\n\n([\s\S]*)$/);
  if (match) {
    return {
      isBlurb: true,
      promptSlug: match[1],
      promptTitle: match[2],
      cleanContent: match[3] ?? "",
    };
  }

  // Fallback for old format: strip trailing "— Read full blurb →" text
  const cleaned = content.replace(/\n\n.*?— Read full blurb →.*$/, "").trim();
  return { isBlurb: true, cleanContent: cleaned };
}

const ThinkpagesPostComponent = ({
  post,
  currentUserAccountId = "",
  accounts = [],
  countryId = "",
  isOwner = false,
  onAccountSelect,
  onAccountSettings,
  onCreateAccount,
  onLike,
  onRepost,
  onReply,
  onShare,
  onReaction,
  onAccountClick,
  compact = false,
  showThread = false,
}: ThinkpagesPostProps) => {
  const notify = useNotify();
  const blurbMeta = parseBlurbMeta(post);

  const { user: currentUserData } = usePermissions();
  const currentUserRoleLevel = currentUserData?.role?.level ?? 100;

  const isOwnPost = currentUserAccountId === post.account.id;
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

  const visualizations = React.useMemo(() => {
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

  // Extract any raw image URLs embedded directly in the text body
  const rawImageUrls = React.useMemo(() => {
    const content = post.content ?? "";
    const imageRegex = /https?:\/\/[^\s<"']+\.(?:png|jpg|jpeg|gif|webp)(?:\?[^\s<"']*)?/gi;
    const matches = content.match(imageRegex);
    return matches ? Array.from(new Set(matches)) : [];
  }, [post.content]);

  const mediaAttachments = React.useMemo(() => {
    const raw = [
      ...(post.mediaAttachments ?? []),
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

  // Remove raw image URLs from the content string we pass to formatters
  const cleanPostContent = React.useMemo(() => {
    let c = blurbMeta.isBlurb ? blurbMeta.cleanContent : post.content;
    if (!c) return "";
    rawImageUrls.forEach((url: string) => {
      const escapedUrl = url.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const reg = new RegExp(`\\s*${escapedUrl}\\s*`, "gi");
      c = c.replace(reg, " ");
    });
    return c.trim();
  }, [blurbMeta.isBlurb, blurbMeta.cleanContent, post.content, rawImageUrls]);

  const repostImageUrls = React.useMemo(() => {
    const content = post.repostOf?.content ?? "";
    const imageRegex = /https?:\/\/[^\s<"']+\.(?:png|jpg|jpeg|gif|webp)(?:\?[^\s<"']*)?/gi;
    const matches = content.match(imageRegex);
    return matches ? Array.from(new Set(matches)) : [];
  }, [post.repostOf?.content]);

  const repostMediaAttachments = React.useMemo(() => {
    const raw = [
      ...(post.repostOf?.mediaAttachments ?? []),
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

  const cleanRepostContent = React.useMemo(() => {
    let c = post.repostOf?.content;
    if (!c) return "";
    repostImageUrls.forEach((url: string) => {
      const escapedUrl = url.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const reg = new RegExp(`\\s*${escapedUrl}\\s*`, "gi");
      c = c.replace(reg, " ");
    });
    return c.trim();
  }, [post.repostOf?.content, repostImageUrls]);

  const [showReplies, setShowReplies] = useState(false);
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

  // Close lightbox on Escape key
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

  // Close more options when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMoreOptions) {
        setShowMoreOptions(false);
      }
    };

    if (showMoreOptions) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
    return;
  }, [showMoreOptions]);

  const addReactionMutation = api.thinkpages.addReaction.useMutation();
  const removeReactionMutation = api.thinkpages.removeReaction.useMutation();
  const createPostMutation = api.thinkpages.createPost.useMutation();
  const updatePostMutation = api.thinkpages.updatePost.useMutation();
  const deletePostMutation = api.thinkpages.deletePost.useMutation();
  const pinPostMutation = api.thinkpages.pinPost.useMutation();
  const bookmarkPostMutation = api.thinkpages.bookmarkPost.useMutation();
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
  }, [pinPostMutation, post.id, post.pinned, currentUserAccountId]);

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
  }, [bookmarkPostMutation, post.id, currentUserAccountId]);

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
  }, [flagPostMutation, post.id, currentUserAccountId, flagReason]);

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
  }, [updatePostMutation, post.id, editText, post.content, currentUserAccountId]);

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
  }, [deletePostMutation, post.id, currentUserAccountId]);

  const handleReply = useCallback(() => {
    setShowReplyComposer(!showReplyComposer);
    if (!showReplyComposer) {
      // Enhanced @ mention with proper formatting
      const mentionText = `@${post.account.username} `;
      setReplyText(mentionText);
      // Auto-focus the reply input after a short delay
      setTimeout(() => {
        const replyInput = document.querySelector("[data-reply-input]") as HTMLTextAreaElement;
        if (replyInput) {
          replyInput.focus();
          replyInput.setSelectionRange(mentionText.length, mentionText.length);
        }
      }, 100);
    }
  }, [showReplyComposer, post.account.username]);

  const handleSubmitReply = useCallback(async () => {
    if (!replyText.trim() || !currentUserAccountId) return;

    try {
      // Enhanced reply with hashtag and mention extraction
      await createPostMutation.mutateAsync({
        accountId: currentUserAccountId,
        content: replyText,
        parentPostId: post.id,
        visibility: "public",
        hashtags: extractHashtags(replyText),
        mentions: extractMentions(replyText),
      });
      notify.success("Reply posted!");
      setReplyText("");
      setShowReplyComposer(false);
    } catch (error: any) {
      notify.error(error.message || "Failed to post reply");
    }
  }, [createPostMutation, replyText, currentUserAccountId, post.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "glass-hierarchy-child hover:glass-hierarchy-interactive shadow-sm transition-all duration-300 hover:bg-white/5 dark:hover:bg-white/5",
        compact ? "p-3" : "p-4",
        post.pinned &&
          "border-amber-500/30 bg-amber-500/5 dark:border-amber-500/20 dark:bg-amber-500/5"
      )}
    >
      {post.pinned && (
        <div className="mb-3 flex items-center gap-2 text-sm text-amber-500">
          <Pin className="h-4 w-4" />
          <span>Pinned Post</span>
        </div>
      )}

      {post.postType === "repost" && (
        <div className="mb-3 flex items-center gap-2 text-sm text-green-500">
          <Repeat2 className="h-4 w-4" />
          <span>@{post.account.username} reposted</span>
        </div>
      )}

      {post.postType === "reply" && post.parentPost && (
        <div className="mb-3">
          <div className="mb-2 flex items-center gap-2 text-sm text-blue-500">
            <MessageCircle className="h-4 w-4" />
            <span>Replying to @{post.parentPost.account.username}</span>
          </div>
          {/* Twitter-style parent post context */}
          <div className="ml-4 space-y-2 border-l-2 border-blue-500/30 pl-4">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={proxyDiscordUrl(post.parentPost.account.profileImageUrl)} />
                <AvatarFallback
                  className={`text-xs font-semibold ${ACCOUNT_TYPE_COLORS[post.parentPost.account.accountType as keyof typeof ACCOUNT_TYPE_COLORS] || "bg-gray-500/20 text-gray-500"}`}
                >
                  {post.parentPost.account.displayName
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-semibold">{post.parentPost.account.displayName}</span>
              <span className="text-muted-foreground text-xs">
                @{post.parentPost.account.username}
              </span>
            </div>
            <WikiHtmlContent
              html={formatThinkpagesContentForDisplay(post.parentPost.content)}
              className="text-muted-foreground line-clamp-3 text-sm"
            />
          </div>
        </div>
      )}

      {blurbMeta.isBlurb && (
        <div className="mb-3 flex items-center gap-2 text-sm text-purple-400">
          <BookOpen className="h-4 w-4" />
          <span className="font-medium">{blurbMeta.promptTitle ?? "Topic Tuesday"}</span>
          {blurbMeta.promptSlug && (
            <Link
              href={withBasePath(`/blurbs/${blurbMeta.promptSlug}`)}
              className="text-purple-400/70 transition-colors hover:text-purple-300"
            >
              View prompt →
            </Link>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={() => onAccountClick?.(post.account.id)} className="shrink-0">
          <Avatar className={compact ? "h-8 w-8" : "h-10 w-10"}>
            <AvatarImage src={proxyDiscordUrl(post.account.profileImageUrl)} />
            <AvatarFallback
              className={`font-semibold ${ACCOUNT_TYPE_COLORS[post.account.accountType as keyof typeof ACCOUNT_TYPE_COLORS] || "bg-gray-500/20 text-gray-500"}`}
            >
              {post.account.displayName
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </button>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <button
              onClick={() => onAccountClick?.(post.account.id)}
              className="font-semibold hover:underline"
            >
              {post.account.displayName}
            </button>

            {post.account.verified && (
              <span
                className="inline-flex h-4 w-4 items-center justify-center text-sm leading-none"
                title="Verified"
              >
                ✅
              </span>
            )}

            {post.account.bio?.startsWith("Former Nation") && (
              <Badge
                variant="secondary"
                className="border-gray-500/30 bg-gray-500/20 text-xs text-gray-400"
              >
                Former Nation
              </Badge>
            )}

            <div
              className={`rounded p-1 ${ACCOUNT_TYPE_COLORS[post.account.accountType as keyof typeof ACCOUNT_TYPE_COLORS] || "bg-gray-500/20 text-gray-500"}`}
            >
              {React.createElement(
                ACCOUNT_TYPE_ICONS[post.account.accountType as keyof typeof ACCOUNT_TYPE_ICONS] ||
                  Users,
                { className: "h-3 w-3" }
              )}
            </div>

            <span className="text-muted-foreground text-sm">@{post.account.username}</span>

            <span className="text-muted-foreground text-sm">·</span>

            <RelativeTimestamp timestamp={post.timestamp} />

            {post.trending && (
              <Badge variant="secondary" className="bg-orange-500/20 text-xs text-orange-400">
                Trending
              </Badge>
            )}
          </div>

          <div className={cn("mb-3", compact ? "text-sm" : "text-base")}>
            {post.repostOf ? (
              <Card className="rounded-lg border-green-500/30 bg-green-500/10 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={proxyDiscordUrl(post.repostOf.account.profileImageUrl)} />
                    <AvatarFallback className="text-xs font-semibold">
                      {post.repostOf.account.displayName
                        ?.split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-semibold">{post.repostOf.account.displayName}</span>
                  <span className="text-muted-foreground text-xs">
                    @{post.repostOf.account.username}
                  </span>
                </div>
                <WikiHtmlContent html={formatThinkpagesContentForDisplay(cleanRepostContent)} />
                {repostMediaAttachments && repostMediaAttachments.length > 0 && (
                  <div
                    className={cn(
                      "border-border/50 mt-2 overflow-hidden rounded-lg border shadow-sm dark:border-white/10",
                      repostMediaAttachments.length === 1 && "max-w-md",
                      repostMediaAttachments.length > 1 && "grid grid-cols-2 gap-0.5"
                    )}
                  >
                    {repostMediaAttachments.map((media: any, index: number) => {
                      const isSingle = repostMediaAttachments.length === 1;
                      return (
                        <div
                          key={media.id || index}
                          className={cn(
                            "relative flex items-center justify-center overflow-hidden bg-neutral-900/40",
                            isSingle && "aspect-[16/10] max-h-[220px] w-full",
                            repostMediaAttachments.length === 2 && "aspect-square",
                            repostMediaAttachments.length === 3 && index === 0
                              ? "col-span-2 aspect-[16/10]"
                              : "aspect-square",
                            repostMediaAttachments.length === 4 && "aspect-square"
                          )}
                        >
                          <motion.img
                            layoutId={`repost-${post.id}-${media.id || index}`}
                            src={proxyDiscordUrl(media.url)}
                            alt={media.filename || `Image ${index + 1}`}
                            className="h-full w-full cursor-pointer object-cover"
                            whileHover={{ scale: 1.02, opacity: 0.95 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setLightboxMedia({
                                url: media.url,
                                id: `repost-${post.id}-${media.id || index}`,
                              });
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            ) : (
              <WikiHtmlContent html={formatThinkpagesContentForDisplay(cleanPostContent)} />
            )}
          </div>

          {/* Media Attachments */}
          {mediaAttachments && mediaAttachments.length > 0 && (
            <div
              className={cn(
                "border-border/50 mt-3 overflow-hidden rounded-xl border shadow-md dark:border-white/10",
                mediaAttachments.length === 1 && "max-w-xl",
                mediaAttachments.length > 1 && "grid grid-cols-2 gap-1"
              )}
            >
              {mediaAttachments.map((media: any, index: number) => {
                const isSingle = mediaAttachments.length === 1;
                return (
                  <div
                    key={media.id || index}
                    className={cn(
                      "relative flex items-center justify-center overflow-hidden bg-neutral-900/40",
                      isSingle && "aspect-[16/10] max-h-[360px] w-full",
                      mediaAttachments.length === 2 && "aspect-square",
                      mediaAttachments.length === 3 && index === 0
                        ? "col-span-2 aspect-[16/10]"
                        : "aspect-square",
                      mediaAttachments.length === 4 && "aspect-square"
                    )}
                  >
                    <motion.img
                      layoutId={`post-${post.id}-${media.id || index}`}
                      src={proxyDiscordUrl(media.url)}
                      alt={media.filename || `Image ${index + 1}`}
                      className="h-full w-full cursor-pointer object-cover"
                      whileHover={{ scale: 1.02, opacity: 0.95 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxMedia({
                          url: media.url,
                          id: `post-${post.id}-${media.id || index}`,
                        });
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Embedded Visualizations */}
          {visualizations && visualizations.length > 0 && (
            <div className="mt-3 space-y-2.5">
              {visualizations.map((viz: any, index: number) => (
                <PostVisualizationRenderer
                  key={viz.id || index}
                  viz={viz}
                  countryId={post.account.countryId || post.account.country?.id || ""}
                />
              ))}
            </div>
          )}

          {/* Inline Link Previews (Wiki / Forum) */}
          {(() => {
            const content = post.content ?? "";
            const matchedLink = (() => {
              const wikiMatch = content.match(
                /(?:https?:\/\/)?(?:www\.)?(ixwiki\.com|iiwiki\.com)\/wiki\/([^#?\s)]+)/i
              );
              if (wikiMatch) return wikiMatch[0];
              const forumMatch = content.match(
                /(?:https?:\/\/)?(?:www\.)?forum\.ixwiki\.com\/threads\/(?:[^/]*\.)?(\d+)/i
              );
              if (forumMatch) return forumMatch[0];
              return null;
            })();
            if (matchedLink) {
              return <PostInlineLinkPreview url={matchedLink} />;
            }
            return null;
          })()}

          {post.hashtags && post.hashtags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1">
              {post.hashtags.map((hashtag: string, index: number) => (
                <button key={index} className="text-sm text-blue-500 hover:underline">
                  #{hashtag}
                </button>
              ))}
            </div>
          )}

          {/* Debug PostActions props */}
          {(() => {
            const isLikedValue = post.reactions?.some(
              (r: any) => r.accountId === currentUserAccountId && r.reactionType === "like"
            );
            const reactionCountsValue = (() => {
              try {
                if (typeof post.reactionCounts === "string") {
                  return JSON.parse(post.reactionCounts);
                }
                return post.reactionCounts || {};
              } catch (error) {
                console.warn("Failed to parse reactionCounts:", error);
                return {};
              }
            })();

            console.log("📤 ThinkpagesPost passing props to PostActions:", {
              postId: post.id,
              currentUserAccountId,
              isLiked: isLikedValue,
              likeCount: post.likeCount,
              reactionsCount: post.reactions?.length || 0,
              reactions: post.reactions,
              reactionCounts: reactionCountsValue,
              hasOnLike: !!onLike,
              hasOnReaction: !!onReaction,
              postAccountId: post.account?.id,
              postAccountUsername: post.account?.username,
            });

            return null;
          })()}

          {/* Reactions row above actions */}
          {(() => {
            try {
              const reactionCounts =
                typeof post.reactionCounts === "string"
                  ? JSON.parse(post.reactionCounts)
                  : post.reactionCounts || {};

              if (reactionCounts && Object.keys(reactionCounts).length > 0) {
                let hasVisible = false;
                for (const count of Object.values(reactionCounts)) {
                  if ((count as number) > 0) hasVisible = true;
                }
                if (!hasVisible) return null;

                return (
                  <div className="mb-2 flex w-full flex-wrap items-center gap-1.5">
                    {Object.entries(reactionCounts).map(([type, count]) => {
                      if ((count as number) <= 0) return null;

                      const discordUrl = getDiscordEmojiUrl(type, apiDiscordEmojis);
                      const isDiscordImported =
                        !!post.discordMsgId ||
                        !!post.content?.includes("[DiscordMsg:") ||
                        Object.keys(reactionCounts).some((k) => k.startsWith("discord:"));

                      const pillContent = (
                        <div
                          key={type}
                          className={cn(
                            "bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted hover:border-border flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs shadow-xs transition-all duration-200 hover:scale-[1.03] dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 dark:hover:bg-white/10"
                          )}
                          onClick={() => setShowReactionsDialog(true)}
                        >
                          {discordUrl ? (
                            <img
                              src={discordUrl}
                              alt={type.split(":")[1] || type}
                              className="h-3.5 w-3.5 object-contain"
                            />
                          ) : REACTION_ICONS[type] ? (
                            React.createElement(REACTION_ICONS[type]!, {
                              className: "h-3.5 w-3.5 text-purple-400",
                            })
                          ) : (
                            <span className="text-sm">{type}</span>
                          )}
                          <span className="font-medium">{count as number}</span>
                        </div>
                      );

                      return pillContent;
                    })}
                  </div>
                );
              }
            } catch (error) {
              console.warn("Failed to parse reactionCounts in pills row:", error);
            }
            return null;
          })()}

          <PostActions
            postId={post.id}
            currentUserAccountId={currentUserAccountId}
            post={post}
            accounts={accounts}
            countryId={countryId}
            isOwner={isOwner}
            onAccountSelect={onAccountSelect}
            onAccountSettings={onAccountSettings}
            onCreateAccount={onCreateAccount}
            isLiked={post.reactions?.some(
              (r: any) => r.accountId === currentUserAccountId && r.reactionType === "like"
            )}
            isReposted={
              post.reposts?.some((r: any) => r.accountId === currentUserAccountId) ?? false
            }
            likeCount={post.likeCount}
            repostCount={post.repostCount}
            replyCount={post.replyCount}
            reactions={post.reactions || []}
            reactionCounts={(() => {
              try {
                if (typeof post.reactionCounts === "string") {
                  return JSON.parse(post.reactionCounts);
                }
                return post.reactionCounts || {};
              } catch (error) {
                console.warn("Failed to parse reactionCounts:", error);
                return {};
              }
            })()}
            onLike={onLike}
            onRepost={onRepost}
            onReply={() => handleReply()}
            onShare={() => {
              const postUrl = `${window.location.origin}/thinkpages/post/${post.id}`;
              if (navigator.share) {
                navigator
                  .share({
                    title: `Post by @${post.account.username}`,
                    text: post.content.substring(0, 100),
                    url: postUrl,
                  })
                  .catch(() => {
                    // Fallback to clipboard if share fails
                    navigator.clipboard.writeText(postUrl);
                    notify.success("Post link copied to clipboard!");
                  });
              } else {
                navigator.clipboard.writeText(postUrl);
                notify.success("Post link copied to clipboard!");
              }
              onShare?.(post.id);
            }}
            onReaction={onReaction}
            showCounts={true}
            size="md"
          />

          <div className="flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="text-muted-foreground hover:text-foreground rounded-full p-2 transition-colors hover:bg-white/10"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {isOwnPost && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePin();
                    }}
                  >
                    <Pin className="h-4 w-4" />
                    {post.pinned ? "Unpin" : "Pin"}
                  </DropdownMenuItem>
                )}
                {canEdit && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit();
                    }}
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete();
                    }}
                    variant="destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
                {(isOwnPost || canEdit || canDelete) && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBookmark();
                  }}
                >
                  <Bookmark className="h-4 w-4" />
                  Bookmark
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFlag();
                  }}
                >
                  <Flag className="h-4 w-4" />
                  Flag
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Edit Composer */}
          <AnimatePresence>
            {showEditComposer && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 rounded-lg border border-amber-500/50 bg-amber-500/5 p-3"
              >
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={proxyDiscordUrl(post.account.profileImageUrl)} />
                    <AvatarFallback
                      className={`font-semibold ${ACCOUNT_TYPE_COLORS[post.account.accountType as keyof typeof ACCOUNT_TYPE_COLORS] || "bg-gray-500/20 text-gray-500"}`}
                    >
                      {post.account.displayName
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <div className="mb-2 flex items-center gap-2 text-amber-600">
                      <Edit className="h-4 w-4" />
                      <span className="text-sm font-medium">Editing post</span>
                    </div>
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      placeholder="Edit your post..."
                      className="min-h-[80px] resize-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          handleSubmitEdit();
                        }
                        if (e.key === "Escape") {
                          setShowEditComposer(false);
                        }
                      }}
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setShowEditComposer(false)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSubmitEdit}
                        disabled={
                          !editText.trim() ||
                          editText === post.content ||
                          updatePostMutation.isPending
                        }
                        className="bg-amber-600 hover:bg-amber-700"
                      >
                        {updatePostMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reply Composer */}
          <AnimatePresence>
            {showReplyComposer && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="border-border bg-muted/30 mt-3 rounded-lg border p-3"
              >
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>You</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <Textarea
                      data-reply-input
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={`Reply to @${post.account.username}`}
                      className="min-h-[60px] resize-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          handleSubmitReply();
                        }
                      }}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setShowReplyComposer(false)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSubmitReply}
                        disabled={!replyText.trim() || createPostMutation.isPending}
                      >
                        {createPostMutation.isPending ? "Replying..." : "Reply"}
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {showThread && post.replyCount > 0 && (
            <button
              onClick={() => setShowReplies(!showReplies)}
              className="mt-2 text-sm text-blue-500 hover:underline"
            >
              {showReplies ? "Hide" : "Show"} {post.replyCount}{" "}
              {post.replyCount === 1 ? "reply" : "replies"}
            </button>
          )}

          {/* Delete Confirmation Dialog */}
          <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
            <DialogContent
              className="border-border bg-background max-w-md p-6"
              showCloseButton={false}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-red-500/20 p-2">
                  <Trash2 className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-foreground font-semibold">Delete Post</h3>
                  <p className="text-muted-foreground text-sm">This action cannot be undone.</p>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleConfirmDelete}
                  disabled={deletePostMutation.isPending}
                >
                  {deletePostMutation.isPending ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Flag Dialog */}
          <Dialog
            open={showFlagDialog}
            onOpenChange={(open) => {
              setShowFlagDialog(open);
              if (!open) setFlagReason("");
            }}
          >
            <DialogContent
              className="border-border bg-background max-w-md p-6"
              showCloseButton={false}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-orange-500/20 p-2">
                  <Flag className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-foreground font-semibold">Flag Post</h3>
                  <p className="text-muted-foreground text-sm">Help us understand what's wrong.</p>
                </div>
              </div>
              <Textarea
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="Why are you flagging this post?"
                className="mt-4"
                autoFocus
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowFlagDialog(false);
                    setFlagReason("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmitFlag}
                  disabled={!flagReason.trim() || flagPostMutation.isPending}
                  className="bg-orange-600 text-white hover:bg-orange-700"
                >
                  {flagPostMutation.isPending ? "Flagging..." : "Flag Post"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Reactions Dialog */}
          <ReactionsDialog
            postId={post.id}
            isOpen={showReactionsDialog}
            onClose={() => setShowReactionsDialog(false)}
            onAccountClick={onAccountClick}
            discordMsgId={(() => {
              const match = post.content?.match(/\[DiscordMsg:(\d+)\]/);
              return match ? match[1] : null;
            })()}
          />
        </div>
      </div>
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {lightboxMedia && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-0 z-[100100] flex flex-col items-center justify-center bg-black/75 p-4 backdrop-blur-md"
                onClick={() => setLightboxMedia(null)}
              >
                {/* iOS-Style Content Wrapper */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 15 }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    y: 0,
                    transition: { type: "spring", stiffness: 350, damping: 25 },
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="relative z-10 flex max-w-[85vw] flex-col items-center gap-4 sm:max-w-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Image Card with Thick Glass Border */}
                  <div className="rounded-3xl border-2 border-white/20 bg-white/[0.03] shadow-2xl backdrop-blur-xl">
                    <motion.img
                      layoutId={lightboxMedia.id}
                      src={lightboxMedia.url}
                      alt="Expanded view"
                      className="max-h-[65vh] w-full rounded-[22px] object-contain"
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    />
                  </div>

                  {/* iOS-Style Context Actions Row */}
                  <div className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-black/40 p-1.5 shadow-lg backdrop-blur-xl">
                    <button
                      onClick={() => window.open(lightboxMedia.url, "_blank")}
                      className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-white/10 active:scale-95"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open Original
                    </button>
                    <div className="h-4 w-px bg-white/10" />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(lightboxMedia.url);
                        notify.success("Image URL copied to clipboard!");
                      }}
                      className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-white/10 active:scale-95"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy Link
                    </button>
                    <div className="h-4 w-px bg-white/10" />
                    <button
                      onClick={() => setLightboxMedia(null)}
                      className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-white/20 active:scale-95"
                    >
                      <X className="h-3.5 w-3.5" />
                      Close
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </motion.div>
  );
};

// Memoize the component for better performance in virtualized lists
export const ThinkpagesPost = React.memo(ThinkpagesPostComponent, (prevProps, nextProps) => {
  // Custom comparison function to optimize re-renders
  return (
    prevProps.post.id === nextProps.post.id &&
    prevProps.currentUserAccountId === nextProps.currentUserAccountId &&
    prevProps.post.updatedAt === nextProps.post.updatedAt &&
    JSON.stringify(prevProps.post.reactionCounts) ===
      JSON.stringify(nextProps.post.reactionCounts) &&
    prevProps.post._count?.replies === nextProps.post._count?.replies
  );
});

ThinkpagesPost.displayName = "ThinkpagesPost";

// ──────────────────────────────────────────────
// Premium Embedded Live Data Visualization Renderer
// ──────────────────────────────────────────────

interface PostVisualizationRendererProps {
  viz: {
    type:
      | "economic_chart"
      | "diplomatic_map"
      | "trade_flow"
      | "gdp_growth"
      | "demographics"
      | "budget_debt"
      | "labor_market"
      | "national_vitality";
    title: string;
    config?: any;
  };
  countryId: string;
}

function PostVisualizationRenderer({ viz, countryId }: PostVisualizationRendererProps) {
  const { type, title } = viz;

  // Query only what is needed based on visualization type
  const economicQuery = api.countries.getByIdWithEconomicData.useQuery(
    { id: countryId },
    {
      enabled:
        !!countryId &&
        (type === "gdp_growth" ||
          type === "demographics" ||
          type === "budget_debt" ||
          type === "economic_chart" ||
          type === "labor_market"),
      staleTime: 5 * 60_000,
    }
  );

  const historyQuery = api.historical.getCountryHistory.useQuery(
    { countryId, limit: 10 },
    {
      enabled: !!countryId && type === "economic_chart",
      staleTime: 5 * 60_000,
    }
  );

  const diplomaticQuery = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    {
      enabled: !!countryId && type === "diplomatic_map",
      staleTime: 5 * 60_000,
    }
  );

  const tradeQuery = api.countries.getTradeData.useQuery(
    { countryId },
    {
      enabled: !!countryId && type === "trade_flow",
      staleTime: 5 * 60_000,
    }
  );

  const vitalityQuery = api.countries.getActivityRingsData.useQuery(
    { countryId },
    {
      enabled: !!countryId && type === "national_vitality",
      staleTime: 5 * 60_000,
    }
  );

  const isLoading =
    economicQuery.isLoading ||
    historyQuery.isLoading ||
    diplomaticQuery.isLoading ||
    tradeQuery.isLoading ||
    vitalityQuery.isLoading;

  if (isLoading) {
    return (
      <div className="flex h-24 w-full items-center justify-center rounded-xl border border-white/5 bg-white/[0.02]">
        <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
      </div>
    );
  }

  // Format Helper for large values
  const formatMoney = (val: number) => {
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toLocaleString()}`;
  };

  // 1. GDP Growth Trajectory
  if (type === "economic_chart") {
    let rawHistory = historyQuery.data || [];
    if (rawHistory.length === 0 && economicQuery.data?.historical) {
      rawHistory = economicQuery.data.historical.map((h: any) => ({
        ixTimeTimestamp: new Date(h.year, 0, 1),
        totalGdp: h.gdp,
        population: h.population,
      }));
    }

    if (rawHistory.length === 0) {
      return (
        <div className="text-muted-foreground rounded-xl border border-white/10 bg-white/5 p-3.5 text-center text-xs">
          No historical GDP data available
        </div>
      );
    }

    const maxGdp = Math.max(...rawHistory.map((h: any) => h.totalGdp || 0));

    return (
      <Card className="glass-hierarchy-child border-blue-500/10 bg-blue-500/[0.02] p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <TrendingUp className="h-3.5 w-3.5 text-green-400" />
            {title}
          </span>
          <span className="text-muted-foreground text-[10px]">Historical Trajectory</span>
        </div>
        <div className="mt-2 space-y-1.5">
          {rawHistory.slice(-4).map((h: any, idx: number) => {
            const yearStr = h.ixTimeTimestamp
              ? new Date(h.ixTimeTimestamp).getFullYear().toString()
              : `Y${idx + 1}`;
            const gdpVal = h.totalGdp || 0;
            const pct = maxGdp > 0 ? (gdpVal / maxGdp) * 100 : 0;
            return (
              <div key={idx} className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground w-10 text-left">{yearStr}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-16 text-right font-medium text-white">
                  {formatMoney(gdpVal)}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  // 2. Diplomatic Relations Map
  if (type === "diplomatic_map") {
    const relations = diplomaticQuery.data || [];
    if (relations.length === 0) {
      return (
        <Card className="glass-hierarchy-child text-muted-foreground border-blue-500/10 bg-blue-500/[0.02] p-3.5 text-center text-xs">
          No active diplomatic relationships
        </Card>
      );
    }

    return (
      <Card className="glass-hierarchy-child border-purple-500/10 bg-purple-500/[0.02] p-3.5">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <Globe className="h-3.5 w-3.5 text-purple-400" />
            {title}
          </span>
          <span className="text-muted-foreground text-[10px]">{relations.length} Connections</span>
        </div>
        <div className="grid gap-2">
          {relations.slice(0, 3).map((rel: any) => {
            const relType = rel.relationship?.toLowerCase() || "neutral";
            const colorMap: Record<string, string> = {
              alliance: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
              trade: "text-blue-400 bg-blue-500/10 border-blue-500/20",
              tension: "text-red-400 bg-red-500/10 border-red-500/20",
              neutral: "text-neutral-400 bg-neutral-500/10 border-neutral-500/20",
            };
            return (
              <div
                key={rel.id}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  {rel.targetCountryFlag ? (
                    <img
                      src={rel.targetCountryFlag}
                      alt=""
                      className="h-4 w-6 rounded-sm border border-white/10 object-cover shadow-xs"
                    />
                  ) : (
                    <div className="flex h-4 w-6 items-center justify-center rounded-sm bg-white/10 text-[8px]">
                      {rel.targetCountryName?.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="max-w-[120px] truncate font-medium text-white">
                    {rel.targetCountryName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`px-1.5 py-0 text-[9px] font-bold tracking-wider uppercase ${colorMap[relType] || colorMap.neutral}`}
                  >
                    {rel.relationship || "Neutral"}
                  </Badge>
                  <div className="flex w-16 items-center gap-1.5">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full bg-purple-500"
                        style={{ width: `${rel.strength || 50}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground w-6 text-right text-[10px] font-medium">
                      {rel.strength || 50}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  // 3. Trade Flow Analysis
  if (type === "trade_flow") {
    const trade = tradeQuery.data;
    if (!trade) {
      return (
        <Card className="glass-hierarchy-child text-muted-foreground border-orange-500/10 bg-orange-500/[0.02] p-3.5 text-center text-xs">
          No trade statistics available
        </Card>
      );
    }

    const exportsPct = trade.totalVolume > 0 ? (trade.exports / trade.totalVolume) * 100 : 50;
    const importsPct = trade.totalVolume > 0 ? (trade.imports / trade.totalVolume) * 100 : 50;

    return (
      <Card className="glass-hierarchy-child border-orange-500/10 bg-orange-500/[0.02] p-3.5">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <BarChart3 className="h-3.5 w-3.5 text-orange-400" />
            {title}
          </span>
          <span className="text-muted-foreground text-[10px]">Trade Flows</span>
        </div>
        <div className="mb-2.5 grid grid-cols-3 gap-3">
          <div className="rounded border border-white/5 bg-white/[0.02] p-1.5 text-center">
            <div className="text-muted-foreground text-[10px]">Total Volume</div>
            <div className="mt-0.5 text-xs font-bold text-white">
              {formatMoney(trade.totalVolume)}
            </div>
          </div>
          <div className="rounded border border-white/5 bg-white/[0.02] p-1.5 text-center">
            <div className="text-muted-foreground text-[10px]">Exports</div>
            <div className="mt-0.5 text-xs font-bold text-emerald-400">
              {formatMoney(trade.exports)}
            </div>
          </div>
          <div className="rounded border border-white/5 bg-white/[0.02] p-1.5 text-center">
            <div className="text-muted-foreground text-[10px]">Imports</div>
            <div className="mt-0.5 text-xs font-bold text-red-400">
              {formatMoney(trade.imports)}
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="text-muted-foreground flex justify-between text-[10px]">
            <span>Exports ({exportsPct.toFixed(0)}%)</span>
            <span>Imports ({importsPct.toFixed(0)}%)</span>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/5">
            <div className="h-full bg-emerald-500" style={{ width: `${exportsPct}%` }} />
            <div className="h-full bg-red-500" style={{ width: `${importsPct}%` }} />
          </div>
        </div>
      </Card>
    );
  }

  // 4. Economic Performance Overview (GDP stats)
  if (type === "gdp_growth") {
    const econ = economicQuery.data;
    if (!econ) {
      return (
        <Card className="glass-hierarchy-child text-muted-foreground border-emerald-500/10 bg-emerald-500/[0.02] p-3.5 text-center text-xs">
          No economic metrics available
        </Card>
      );
    }

    const growthRate = econ.calculatedStats?.gdpGrowth || 0;
    const gdpVal = econ.currentTotalGdp || econ.gdp || 0;
    const gdppcVal = econ.currentGdpPerCapita || econ.gdpPerCapita || 0;

    return (
      <Card className="glass-hierarchy-child border-emerald-500/10 bg-emerald-500/[0.02] p-3.5">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            {title}
          </span>
          <span className="text-muted-foreground text-[10px]">Key Metrics</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
            <div className="text-muted-foreground text-[10px]">Total GDP</div>
            <div className="mt-0.5 text-sm font-bold text-white">{formatMoney(gdpVal)}</div>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
            <div className="text-muted-foreground text-[10px]">GDP Per Capita</div>
            <div className="mt-0.5 text-sm font-bold text-white">
              ${Math.round(gdppcVal).toLocaleString()}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-2">
            <div>
              <div className="text-muted-foreground text-[10px]">Annual Growth</div>
              <div
                className={cn(
                  "mt-0.5 text-sm font-bold",
                  growthRate >= 0 ? "text-emerald-400" : "text-red-400"
                )}
              >
                {growthRate >= 0 ? "+" : ""}
                {(growthRate * 100).toFixed(1)}%
              </div>
            </div>
            {growthRate >= 0 ? (
              <ArrowUpRight className="h-5 w-5 shrink-0 text-emerald-400" />
            ) : (
              <ArrowDownRight className="h-5 w-5 shrink-0 text-red-400" />
            )}
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
            <div className="text-muted-foreground text-[10px]">Economic Tier</div>
            <Badge
              variant="secondary"
              className="mt-1 border border-emerald-500/20 bg-emerald-500/10 text-[9px] font-bold tracking-wider text-emerald-400 uppercase"
            >
              {econ.economicTier || "Developed"}
            </Badge>
          </div>
        </div>
      </Card>
    );
  }

  // 5. Demographics Profile
  if (type === "demographics") {
    const econ = economicQuery.data;
    if (!econ) {
      return (
        <Card className="glass-hierarchy-child text-muted-foreground border-green-500/10 bg-green-500/[0.02] p-3.5 text-center text-xs">
          No demographics statistics available
        </Card>
      );
    }

    const urbanPct = econ.urbanPopulationPercent || 65;
    const ruralPct = econ.ruralPopulationPercent || 35;
    const popVal = econ.currentPopulation || econ.population || 0;

    return (
      <Card className="glass-hierarchy-child border-green-500/10 bg-green-500/[0.02] p-3.5">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <Users className="h-3.5 w-3.5 text-green-400" />
            {title}
          </span>
          <span className="text-muted-foreground text-[10px]">Demographics</span>
        </div>
        <div className="mb-2.5 grid grid-cols-2 gap-2.5">
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
            <div className="text-muted-foreground text-[10px]">Population</div>
            <div className="mt-0.5 text-sm font-bold text-white">{popVal.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
            <div className="text-muted-foreground text-[10px]">Life Expectancy</div>
            <div className="mt-0.5 text-sm font-bold text-white">
              {econ.lifeExpectancy || 78} Years
            </div>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
            <div className="text-muted-foreground text-[10px]">Literacy Rate</div>
            <div className="mt-0.5 text-sm font-bold text-white">{econ.literacyRate || 99}%</div>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
            <div className="text-muted-foreground text-[10px]">Pop Tier</div>
            <Badge
              variant="secondary"
              className="mt-1 border border-green-500/20 bg-green-500/10 text-[9px] font-bold tracking-wider text-green-400 uppercase"
            >
              {econ.populationTier || "Medium"}
            </Badge>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="text-muted-foreground flex justify-between text-[10px]">
            <span>Urban ({urbanPct.toFixed(0)}%)</span>
            <span>Rural ({ruralPct.toFixed(0)}%)</span>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/5">
            <div className="h-full bg-green-500" style={{ width: `${urbanPct}%` }} />
            <div className="h-full bg-emerald-700" style={{ width: `${ruralPct}%` }} />
          </div>
        </div>
      </Card>
    );
  }

  // 6. Fiscal Budget & Debt
  if (type === "budget_debt") {
    const econ = economicQuery.data;
    if (!econ) {
      return (
        <Card className="glass-hierarchy-child text-muted-foreground border-amber-500/10 bg-amber-500/[0.02] p-3.5 text-center text-xs">
          No fiscal budget statistics available
        </Card>
      );
    }

    const taxGdp = econ.taxRevenueGDPPercent || 25;
    const spendGdp = econ.governmentBudgetGDPPercent || 28;
    const debtGdp = econ.totalDebtGDPRatio || 55;
    const budgetBal = econ.budgetDeficitSurplus || taxGdp - spendGdp;

    return (
      <Card className="glass-hierarchy-child border-amber-500/10 bg-amber-500/[0.02] p-3.5">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <BarChart3 className="h-3.5 w-3.5 text-amber-400" />
            {title}
          </span>
          <span className="text-muted-foreground text-[10px]">Fiscal Profile</span>
        </div>
        <div className="mb-2.5 grid grid-cols-2 gap-2.5">
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
            <div className="text-muted-foreground text-[10px]">Tax Revenue / GDP</div>
            <div className="mt-0.5 text-sm font-bold text-white">{taxGdp}%</div>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
            <div className="text-muted-foreground text-[10px]">Spending / GDP</div>
            <div className="mt-0.5 text-sm font-bold text-white">{spendGdp}%</div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-2">
            <div>
              <div className="text-muted-foreground text-[10px]">Budget Balance</div>
              <div
                className={cn(
                  "mt-0.5 text-sm font-bold",
                  budgetBal >= 0 ? "text-emerald-400" : "text-red-400"
                )}
              >
                {budgetBal >= 0 ? "+" : ""}
                {budgetBal.toFixed(1)}%
              </div>
            </div>
            {budgetBal >= 0 ? (
              <ArrowUpRight className="h-5 w-5 shrink-0 text-emerald-400" />
            ) : (
              <ArrowDownRight className="h-5 w-5 shrink-0 text-red-400" />
            )}
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
            <div className="text-muted-foreground text-[10px]">Debt-to-GDP Ratio</div>
            <div
              className={cn(
                "mt-0.5 text-sm font-bold",
                debtGdp > 80 ? "text-red-400" : debtGdp > 40 ? "text-amber-400" : "text-emerald-400"
              )}
            >
              {debtGdp}%
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // 7. Labor Market & Income Distribution
  if (type === "labor_market") {
    const econ = economicQuery.data;
    if (!econ) {
      return (
        <Card className="glass-hierarchy-child text-muted-foreground border-teal-500/10 bg-teal-500/[0.02] p-3.5 text-center text-xs">
          No labor market metrics available
        </Card>
      );
    }

    const unemp = econ.unemploymentRate || 5.2;
    const gini = econ.incomeInequalityGini || 32;
    const avgIncome = econ.averageAnnualIncome || 35000;
    const minWage = econ.minimumWage || 8.5;

    return (
      <Card className="glass-hierarchy-child border-teal-500/10 bg-teal-500/[0.02] p-3.5">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <Briefcase className="h-3.5 w-3.5 text-teal-400" />
            {title}
          </span>
          <span className="text-muted-foreground text-[10px]">Labor & Income</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
            <div className="text-muted-foreground text-[10px]">Unemployment Rate</div>
            <div className="mt-0.5 text-sm font-bold text-white">{unemp}%</div>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
            <div className="text-muted-foreground text-[10px]">Gini Coefficient</div>
            <div className="mt-0.5 text-sm font-bold text-white">{gini}</div>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
            <div className="text-muted-foreground text-[10px]">Avg Annual Income</div>
            <div className="mt-0.5 text-sm font-bold text-white">${avgIncome.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
            <div className="text-muted-foreground text-[10px]">Minimum Wage</div>
            <div className="mt-0.5 text-sm font-bold text-white">${minWage}/hr</div>
          </div>
        </div>
      </Card>
    );
  }

  // 8. National Vitality & Well-being
  if (type === "national_vitality") {
    const vit = vitalityQuery.data;
    if (!vit) {
      return (
        <Card className="glass-hierarchy-child text-muted-foreground border-red-500/10 bg-red-500/[0.02] p-3.5 text-center text-xs">
          No vitality metrics available
        </Card>
      );
    }

    const econVit = vit.economicVitality || 50;
    const popWell = vit.populationWellbeing || 50;
    const diploStand = vit.diplomaticStanding || 50;
    const govEff = vit.governmentalEfficiency || 50;

    return (
      <Card className="glass-hierarchy-child border-red-500/10 bg-red-500/[0.02] p-3.5">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <Activity className="h-3.5 w-3.5 text-red-400" />
            {title}
          </span>
          <span className="text-muted-foreground text-[10px]">National Vitality</span>
        </div>
        <div className="space-y-2">
          {/* Economic Vitality */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-white">
              <span className="text-muted-foreground">Economic Vitality</span>
              <span className="font-semibold text-emerald-400">{econVit}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div className="h-full bg-emerald-500" style={{ width: `${econVit}%` }} />
            </div>
          </div>
          {/* Population Wellbeing */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-white">
              <span className="text-muted-foreground">Population Wellbeing</span>
              <span className="font-semibold text-blue-400">{popWell}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div className="h-full bg-blue-500" style={{ width: `${popWell}%` }} />
            </div>
          </div>
          {/* Diplomatic Standing */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-white">
              <span className="text-muted-foreground">Diplomatic Standing</span>
              <span className="font-semibold text-purple-400">{diploStand}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div className="h-full bg-purple-500" style={{ width: `${diploStand}%` }} />
            </div>
          </div>
          {/* Government Efficiency */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-white">
              <span className="text-muted-foreground">Government Efficiency</span>
              <span className="font-semibold text-amber-400">{govEff}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div className="h-full bg-amber-500" style={{ width: `${govEff}%` }} />
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return null;
}

ThinkpagesPost.displayName = "ThinkpagesPost";

// ──────────────────────────────────────────────
// Premium Native Inline Link Previews
// ──────────────────────────────────────────────

function PostInlineLinkPreview({ url }: { url: string }) {
  const wikiMatch = url.match(
    /(?:https?:\/\/)?(?:www\.)?(ixwiki\.com|iiwiki\.com)\/wiki\/([^#?\s)]+)/i
  );
  const forumMatch = url.match(
    /(?:https?:\/\/)?(?:www\.)?forum\.ixwiki\.com\/threads\/(?:[^/]*\.)?(\d+)/i
  );

  if (wikiMatch) {
    const domain = wikiMatch[1] || "ixwiki.com";
    const wiki = domain.toLowerCase().includes("iiwiki") ? "iiwiki" : "ixwiki";
    const title = decodeURIComponent(wikiMatch[2]!).replace(/_/g, " ");
    return <WikiInlinePreview title={title} wiki={wiki} url={url} />;
  }

  if (forumMatch) {
    const threadId = parseInt(forumMatch[1]!, 10);
    if (!isNaN(threadId) && threadId > 0) {
      return <ForumInlinePreview threadId={threadId} url={url} />;
    }
  }

  return null;
}

function WikiInlinePreview({
  title,
  wiki,
  url,
}: {
  title: string;
  wiki: "ixwiki" | "iiwiki";
  url: string;
}) {
  const { data: intro, isLoading } = api.wiki.getIntro.useQuery(
    { title, wiki },
    { staleTime: 10 * 60_000 }
  );

  if (isLoading) {
    return (
      <div className="glass-hierarchy-child mt-3 animate-pulse p-3.5">
        <div className="bg-muted/50 mb-2 h-4 w-1/3 rounded dark:bg-white/10" />
        <div className="bg-muted/30 h-3 w-2/3 rounded dark:bg-white/5" />
      </div>
    );
  }

  if (!intro?.text) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="glass-hierarchy-child group hover:glass-hierarchy-interactive mt-3 block p-3.5 transition-all duration-300 hover:-translate-y-0.5"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-500">
          <BookOpen className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-foreground truncate text-sm font-semibold transition-colors group-hover:text-amber-400">
              {title}
            </span>
            <Badge
              variant="outline"
              className="shrink-0 border-amber-500/30 bg-amber-500/5 text-[9px] text-amber-400"
            >
              {wiki === "ixwiki" ? "IxWiki" : "IIWiki"}
            </Badge>
          </div>
          <p className="text-muted-foreground line-clamp-3 text-xs leading-relaxed">{intro.text}</p>
          <div className="mt-2.5 flex items-center gap-1.5 text-[10px] font-medium text-amber-500/80">
            <span>Read full article</span>
            <ExternalLink className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>
    </a>
  );
}

function ForumInlinePreview({ threadId, url }: { threadId: number; url: string }) {
  const { data: thread, isLoading } = api.wiki.getForumThreadPreview.useQuery(
    { threadId },
    { staleTime: 10 * 60_000 }
  );

  if (isLoading) {
    return (
      <div className="glass-hierarchy-child mt-3 animate-pulse p-3.5">
        <div className="bg-muted/50 mb-2 h-4 w-1/3 rounded dark:bg-white/10" />
        <div className="bg-muted/30 h-3 w-2/3 rounded dark:bg-white/5" />
      </div>
    );
  }

  if (!thread) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="glass-hierarchy-child group hover:glass-hierarchy-interactive mt-3 block p-3.5 transition-all duration-300 hover:-translate-y-0.5"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-500">
          <MessageSquare className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-foreground truncate text-sm font-semibold transition-colors group-hover:text-violet-400">
              {thread.title}
            </span>
            {thread.forumName && (
              <Badge
                variant="outline"
                className="shrink-0 border-violet-500/30 bg-violet-500/5 text-[9px] text-violet-400"
              >
                {thread.forumName}
              </Badge>
            )}
          </div>
          {thread.excerpt && (
            <p className="text-muted-foreground line-clamp-3 text-xs leading-relaxed">
              {thread.excerpt}
            </p>
          )}
          <div className="mt-2.5 flex items-center justify-between">
            <div className="text-muted-foreground flex items-center gap-3 text-[10px]">
              {thread.author && (
                <span className="flex items-center gap-0.5">
                  <Users className="h-2.5 w-2.5" />
                  {thread.author}
                </span>
              )}
              {thread.replyCount !== undefined && (
                <span className="flex items-center gap-0.5">
                  <MessageSquare className="h-2.5 w-2.5" />
                  {thread.replyCount} replies
                </span>
              )}
              {thread.viewCount !== undefined && (
                <span className="flex items-center gap-0.5">
                  <Eye className="h-2.5 w-2.5" />
                  {thread.viewCount} views
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-violet-500/80">
              <span>Open forum thread</span>
              <ExternalLink className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}
