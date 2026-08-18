"use client";

import { cn } from "~/lib/utils";

export const IIWIKI_LOGO_URL = "/images/IIWikiLogo.png";

export interface IIWikiLogoProps {
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

export function IIWikiBadge({
  className,
  size = "sm",
  showText = true,
}: {
  className?: string;
  size?: "xs" | "sm" | "md";
  showText?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-600 shadow-xs backdrop-blur-md dark:text-emerald-300",
        className
      )}
      title="IIWiki Card"
    >
      <IIWikiLogo size={size} />
      {showText && <span>IIWiki</span>}
    </span>
  );
}

export function isIIWikiCard(card: Record<string, any> | null | undefined): boolean {
  if (!card) return false;
  if (card.wikiSource === "iiwiki") return true;
  const meta = card.metadata as Record<string, any> | null | undefined;
  return meta?.wikiSource === "iiwiki";
}
