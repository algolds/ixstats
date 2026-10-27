"use client";

import React from "react";
import { formatThinkpagesContentForDisplay } from "~/lib/utils";
import { WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { PostMediaGrid } from "./PostMediaGrid";
import { getInitials, proxyDiscordUrl } from "./ThinkpagesPostUtils";

interface RepostCardProps {
  post: any;
  cleanRepostContent: string;
  repostMediaAttachments?: any[];
  setLightboxMedia: (val: { url: string; id: string } | null) => void;
}

export function RepostCard({
  post,
  cleanRepostContent,
  repostMediaAttachments,
  setLightboxMedia,
}: RepostCardProps) {
  const original = post.repostOf;
  if (!original) return null;

  return (
    <div className="bg-surface-secondary rounded-row p-3">
      <div className="mb-2 flex items-center gap-2">
        <Avatar className="size-6">
          <AvatarImage src={proxyDiscordUrl(original.account?.profileImageUrl || "")} />
          <AvatarFallback className="text-caption">
            {(original.account?.displayName && getInitials(original.account.displayName)) || "?"}
          </AvatarFallback>
        </Avatar>
        <span className="text-headline text-label">{original.account?.displayName}</span>
        <span className="text-label-secondary text-footnote">@{original.account?.username}</span>
      </div>
      <WikiHtmlContent html={formatThinkpagesContentForDisplay(cleanRepostContent)} />
      <PostMediaGrid
        variant="repost"
        mediaAttachments={repostMediaAttachments}
        postId={post.id}
        onOpenLightbox={setLightboxMedia}
      />
    </div>
  );
}
