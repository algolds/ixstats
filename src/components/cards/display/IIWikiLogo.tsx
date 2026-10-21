"use client";

import { cn } from "~/lib/utils";

const IIWIKI_LOGO_URL = "/images/IIWikiLogo.png";

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
      src={IIWIKI_LOGO_URL}
      alt="IIWiki"
      className={cn("inline-block shrink-0 object-contain", sizeClasses[size], className)}
      loading="lazy"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
