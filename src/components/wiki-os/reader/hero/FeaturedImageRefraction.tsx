"use client";

import type React from "react";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";
import { TextureOverlay } from "~/components/ui/texture-overlay";

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

/** The v2 halo mask: solid to 75%, fading out at the rim so the glow never hard-edges. */
const UNDERGLOW_MASK: React.CSSProperties = {
  maskImage:
    "radial-gradient(ellipse 96% 92% at 50% 50%, black 0%, black 75%, rgb(0 0 0 / 0.5) 90%, transparent 100%)",
  WebkitMaskImage:
    "radial-gradient(ellipse 96% 92% at 50% 50%, black 0%, black 75%, rgb(0 0 0 / 0.5) 90%, transparent 100%)",
};

/**
 * Featured article card on the main page — the v2 refraction card (c5c6b382), restored for
 * Facet 3.1 (spec §16.1 #6 "wiki reader hero modes") on the glass hero tier:
 *
 * - `ambient-underglow` (Harmonic Under-Glow): a blurred, saturated copy of the lead image glows
 *   out behind the glass card as a concentric halo (outer radius = inner + inset).
 * - `facet-lens` (Facet Crystal Lens): the lead image tints the card from inside, under a surface
 *   scrim that keeps the text at full contrast, with the chamfered double rim.
 *
 * Both sit under the v2 paper grain. Pointer tilt / sheen stay retired (spec §16.1 #4); the
 * artwork brightens on hover / focus-within only. Reduce Transparency and Increase Contrast drop
 * the artwork (the card turns opaque); paint lives in styles/wiki-os/components.css.
 */
export function FeaturedArticleRefractionCard({
  imgSrc,
  mode = "ambient-underglow",
  className,
  children,
}: FeaturedArticleRefractionCardProps) {
  return (
    <div
      className="wikios-hero-refraction group relative isolate w-full select-none"
      data-refraction-mode={mode}
    >
      {mode === "ambient-underglow" && imgSrc && (
        <div
          aria-hidden="true"
          className="wikios-hero-underglow pointer-events-none absolute -inset-1 -z-10 overflow-hidden rounded-[20px] sm:-inset-1.5 sm:rounded-[30px] print:hidden"
          style={UNDERGLOW_MASK}
        >
          <img src={imgSrc} alt="" loading="lazy" className="size-full object-cover" />
        </div>
      )}

      <FacetCard
        variant="glass"
        className={cn("overflow-hidden rounded-2xl p-4 sm:rounded-3xl sm:p-5 lg:p-6", className)}
      >
        {mode === "facet-lens" && (
          <>
            {imgSrc && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-10 overflow-hidden print:hidden"
              >
                <img
                  src={imgSrc}
                  alt=""
                  loading="lazy"
                  className="wikios-hero-lens-art size-full object-cover"
                />
                <div className="wikios-hero-lens-scrim absolute inset-0" />
              </div>
            )}
            <div
              aria-hidden="true"
              className="wikios-hero-lens-chamfer pointer-events-none absolute inset-0 rounded-[inherit]"
            />
          </>
        )}

        <TextureOverlay texture="paperGrain" opacity={0.05} className="rounded-[inherit]" />

        <div className="relative">{children}</div>
      </FacetCard>
    </div>
  );
}

/**
 * Featured thumbnail artwork frame (v2: 16:10 frame, image zoom on hover, bottom scrim).
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
        "overflow-hidden rounded-xl sm:rounded-2xl",
        "border-separator bg-surface-secondary border shadow-xs",
        "focus-visible:outline-tint focus-visible:outline-2 focus-visible:outline-offset-2"
      )}
    >
      <img
        src={imgSrc}
        alt={title}
        loading="lazy"
        className="ease-out-facet h-full w-full object-cover transition-transform duration-300 group-hover/img:scale-105 motion-reduce:transition-none motion-reduce:group-hover/img:scale-100"
      />
      {/* v2 bottom scrim: grounds the artwork against the card. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent"
      />
    </Link>
  );
}
