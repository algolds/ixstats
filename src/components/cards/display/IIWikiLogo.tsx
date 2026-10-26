"use client";

import { cn } from "~/lib/utils";
import { IIWIKI_LOGO_URL } from "~/lib/cards/realm-logos";
import { assetUrl } from "~/lib/base-path";

interface IIWikiLogoProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
}

export function IIWikiLogo({ className, size = "sm" }: IIWikiLogoProps) {
  const sizeClasses = {
    xs: "h-3 w-auto",
    sm: "h-3.5 w-auto",
    md: "h-4 w-auto",
    lg: "h-5 w-auto",
  };

  return (
    <img
      src={assetUrl(IIWIKI_LOGO_URL) ?? undefined}
      alt="IIWiki"
      className={cn("inline-block shrink-0 object-contain", sizeClasses[size], className)}
      loading="lazy"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
