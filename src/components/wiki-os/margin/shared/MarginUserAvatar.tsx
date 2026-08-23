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
  primaryColor = "var(--margin-accent-text, #fef036)",
  liveAvatar,
  className,
}: MarginUserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initials = getInitials(author.username);
  const avatarUrl = !imgError ? (author.avatar || liveAvatar) : null;
  const flagUrl = author.country?.flag;

  const sizeClasses = {
    xs: "w-5 h-5 text-[8.5px]",
    sm: "w-6 h-6 text-[9.5px]",
    md: "w-8 h-8 text-xs",
  }[size];

  return (
    <div className={cn("relative shrink-0 flex items-center justify-center select-none", className)}>
      <div
        className={cn(
          "rounded-full overflow-hidden flex items-center justify-center font-bold transition-transform duration-100 border shadow-xs",
          sizeClasses,
          "border-yellow-400/60 bg-margin-accent text-stone-950 font-black"
        )}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={author.username}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {/* Country Flag Micro Badge */}
      {flagUrl && (
        <span
          className="absolute -bottom-0.5 -right-0.5 w-3 h-2.5 rounded-xs overflow-hidden border border-[var(--wikios-border)] shadow-xs bg-[var(--wikios-bg)] flex items-center justify-center"
          title={author.country?.name}
        >
          <img src={flagUrl} alt="" className="w-full h-full object-cover" />
        </span>
      )}
    </div>
  );
});
