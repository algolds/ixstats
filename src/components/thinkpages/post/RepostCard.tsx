"use client";

import React from "react";
import { motion } from "motion/react";
import { cn } from "~/lib/utils";
import { Card } from "~/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { formatThinkpagesContentForDisplay } from "~/lib/utils";
import { WikiHtmlContent } from "~/components/wiki/WikiLinkPreview";

export interface RepostCardProps {
  post: any;
  cleanRepostContent: string;
  repostMediaAttachments?: any[];
  proxyDiscordUrl: (url: string) => string;
  setLightboxMedia: (val: { url: string; id: string } | null) => void;
}

export function RepostCard({
  post,
  cleanRepostContent,
  repostMediaAttachments,
  proxyDiscordUrl,
  setLightboxMedia,
}: RepostCardProps) {
  if (!post.repostOf) return null;

  return (
    <Card className="rounded-lg border-green-500/30 bg-green-500/10 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Avatar className="h-6 w-6">
          <AvatarImage src={proxyDiscordUrl(post.repostOf.account?.profileImageUrl || "")} />
          <AvatarFallback className="text-xs font-semibold">
            {post.repostOf.account?.displayName
              ?.split(" ")
              .map((n: string) => n[0])
              .join("")
              .toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm font-semibold">{post.repostOf.account?.displayName}</span>
        <span className="text-muted-foreground text-xs">
          @{post.repostOf.account?.username}
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
  );
}
