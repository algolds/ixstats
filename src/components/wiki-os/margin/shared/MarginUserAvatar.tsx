"use client";
// Shared, memoized avatar component with country flag micro-badge and initials fallback for Margin.
// Signature Highlighter Yellow / Warm Amber branding for Margin.

import React, { useState, memo } from "react";
import { cn } from "~/lib/utils";

export interface CommentAuthor {
  id: string;
  username: string;
  avatar: string | null;
  role: { name: string; displayName: string } | null;
  country: { id: string; name: string; flag: string | null } | null;
}

export function getInitials(name: string): string {
  const cleaned = name.trim().replace(/_/g, " ");
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

interface MarginUserAvatarProps {
  author: CommentAuthor;
  size?: "xs" | "sm" | "md";
  liveAvatar?: string | null;
  className?: string;
}

export const MarginUserAvatar = memo(function MarginUserAvatar({
  author,
  size = "sm",
  liveAvatar,
  className,
}: MarginUserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initials = getInitials(author.username);
  const avatarUrl = !imgError ? author.avatar || liveAvatar : null;
  const flagUrl = author.country?.flag;

  const sizeClasses = {
    xs: "w-5 h-5 text-footnote",
    sm: "w-6 h-6 text-footnote",
    md: "w-8 h-8 text-footnote",
  }[size];

  return (
    <div
      className={cn("relative flex shrink-0 items-center justify-center select-none", className)}
    >
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-full border font-semibold transition-transform duration-100",
          sizeClasses,
          "bg-margin-accent border-yellow/60 font-semibold text-(--margin-badge-text)"
        )}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={author.username}
            onError={() => setImgError(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {/* Country Flag Micro Badge */}
      {flagUrl && (
        <span
          className="border-separator bg-background absolute -right-0.5 -bottom-0.5 flex h-2.5 w-3 items-center justify-center overflow-hidden rounded-xs border"
          title={author.country?.name}
        >
          <img src={flagUrl} alt="" className="h-full w-full object-cover" />
        </span>
      )}
    </div>
  );
});
