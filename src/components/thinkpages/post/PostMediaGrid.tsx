"use client";

import React from "react";
import { motion } from "motion/react";
import { springSnappy } from "~/lib/design/motion";
import { cn } from "~/lib/utils";
import { proxyDiscordUrl } from "./ThinkpagesPostUtils";

interface PostMediaItem {
  id?: string;
  url: string;
  filename?: string;
}

const VARIANTS = {
  post: {
    outer: "rounded-row mb-3",
    single: "max-w-xl",
    singleCell: "max-h-[420px]",
    idPrefix: "",
    altLabel: "Attachment",
  },
  repost: {
    outer: "rounded-control mt-2",
    single: "max-w-md",
    singleCell: "max-h-[220px]",
    idPrefix: "repost-",
    altLabel: "Image",
  },
};

interface PostMediaGridProps {
  mediaAttachments?: PostMediaItem[];
  postId: string;
  onOpenLightbox: (media: { url: string; id: string }) => void;
  variant?: keyof typeof VARIANTS;
}

export function PostMediaGrid({
  mediaAttachments = [],
  postId,
  onOpenLightbox,
  variant = "post",
}: PostMediaGridProps) {
  if (mediaAttachments.length === 0) return null;
  const { outer, single, singleCell, idPrefix, altLabel } = VARIANTS[variant];
  const count = mediaAttachments.length;

  return (
    <div
      className={cn(
        "border-separator overflow-hidden border",
        outer,
        count === 1 && single,
        count > 1 && "grid grid-cols-2 gap-0.5"
      )}
    >
      {mediaAttachments.map((media, index) => {
        const layoutId = `${idPrefix}${postId}-${media.id || index}`;

        return (
          <div
            key={media.id || index}
            className={cn(
              "bg-fill-3 relative flex items-center justify-center overflow-hidden",
              count === 1 && cn("aspect-[16/10] w-full", singleCell),
              count === 2 && "aspect-square",
              count === 3 && index === 0 ? "col-span-2 aspect-[16/10]" : "aspect-square",
              count === 4 && "aspect-square"
            )}
          >
            <motion.img
              layoutId={layoutId}
              src={proxyDiscordUrl(media.url)}
              alt={media.filename || `${altLabel} ${index + 1}`}
              className="h-full w-full cursor-pointer object-cover"
              whileHover={{ scale: 1.02, opacity: 0.95 }}
              transition={springSnappy}
              onClick={(e) => {
                e.stopPropagation();
                onOpenLightbox({ url: media.url, id: layoutId });
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
