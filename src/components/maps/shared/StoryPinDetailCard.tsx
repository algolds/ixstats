"use client";

import React, { memo } from "react";
import { BookOpen, ExternalLink, Image as ImageIcon, MapPin } from "lucide-react";
import { TimelineEraBadge } from "./TimelineEraBadge";
import Link from "next/link";

export interface StoryPinData {
  id?: string;
  title: string;
  content: string;
  contentFormat?: "plain" | "markdown";
  category?: string;
  importance?: number;
  ixTimeYear?: number;
  eraLabel?: string;
  wikiPageTitle?: string;
  photos?: string[];
  thumbnailUrl?: string;
  coordinates?: [number, number];
}

interface StoryPinDetailCardProps {
  pin: StoryPinData;
  className?: string;
  onClose?: () => void;
}

export const StoryPinDetailCard = memo(function StoryPinDetailCard({
  pin,
  className = "",
}: StoryPinDetailCardProps) {
  const photos = pin.photos ?? (pin.thumbnailUrl ? [pin.thumbnailUrl] : []);

  return (
    <div className={`space-y-3 text-foreground ${className}`}>
      {/* Header */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <TimelineEraBadge
            eraLabel={pin.eraLabel}
            ixTimeYear={pin.ixTimeYear}
            category={pin.category}
          />
          {pin.coordinates && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
              <MapPin className="h-3 w-3" />
              <span>{pin.coordinates[0].toFixed(2)}°, {pin.coordinates[1].toFixed(2)}°</span>
            </div>
          )}
        </div>
        <h3 className="text-base font-bold tracking-tight text-foreground leading-snug">
          {pin.title}
        </h3>
      </div>

      {/* Photo Gallery preview */}
      {photos.length > 0 && (
        <div className="relative overflow-hidden rounded-lg border border-border/40 bg-muted/20">
          <img
            src={photos[0]}
            alt={pin.title}
            className="h-44 w-full object-cover transition duration-300 hover:scale-105"
          />
          {photos.length > 1 && (
            <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
              <ImageIcon className="h-3 w-3" />
              <span>+{photos.length - 1} photos</span>
            </span>
          )}
        </div>
      )}

      {/* Content Text */}
      <div className="prose prose-sm dark:prose-invert max-w-none text-xs text-muted-foreground leading-relaxed line-clamp-6">
        {pin.content}
      </div>

      {/* Wiki Link */}
      {pin.wikiPageTitle && (
        <div className="pt-1">
          <Link
            href={`/wiki/${encodeURIComponent(pin.wikiPageTitle)}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Read full chronicle: {pin.wikiPageTitle}</span>
            <ExternalLink className="h-3 w-3 opacity-60" />
          </Link>
        </div>
      )}
    </div>
  );
});
