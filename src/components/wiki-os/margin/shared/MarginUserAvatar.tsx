// src/components/wiki-os/margin/shared/MarginUserAvatar.tsx
// Shared, memoized avatar component with country flag micro-badge and initials fallback for Margin.
// Signature Highlighter Yellow / Warm Amber branding for Margin.

"use client";

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
  primaryColor?: string;
  liveAvatar?: string | null;
  className?: string;
}

export const MarginUserAvatar = memo(function MarginUserAvatar({
  author,
  size = "sm",
  // oxlint-disable-next-line eslint/no-unused-vars
  primaryColor = "var(--margin-accent-text, #fef036)",
  liveAvatar,
  className,
}: MarginUserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initials = getInitials(author.username);
  const avatarUrl = !imgError ? author.avatar || liveAvatar : null;
  const flagUrl = author.country?.flag;

  const sizeClasses = {
    xs: "w-5 h-5 text-[8.5px]",
    sm: "w-6 h-6 text-[9.5px]",
    md: "w-8 h-8 text-xs",
  }[size];

  return (
    <div
      className={cn("relative flex shrink-0 items-center justify-center select-none", className)}
    >
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-full border font-bold shadow-xs transition-transform duration-100",
          sizeClasses,
          "bg-margin-accent border-yellow-400/60 font-black text-stone-950"
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
          className="absolute -right-0.5 -bottom-0.5 flex h-2.5 w-3 items-center justify-center overflow-hidden rounded-xs border border-[var(--wikios-border)] bg-[var(--wikios-bg)] shadow-xs"
          title={author.country?.name}
        >
          <img src={flagUrl} alt="" className="h-full w-full object-cover" />
        </span>
      )}
    </div>
  );
});
