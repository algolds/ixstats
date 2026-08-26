// src/components/wiki-os/shared/HatnoteCapsule.tsx
// Modern Apple-grade Disambiguation, Redirect & Contextual Hatnote Capsule
"use client";

import * as React from "react";
import Link from "next/link";
import { InfoCircle, NavArrowRight, Pin, ArrowUpRight } from "iconoir-react";
import { withBasePath } from "~/lib/base-path";

export type HatnoteType = "disambiguation" | "redirect" | "main" | "see_also";

interface HatnoteCapsuleProps {
  type?: HatnoteType;
  text?: string;
  targetSlug?: string;
  targetTitle?: string;
  forContext?: string;
  children?: React.ReactNode;
}

export function HatnoteCapsule({
  type = "disambiguation",
  text,
  targetSlug,
  targetTitle,
  forContext,
  children,
}: HatnoteCapsuleProps) {
  const getIcon = () => {
    switch (type) {
      case "redirect":
        return <ArrowUpRight className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
      case "main":
        return <Pin className="h-3.5 w-3.5 text-wiki shrink-0" />;
      case "see_also":
        return <NavArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
      case "disambiguation":
      default:
        return <InfoCircle className="h-3.5 w-3.5 text-sky-400 shrink-0" />;
    }
  };

  const getPrefix = () => {
    switch (type) {
      case "redirect":
        return "Redirected from:";
      case "main":
        return "Main article:";
      case "see_also":
        return "See also:";
      case "disambiguation":
      default:
        return forContext ? `This article is about ${forContext}. For other uses, see` : "Disambiguation:";
    }
  };

  return (
    <aside
      aria-label="Hatnote notice"
      className="my-3 flex items-center gap-2 rounded-xl border border-border/40 bg-secondary/35 px-3.5 py-2 text-xs text-muted-foreground backdrop-blur-md transition-all duration-160 hover:border-border/60 hover:bg-secondary/50"
    >
      {getIcon()}
      <div className="flex flex-wrap items-center gap-1.5 leading-relaxed">
        <span className="italic">{getPrefix()}</span>

        {targetSlug && targetTitle && (
          <Link
            href={withBasePath(`/wiki/${encodeURIComponent(targetSlug)}`)}
            className="font-semibold text-wiki hover:underline transition-colors"
          >
            {targetTitle}
          </Link>
        )}

        {text && <span>{text}</span>}
        {children}
      </div>
    </aside>
  );
}
