"use client";

import type React from "react";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";

export type RefractionMode = "ambient-underglow" | "facet-lens";

export interface RefractionConfig {
  id: RefractionMode;
  name: string;
  badge: string;
  desc: string;
}

export const REFRACTION_MODES: RefractionConfig[] = [
  {
    id: "ambient-underglow",
    name: "Harmonic Under-Glow",
    badge: "Concentric Halo",
    desc: "Clean frosted card with a harmoniously scaled, concentric chromatic backlight rim.",
  },
  {
    id: "facet-lens",
    name: "Facet Crystal Lens",
    badge: "Internal Refraction",
    desc: "100% contained internal optical color tint with precision chamfered rim under paper grain.",
  },
];

export const REFRACTION_STORAGE_KEY = "wikios:refractionMode";

export function getStoredRefractionMode(): RefractionMode {
  if (typeof window === "undefined") return "ambient-underglow";
  try {
    const saved = localStorage.getItem(REFRACTION_STORAGE_KEY) as string | null;
    if (saved && ["ambient-underglow", "facet-lens"].includes(saved)) {
      return saved as RefractionMode;
    }
    if (
      saved === "ambient-bloom" ||
      saved === "volumetric-radiance" ||
      saved === "underglow" ||
      saved === "volumetric-glow"
    ) {
      return "ambient-underglow";
    }
    if (
      saved === "specular-caustic" ||
      saved === "spatial-depth" ||
      saved === "facet-lens" ||
      saved === "bevel"
    ) {
      return "facet-lens";
    }
  } catch {
    // ignore
  }
  return "ambient-underglow";
}

interface FeaturedArticleRefractionCardProps {
  imgSrc: string | null;
  mode?: RefractionMode;
  className?: string;
  children: React.ReactNode;
}

/**
 * Featured article card on the main page. Facet 3 (spec §5, §14 decorative imagery): content is
 * an opaque card and hero imagery never washes the full width, so the former "under-glow" and
 * "crystal lens" artwork washes are gone; `mode` and `imgSrc` are accepted for the stored
 * preference and ignored.
 */
export function FeaturedArticleRefractionCard({
  imgSrc: _imgSrc,
  mode: _mode = "ambient-underglow",
  className,
  children,
}: FeaturedArticleRefractionCardProps) {
  return (
    <div className="group relative w-full select-none">
      <div
        className={cn(
          "rounded-card border-separator bg-surface relative overflow-hidden border p-4 sm:p-5 lg:p-6",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Featured thumbnail artwork frame.
 */
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
      href={withBasePath(`/wiki/${slug}`)}
      className={cn(
        "group/img relative block w-full shrink-0 sm:w-[240px] md:w-[270px] lg:w-[290px]",
        "aspect-[16/10] sm:aspect-[3/2] md:aspect-[16/10]",
        "rounded-row border-separator bg-surface-secondary overflow-hidden border",
        "focus-visible:outline-tint focus-visible:outline-2 focus-visible:outline-offset-2"
      )}
    >
      <img
        src={imgSrc}
        alt={title}
        loading="lazy"
        className="ease-out-facet h-full w-full object-cover transition-transform duration-300 group-hover/img:scale-[1.02] motion-reduce:transition-none"
      />
    </Link>
  );
}
