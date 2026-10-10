"use client";

import type React from "react";
import Link from "next/link";
import { cn } from "~/lib/utils";
import { Card } from "~/components/ui/card";

export function FeaturedArticleCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("overflow-hidden rounded-2xl p-4 sm:rounded-3xl sm:p-5 lg:p-6", className)}>
      {children}
    </Card>
  );
}

/** Featured thumbnail artwork: 16:10 frame, zooms on hover, bottom scrim. */
export function FeaturedThumbnailFrame({
  imgSrc,
  title,
  slug,
}: {
  imgSrc: string;
  title: string;
  slug: string;
}) {
  return (
    <Link
      href={`/wiki/${slug}`}
      className={cn(
        "group/img relative block w-full shrink-0 sm:w-[240px] md:w-[270px] lg:w-[290px]",
        "aspect-[16/10] sm:aspect-[3/2] md:aspect-[16/10]",
        "overflow-hidden rounded-xl sm:rounded-2xl",
        "border-separator bg-surface-secondary border shadow-xs",
        "focus-visible:outline-tint focus-visible:outline-2 focus-visible:outline-offset-2"
      )}
    >
      <img
        src={imgSrc}
        alt={title}
        loading="lazy"
        className="ease-out-facet h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover/img:scale-105 motion-safe:group-focus-visible/img:scale-105 motion-reduce:transition-none"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent"
      />
    </Link>
  );
}
