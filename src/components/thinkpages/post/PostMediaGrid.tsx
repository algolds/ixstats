"use client";

import React from "react";
import { motion } from "motion/react";
import { cn } from "~/lib/utils";
import { proxyDiscordUrl } from "./ThinkpagesPostUtils";

export interface PostMediaItem {
  id?: string;
  url: string;
  filename?: string;
}

export interface PostMediaGridProps {
  mediaAttachments?: PostMediaItem[];
  postId: string;
  onOpenLightbox: (media: { url: string; id: string }) => void;
}

export function PostMediaGrid({
  mediaAttachments = [],
  postId,
  onOpenLightbox,
}: PostMediaGridProps) {
  if (!mediaAttachments || mediaAttachments.length === 0) return null;

  return (
    <div
      className={cn(
        "border-border/50 mb-3 overflow-hidden rounded-xl border shadow-sm dark:border-white/10",
        mediaAttachments.length === 1 && "max-w-xl",
        mediaAttachments.length > 1 && "grid grid-cols-2 gap-0.5"
      )}
    >
      {mediaAttachments.map((media, index) => {
        const isSingle = mediaAttachments.length === 1;
        const layoutId = `${postId}-${media.id || index}`;

        return (
          <div
            key={media.id || index}
            className={cn(
              "relative flex items-center justify-center overflow-hidden bg-neutral-900/40",
              isSingle && "aspect-[16/10] max-h-[420px] w-full",
              mediaAttachments.length === 2 && "aspect-square",
              mediaAttachments.length === 3 && index === 0
                ? "col-span-2 aspect-[16/10]"
                : "aspect-square",
              mediaAttachments.length === 4 && "aspect-square"
            )}
          >
            <motion.img
              layoutId={layoutId}
              src={proxyDiscordUrl(media.url)}
              alt={media.filename || `Attachment ${index + 1}`}
              className="h-full w-full cursor-pointer object-cover"
              whileHover={{ scale: 1.02, opacity: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              onClick={(e) => {
                e.stopPropagation();
                onOpenLightbox({
                  url: media.url,
                  id: layoutId,
                });
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
